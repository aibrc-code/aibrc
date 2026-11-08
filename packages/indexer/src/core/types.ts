export type IndexerStatus =
  | "SYNCING"
  | "READY"
  | "NEEDS_UPGRADE"
  | "REORGING"
  | "HALTED";

export type IndexerSyncErrorClassification =
  | "TRANSIENT_SYNC_ERROR"
  | "CONSENSUS_STATE_ERROR";

export interface BlockTransaction {
  readonly txid: string;
  readonly rawHex?: string;
  readonly metadata?: unknown;
}

export interface IndexerBlock {
  readonly height: number;
  readonly hash: string;
  readonly previousHash: string | null;
  readonly transactions: readonly BlockTransaction[];
}

export interface BlockReference {
  readonly height: number;
  readonly hash: string;
}

export interface BlockSource {
  getTip(): Promise<BlockReference | null>;
  getBlock(height: number): Promise<IndexerBlock | null>;
}

export interface CursorState {
  readonly height: number;
  readonly hash: string | null;
}

export interface ProtocolEngineProcessed {
  readonly status: "PROCESSED";
  readonly undoToken: unknown;
  /** Effects of this block only; never a cumulative history or part of undo. */
  readonly appliedTransfers?: readonly unknown[];
}

export interface ProtocolEngineNeedsUpgrade {
  readonly status: "NEEDS_UPGRADE";
  readonly reason: string;
}

export type ProtocolEngineResult = ProtocolEngineProcessed | ProtocolEngineNeedsUpgrade;

export interface ProtocolEngine {
  processBlock(block: IndexerBlock): Promise<ProtocolEngineResult>;
  rollbackBlock(block: IndexerBlock, undoToken: unknown): Promise<void>;
  captureState(): Promise<unknown>;
  restoreState(state: unknown): Promise<void>;
  /** Persistent adapters own history; in-memory reference users are unchanged. */
  useExternalTransferHistory?(): void;
}

export interface RollbackJournalEntry {
  readonly block: IndexerBlock;
  readonly undoToken: unknown;
}

export interface RollbackJournal {
  append(entry: RollbackJournalEntry): Promise<void>;
  get(height: number): Promise<RollbackJournalEntry | null>;
  listDescending(fromHeight: number, exclusiveLowerBound: number): Promise<readonly RollbackJournalEntry[]>;
  remove(height: number): Promise<void>;
  capture(): Promise<readonly RollbackJournalEntry[]>;
  /** Read-only view for immediate persistence; callers must not mutate entries. */
  captureForPersistence?(): Promise<readonly RollbackJournalEntry[]>;
  restore(entries: readonly RollbackJournalEntry[]): Promise<void>;
  pruneBelow(oldestRetainedUndoHeight: number): number;
  oldestHeight(): number | null;
  newestHeight(): number | null;
  size(): number;
}

export interface RollbackRetentionWindow {
  readonly depth: number;
  readonly oldestRetainedHeight: number | null;
  readonly anchorHeight: number;
}

export interface IndexerSnapshot {
  readonly schemaVersion: 1 | 2;
  readonly status: IndexerStatus;
  readonly cursor: CursorState;
  readonly engineState: unknown;
  readonly rollbackEntries: readonly RollbackJournalEntry[];
  readonly rollbackRetention?: RollbackRetentionWindow;
  readonly haltReason?: IndexerErrorCode;
}

export interface StorageAdapter {
  readonly externalTransferHistory?: true;
  loadSnapshot(): Promise<IndexerSnapshot | null>;
  saveSnapshot(snapshot: IndexerSnapshot, delta?: BlockTransferDelta): Promise<void>;
}

export interface BlockTransferDelta {
  readonly block: BlockReference;
  readonly transfers: readonly unknown[];
}

export type BlockLifecycleEvent =
  | { readonly type: "STATUS_CHANGED"; readonly status: IndexerStatus }
  | { readonly type: "BLOCK_PROCESSING"; readonly block: IndexerBlock }
  | { readonly type: "BLOCK_COMMITTED"; readonly block: IndexerBlock }
  | { readonly type: "ROLLBACK_STARTED"; readonly block: IndexerBlock }
  | { readonly type: "ROLLBACK_COMMITTED"; readonly block: IndexerBlock }
  | {
      readonly type: "JOURNAL_PRUNED";
      readonly retentionDepth: number;
      readonly oldestRetainedHeight: number | null;
      readonly journalSize: number;
      readonly pruneCount: number;
      readonly prunedEntriesTotal: number;
    };

export interface LifecycleObserver {
  /** Observers are side-effect-free telemetry hooks and must not throw or reject. */
  onEvent(event: BlockLifecycleEvent): void | Promise<void>;
}

export type IndexerErrorCode =
  | "INVALID_BLOCK_HEIGHT"
  | "HEIGHT_DISCONTINUITY"
  | "HASH_DISCONTINUITY"
  | "BLOCK_NOT_FOUND"
  | "NO_COMMON_ANCESTOR"
  | "REORG_BEYOND_RETENTION"
  | "INVALID_ROLLBACK_RETENTION_DEPTH"
  | "SNAPSHOT_INCOMPATIBLE"
  | "INDEXER_HALTED";

export class IndexerError extends Error {
  constructor(
    public readonly code: IndexerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "IndexerError";
  }
}
