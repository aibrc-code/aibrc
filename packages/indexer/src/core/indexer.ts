import { CanonicalChainCursor } from "./canonical-chain-cursor.js";
import { assertRollbackRetentionDepth, deriveRollbackRetentionWindow } from "./rollback-retention.js";
import {
  IndexerError,
  type BlockReference,
  type BlockTransferDelta,
  type BlockSource,
  type CursorState,
  type IndexerBlock,
  type IndexerSnapshot,
  type IndexerStatus,
  type IndexerSyncErrorClassification,
  type LifecycleObserver,
  type ProtocolEngine,
  type RollbackJournal,
  type StorageAdapter,
} from "./types.js";

export interface IndexerCoreOptions {
  readonly startHeight: number;
  readonly anchorHash: string | null;
  readonly blockSource: BlockSource;
  readonly rollbackJournal: RollbackJournal;
  readonly storage: StorageAdapter;
  readonly protocolEngine: ProtocolEngine;
  readonly rollbackRetentionDepth: number;
  readonly observer?: LifecycleObserver;
  /** Control-plane notification, unlike the best-effort telemetry observer. */
  readonly onNonReadyStatus?: (status: Exclude<IndexerStatus, "READY">, syncTarget?: BlockReference) => Promise<void>;
  readonly classifySyncError?: (error: unknown) => IndexerSyncErrorClassification;
}

export class IndexerCore {
  private cursor: CanonicalChainCursor;
  private currentStatus: IndexerStatus = "SYNCING";
  private initialized = false;
  private haltReason: IndexerError["code"] | null = null;
  private lastPersistedState: {
    readonly status: IndexerStatus;
    readonly height: number;
    readonly hash: string | null;
    readonly haltReason: IndexerError["code"] | null;
  } | null = null;
  private pruneCount = 0;
  private prunedEntriesTotal = 0;
  private notificationFailure: unknown;
  private syncingNextTip: BlockReference | undefined;

  constructor(private readonly options: IndexerCoreOptions) {
    if (!Number.isSafeInteger(options.startHeight) || options.startHeight < 0) {
      throw new IndexerError("INVALID_BLOCK_HEIGHT", `Invalid start height ${options.startHeight}.`);
    }
    try { assertRollbackRetentionDepth(options.rollbackRetentionDepth); }
    catch {
      throw new IndexerError("INVALID_ROLLBACK_RETENTION_DEPTH", "Rollback retention depth must be a positive safe integer.");
    }
    this.cursor = new CanonicalChainCursor({
      height: options.startHeight - 1,
      hash: options.anchorHash,
    });
  }

  get status(): IndexerStatus {
    return this.currentStatus;
  }

  get cursorState(): CursorState {
    return this.cursor.state;
  }

  async initialize(snapshotOverride?: IndexerSnapshot | null): Promise<void> {
    if (this.options.storage.externalTransferHistory) this.options.protocolEngine.useExternalTransferHistory?.();
    const snapshot = snapshotOverride === undefined
      ? await this.options.storage.loadSnapshot()
      : snapshotOverride;
    if (snapshot) {
      if (snapshot.schemaVersion !== 1 && snapshot.schemaVersion !== 2) {
        await this.setStatus("HALTED");
        throw new IndexerError("SNAPSHOT_INCOMPATIBLE", `Unsupported snapshot schema ${String(snapshot.schemaVersion)}.`);
      }
      if (snapshot.cursor.height === this.options.startHeight - 1
        && snapshot.cursor.hash !== this.options.anchorHash) {
        await this.setStatus("HALTED");
        throw new IndexerError("NO_COMMON_ANCESTOR", "Pre-activation snapshot does not contain the verified anchor hash.");
      }
      // Storage snapshots are always literal at the generic Core boundary. A
      // runtime that recognizes one of its own special bootstrap markers must
      // validate and normalize it before calling initialize(); Core cannot know
      // whether an opaque protocolEngine state is truly empty.
      this.cursor = new CanonicalChainCursor(snapshot.cursor);
      await this.options.protocolEngine.restoreState(snapshot.engineState);
      await this.options.rollbackJournal.restore(snapshot.rollbackEntries);
      this.currentStatus = snapshot.status === "REORGING" ? "SYNCING" : snapshot.status;
      this.haltReason = snapshot.haltReason ?? null;
      this.lastPersistedState = {
        status: snapshot.status,
        height: snapshot.cursor.height,
        hash: snapshot.cursor.hash,
        haltReason: snapshot.haltReason ?? null,
      };
    }
    this.initialized = true;
  }

  async syncToTip(): Promise<void> {
    if (!this.initialized) await this.initialize();
    if (this.currentStatus === "HALTED") {
      throw new IndexerError("INDEXER_HALTED", "Indexer is halted.");
    }
    try {
      const tip = await this.options.blockSource.getTip();
      // The BlockSource contract makes getTip() the authoritative, verified
      // height/hash pair.  A persistent follower that is already durably READY
      // at that exact pair has no block work to do: avoid fetching/decoding the
      // full current block and avoid rewriting an identical checkpoint.
      if (tip
        && tip.height === this.cursor.state.height
        && tip.hash === this.cursor.state.hash) {
        if (this.currentStatus === "READY") return;
        // A transient RPC outage durably moves READY -> SYNCING without
        // changing canonical state. Once the authoritative tip is the exact
        // same height+hash, restore READY with one status checkpoint and avoid
        // fetching/decoding the unchanged full cursor block.
        await this.setStatus("READY");
        await this.persistIfChanged();
        return;
      }
      // Only one observed new block after a completed READY view is routine
      // catch-up. Startup/backlog/reorg and any failed attempt remain non-ready.
      const syncTarget = this.currentStatus === 'READY' && tip && this.cursor.state.hash !== null &&
        tip.height === this.cursor.state.height + 1 && tip.hash !== this.cursor.state.hash
        ? {height:tip.height,hash:tip.hash} : undefined;
      await this.setStatus("SYNCING", syncTarget);
      if (!tip) {
        await this.setStatus("READY");
        await this.persistIfChanged();
        return;
      }
      if (this.cursor.state.height >= this.options.startHeight) {
        const canonicalCursorBlock = await this.options.blockSource.getBlock(this.cursor.state.height);
        if (!canonicalCursorBlock || canonicalCursorBlock.hash !== this.cursor.state.hash) {
          await this.reorganize();
        } else if (this.cursor.state.height === tip.height && canonicalCursorBlock.hash !== tip.hash) {
          await this.assertTipDidNotMove(tip);
          throw new IndexerError(
            "HASH_DISCONTINUITY",
            `Block source tip hash ${tip.hash} disagrees with block ${tip.height}:${canonicalCursorBlock.hash}.`,
          );
        }
      }
      while (this.cursor.state.height < tip.height) {
        const nextHeight = this.cursor.state.height + 1;
        const block = await this.options.blockSource.getBlock(nextHeight);
        if (!block) {
          throw new IndexerError("BLOCK_NOT_FOUND", `Block source has no block at height ${nextHeight}.`);
        }
        this.cursor.assertNextHeight(block);
        if (block.height === tip.height && block.hash !== tip.hash) {
          await this.assertTipDidNotMove(tip);
          throw new IndexerError(
            "HASH_DISCONTINUITY",
            `Block source tip hash ${tip.hash} disagrees with block ${block.height}:${block.hash}.`,
          );
        }
        if (!this.cursor.linksToCurrentTip(block)) {
          await this.reorganize();
          continue;
        }
        const isFinalTipBlock = block.height === tip.height;
        const shouldContinue = await this.processBlock(block, isFinalTipBlock);
        if (!shouldContinue) return;
      }
      if (this.currentStatus !== "READY") await this.setStatus("READY");
      await this.persistIfChanged();
    } catch (primaryError) {
      if (primaryError === this.notificationFailure) {
        this.notificationFailure = undefined;
        // The rejection notification failed. Never read another block or turn
        // this publication I/O failure into a permanent consensus HALT.
        try { await this.persistIfChanged(); } catch { /* Preserve the notification failure. */ }
        throw primaryError;
      }
      if (this.currentStatus !== "NEEDS_UPGRADE") {
        let notificationError: unknown;
        try {
          const classification = this.options.classifySyncError?.(primaryError) ?? "CONSENSUS_STATE_ERROR";
          this.haltReason = classification === "CONSENSUS_STATE_ERROR" && primaryError instanceof IndexerError
            ? primaryError.code
            : null;
          try { await this.setStatus(classification === "TRANSIENT_SYNC_ERROR" ? "SYNCING" : "HALTED"); }
          catch (error) { notificationError = error; this.notificationFailure = undefined; }
          await this.persistIfChanged();
        } catch {
          // Persisting the classified failure state is best effort; the primary failure remains authoritative.
        }
        if (notificationError) {
          throw new AggregateError([primaryError, notificationError], "INDEXER_NON_READY_NOTIFICATION_FAILED");
        }
      }
      throw primaryError;
    }
  }

  private async assertTipDidNotMove(expectedTip: BlockReference): Promise<void> {
    const currentTip = await this.options.blockSource.getTip();
    if (!currentTip
      || currentTip.height !== expectedTip.height
      || currentTip.hash !== expectedTip.hash) {
      throw new Error("INDEXER_RPC_UNAVAILABLE:TIP_MOVED_DURING_CORE_VALIDATION");
    }
  }

  private async processBlock(block: IndexerBlock, isFinalTipBlock: boolean): Promise<boolean> {
    await this.emit({ type: "BLOCK_PROCESSING", block });
    const engineBefore = await this.options.protocolEngine.captureState();
    const cursorBefore = this.cursor.state;
    let journalAppendAttempted = false;
    try {
      const result = await this.options.protocolEngine.processBlock(block);
      if (result.status === "NEEDS_UPGRADE") {
        await this.options.protocolEngine.restoreState(engineBefore);
        await this.setStatus("NEEDS_UPGRADE");
        await this.persist();
        return false;
      }
      journalAppendAttempted = true;
      await this.options.rollbackJournal.append({ block, undoToken: result.undoToken });
      this.cursor.advance(block);
      // Commit the final block and the READY transition in one durable
      // checkpoint. Intermediate blocks remain recoverable as SYNCING.
      if (isFinalTipBlock) await this.setStatus("READY");
      await this.persist({ block: { height: block.height, hash: block.hash }, transfers: result.appliedTransfers ?? [] });
      await this.emit({ type: "BLOCK_COMMITTED", block });
      return true;
    } catch (error) {
      await this.options.protocolEngine.restoreState(engineBefore);
      if (journalAppendAttempted) await this.options.rollbackJournal.remove(block.height);
      this.cursor = new CanonicalChainCursor(cursorBefore);
      throw error;
    }
  }

  private async reorganize(): Promise<void> {
    await this.setStatus("REORGING");
    const ancestorHeight = await this.findCommonAncestor();
    if (ancestorHeight === null) {
      if (this.cursor.state.height >= this.options.startHeight) {
        throw new IndexerError("REORG_BEYOND_RETENTION", "The common ancestor is older than the retained rollback window.");
      }
      throw new IndexerError("NO_COMMON_ANCESTOR", "No common ancestor exists inside the rollback journal.");
    }
    const cursorBefore = this.cursor.state;
    if (ancestorHeight >= cursorBefore.height) {
      throw new IndexerError("NO_COMMON_ANCESTOR", "Reorganization did not identify an ancestor below the current cursor.");
    }
    const entries = await this.options.rollbackJournal.listDescending(cursorBefore.height, ancestorHeight);
    let expectedHeight = cursorBefore.height;
    for (const entry of entries) {
      if (entry.block.height !== expectedHeight) {
        throw new IndexerError("NO_COMMON_ANCESTOR", "Rollback journal is not contiguous from the current cursor.");
      }
      expectedHeight -= 1;
    }
    if (expectedHeight !== ancestorHeight) {
      throw new IndexerError("NO_COMMON_ANCESTOR", "Rollback journal cannot reach the selected common ancestor.");
    }
    const engineBefore = await this.options.protocolEngine.captureState();
    const journalBefore = await this.options.rollbackJournal.capture();
    try {
      for (const entry of entries) {
        await this.emit({ type: "ROLLBACK_STARTED", block: entry.block });
        await this.options.protocolEngine.rollbackBlock(entry.block, entry.undoToken);
        await this.options.rollbackJournal.remove(entry.block.height);
        this.cursor.rewind({ height: entry.block.height - 1, hash: entry.block.previousHash });
      }
      await this.persist();
      for (const entry of entries) await this.emit({ type: "ROLLBACK_COMMITTED", block: entry.block });
    } catch (error) {
      await this.options.protocolEngine.restoreState(engineBefore);
      await this.options.rollbackJournal.restore(journalBefore);
      this.cursor = new CanonicalChainCursor(cursorBefore);
      throw error;
    }
    await this.setStatus("SYNCING");
  }

  private async findCommonAncestor(): Promise<number | null> {
    const oldestRetainedHeight = this.options.rollbackJournal.oldestHeight();
    const lowerBound = oldestRetainedHeight ?? this.options.startHeight;
    for (let height = this.cursor.state.height; height >= lowerBound; height -= 1) {
      const [canonical, journalEntry] = await Promise.all([
        this.options.blockSource.getBlock(height),
        this.options.rollbackJournal.get(height),
      ]);
      if (canonical && journalEntry && canonical.hash === journalEntry.block.hash) return height;
    }
    if (oldestRetainedHeight !== null) {
      const oldestEntry = await this.options.rollbackJournal.get(oldestRetainedHeight);
      if (!oldestEntry) return null;
      const anchorHeight = oldestRetainedHeight - 1;
      if (anchorHeight >= this.options.startHeight) {
        const canonicalAnchor = await this.options.blockSource.getBlock(anchorHeight);
        return canonicalAnchor?.hash === oldestEntry.block.previousHash ? anchorHeight : null;
      }
      const first = await this.options.blockSource.getBlock(this.options.startHeight);
      return first?.previousHash === oldestEntry.block.previousHash ? anchorHeight : null;
    }
    const first = await this.options.blockSource.getBlock(this.options.startHeight);
    return first?.previousHash === this.options.anchorHash ? this.options.startHeight - 1 : null;
  }

  private async persist(delta?: BlockTransferDelta): Promise<void> {
    const rollbackEntries = this.options.rollbackJournal.captureForPersistence
      ? await this.options.rollbackJournal.captureForPersistence()
      : await this.options.rollbackJournal.capture();
    const rollbackRetention = deriveRollbackRetentionWindow(
      this.options.startHeight,
      this.cursor.state.height,
      this.options.rollbackRetentionDepth,
      rollbackEntries,
    );
    const snapshot: IndexerSnapshot = {
      schemaVersion: this.options.storage.externalTransferHistory ? 2 : 1,
      status: this.currentStatus,
      cursor: this.cursor.state,
      engineState: await this.options.protocolEngine.captureState(),
      rollbackEntries,
      rollbackRetention,
      ...(this.haltReason ? { haltReason: this.haltReason } : {}),
    };
    await this.options.storage.saveSnapshot(snapshot, delta);
    this.lastPersistedState = {
      status: snapshot.status,
      height: snapshot.cursor.height,
      hash: snapshot.cursor.hash,
      haltReason: snapshot.haltReason ?? null,
    };
    const pruned = rollbackRetention.oldestRetainedHeight === null
      ? 0
      : this.options.rollbackJournal.pruneBelow(rollbackRetention.oldestRetainedHeight);
    if (pruned > 0) {
      this.pruneCount += 1;
      this.prunedEntriesTotal += pruned;
    }
    await this.emit({
      type: "JOURNAL_PRUNED",
      retentionDepth: this.options.rollbackRetentionDepth,
      oldestRetainedHeight: rollbackRetention.oldestRetainedHeight,
      journalSize: this.options.rollbackJournal.size(),
      pruneCount: this.pruneCount,
      prunedEntriesTotal: this.prunedEntriesTotal,
    });
  }

  private async persistIfChanged(): Promise<void> {
    const persisted = this.lastPersistedState;
    const cursor = this.cursor.state;
    if (persisted
      && persisted.status === this.currentStatus
      && persisted.height === cursor.height
      && persisted.hash === cursor.hash
      && persisted.haltReason === this.haltReason) {
      return;
    }
    await this.persist();
  }

  private async setStatus(status: IndexerStatus, syncTarget?: BlockReference): Promise<void> {
    const previous = this.currentStatus;
    const hadSyncTarget = this.syncingNextTip !== undefined;
    this.syncingNextTip = status === 'SYNCING' ? syncTarget : undefined;
    this.currentStatus = status;
    if (status !== "HALTED") this.haltReason = null;
    if (status !== "READY" && (previous !== status || hadSyncTarget || this.syncingNextTip !== undefined)) {
      try { await this.options.onNonReadyStatus?.(status, this.syncingNextTip); }
      catch (error) { this.notificationFailure = error; throw error; }
    }
    await this.emit({ type: "STATUS_CHANGED", status });
  }

  private async emit(event: Parameters<LifecycleObserver["onEvent"]>[0]): Promise<void> {
    try { await this.options.observer?.onEvent(event); }
    catch { /* Telemetry observers cannot alter indexer state transitions. */ }
  }
}
