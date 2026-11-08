import { mkdirSync,existsSync,openSync,closeSync,fsyncSync,linkSync,unlinkSync,createReadStream } from "node:fs";
import {createHash} from 'node:crypto';
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { backup, DatabaseSync } from "node:sqlite";
import {
  assertRollbackRetentionDepth,
  deriveRollbackRetentionWindow,
  type IndexerSnapshot,
  type RollbackJournalEntry,
  type RollbackRetentionWindow,
  type StorageAdapter,
  type BlockTransferDelta,
} from "../core/index.js";
import {
  assertEngineSnapshotAuthorizationRule,
  protocolStateFromCanonicalBytes,
  type IndexedTransferRecord,
  type SerializedEngineSnapshot,
} from "../engine/index.js";
import { deriveStateHash, INPUT_AUTHORIZATION_RULE_ID, MAX_ALLOCATIONS, MAX_U128 } from "@aibrc/protocol";
import { ensureQueryProjectionColumns, QUERY_PROJECTION_SCHEMA, QUERY_PROJECTION_VERSION, queryOutcomeEvidenceHash, syncQueryProjection } from "./query-projection.js";
import type { BlockCoverageContract, BlockOutcomeContract, HeightIntervalQuery, QuerySnapshotContract, RecipientTransferContract, RecipientTransferQuery, QueryProjectionDiagnosticContract, QueryHistoryResetDiagnosticContract, CompleteProjectionCoverageContract } from "../query/contracts.js";
import type {TransferPageContract,TransferQuery} from '../query/contracts.js';
import {TRANSFER_HISTORY_SCHEMA,appendTransfers,assertLegacyHistoryMatches,completeExportSnapshot,currentSnapshot,
  rebuildTransferAccounts,storeBlockStateHashes,transferPage,type TransferRow} from './transfer-history.js';

const DATABASE_SCHEMA_VERSION = 2;
const HASH_256_PATTERN = /^[0-9a-f]{64}$/;
const HASH_TEXT_HEX_PATTERN = /^(?:(?:3[0-9])|(?:6[1-6])){64}$/;
// Projection reconciliation must not materialize every persisted key at once.
// Each SELECT is allowed to finish before any DELETE touches the same table;
// interleaving sqlite3_step() with same-connection writes has undefined result
// visibility in SQLite.
const PROJECTION_KEYSET_BATCH_SIZE = 256;

function validOutcomeEvidence(record: BlockOutcomeContract, evidenceHash: string): boolean {
  const validOutpoint = (point: BlockOutcomeContract["authInputOutpoint"]) => point !== null
    && typeof point === "object" && HASH_256_PATTERN.test(point.txidDisplayBytes)
    && Number.isSafeInteger(point.vout) && point.vout >= 0 && point.vout <= 0xffff_ffff;
  if (!Number.isSafeInteger(record.recognizedMarkerCount) || record.recognizedMarkerCount < 1
    || (record.inputEvidence !== "COMPLETE" && record.inputEvidence !== "UNKNOWN")
    || (record.authorizationEvidence !== "COMPLETE" && record.authorizationEvidence !== "UNKNOWN")
    || (record.inputEvidence === "UNKNOWN" && (record.inputCount !== null || record.inputOutpoints !== null || record.authorizationEvidence !== "UNKNOWN"))
    || (record.inputEvidence === "COMPLETE" && (!Array.isArray(record.inputOutpoints)
      || !Number.isSafeInteger(record.inputCount) || record.inputCount! < 0
      || record.inputOutpoints.length !== record.inputCount || !record.inputOutpoints.every(validOutpoint)))
    || (record.authorizationEvidence === "UNKNOWN" && (record.authInputIndex !== null || record.authInputOutpoint !== null))) return false;
  if (record.authorizationEvidence === "COMPLETE") {
    if (record.inputEvidence !== "COMPLETE" || !Number.isSafeInteger(record.authInputIndex)
      || record.authInputIndex! < 0 || record.authInputIndex! >= record.inputCount! || !validOutpoint(record.authInputOutpoint)) return false;
    const selected = record.inputOutpoints![record.authInputIndex!]!;
    if (selected.txidDisplayBytes !== record.authInputOutpoint!.txidDisplayBytes || selected.vout !== record.authInputOutpoint!.vout) return false;
  }
  return HASH_256_PATTERN.test(evidenceHash) && queryOutcomeEvidenceHash(record) === evidenceHash;
}

type SingleProjectionKeyTable =
  | Readonly<{ table: "assets"; column: "asset_id" }>
  | Readonly<{ table: "canonical_names"; column: "name" }>
  | Readonly<{ table: "locators"; column: "locator_key" }>
  | Readonly<{ table: "transfers"; column: "txid" }>;

export interface SqliteIndexerStorageOptions {
  readonly path: string;
  readonly network: "signet" | "mainnet" | "regtest";
  readonly explicitNetworkIdentity?: true;
  readonly activationHeight: number;
  readonly rollbackRetentionDepth: number;
  readonly readOnly?: boolean;
  readonly memoryTelemetry?: boolean;
  /** Public runtime pins the complete rules context, not just network/height. */
  readonly runtimeIdentity?: string;
}

export interface SqliteCommittedStateDescriptor {
  readonly inputAuthorizationRuleId: string;
  readonly status: IndexerSnapshot["status"];
  readonly network: "signet" | "mainnet" | "regtest";
  readonly activationHeight: number;
  readonly canonicalHeight: number;
  readonly canonicalBlockHash: string;
  readonly stateHash: string;
  readonly assetCount: number;
  readonly positiveBalanceCount: number;
  readonly transferCount: number;
  readonly rollbackRetentionDepth: number;
  readonly oldestRetainedHeight: number | null;
}

export interface SqliteCommittedStateHead {
  readonly inputAuthorizationRuleId: string | null;
  readonly status: IndexerSnapshot["status"];
  readonly network: "signet" | "mainnet" | "regtest";
  readonly activationHeight: number;
  readonly canonicalHeight: number;
  readonly canonicalBlockHash: string | null;
  readonly lastVerifiedHeight: number | null;
  readonly stateHash: string;
  readonly rollbackRetentionDepth: number;
  readonly oldestRetainedHeight: number | null;
}

function encode(value: unknown): string {
  return JSON.stringify(value, (_key, item) => typeof item === "bigint" ? { $aibrcBigInt: item.toString() } : item);
}

function decode<T>(value: string): T {
  return JSON.parse(value, (_key, item: unknown) => {
    if (item && typeof item === "object" && Object.keys(item).length === 1 && "$aibrcBigInt" in item) {
      const decimal = (item as { $aibrcBigInt: unknown }).$aibrcBigInt;
      if (typeof decimal !== "string" || !/^(0|[1-9][0-9]*)$/.test(decimal)) throw new Error("INVALID_PERSISTED_BIGINT");
      return BigInt(decimal);
    }
    return item;
  }) as T;
}

function backupDigest(path:string):Promise<string> {
  return new Promise((resolve,reject)=>{
    const digest=createHash('sha256'),stream=createReadStream(path);
    stream.on('data',(chunk:Buffer|string)=>{digest.update(chunk);});
    stream.on('error',reject);stream.on('end',()=>resolve(digest.digest('hex')));
  });
}

function engineSnapshot(snapshot: IndexerSnapshot, activationHeight: number): SerializedEngineSnapshot {
  const engine = snapshot.engineState as SerializedEngineSnapshot;
  if (!engine || (engine.schemaVersion !== 1 && engine.schemaVersion !== 2) || engine.schemaVersion !== snapshot.schemaVersion
    || (engine.schemaVersion === 2 && (!Array.isArray(engine.transferRecords) || engine.transferRecords.length !== 0))
    || typeof engine.protocolStateHex !== "string" || typeof engine.stateHash !== "string") {
    throw new Error("INVALID_ENGINE_SNAPSHOT");
  }
  assertEngineSnapshotAuthorizationRule(engine);
  if (engine.inputAuthorizationRuleId === undefined
    && (snapshot.status === "READY" || snapshot.cursor.height !== activationHeight - 1 || snapshot.rollbackEntries.length !== 0)) {
    throw new Error("SQLITE_INPUT_AUTHORIZATION_RULE_MISMATCH");
  }
  for (const entry of snapshot.rollbackEntries) assertEngineSnapshotAuthorizationRule(entry.undoToken);
  const state = protocolStateFromCanonicalBytes(Buffer.from(engine.protocolStateHex, "hex"));
  if (deriveStateHash(state) !== engine.stateHash) throw new Error("PERSISTED_STATE_HASH_MISMATCH");
  return engine;
}

export class SqliteIndexerStorage implements StorageAdapter {
  readonly externalTransferHistory = true as const;
  private readonly db: DatabaseSync;
  private readonly readOnly: boolean;
  private pruneCount = 0;
  private prunedEntriesTotal = 0;
  readonly path: string;
  private legacySchema = false;
  private upgradePromise: Promise<void> | null = null;
  private upgradeBackup: string | null = null;

  get legacyBackupPath(): string | null { return this.upgradeBackup; }

  constructor(private readonly options: SqliteIndexerStorageOptions) {
    if (options.network !== "signet" && options.explicitNetworkIdentity !== true) throw new Error("NON_SIGNET_DATABASE_REJECTED");
    if (options.network !== "signet" && options.network !== "mainnet" && options.network !== "regtest") throw new Error("INDEXER_NETWORK_IDENTITY_MISMATCH");
    if (!Number.isSafeInteger(options.activationHeight) || options.activationHeight < 0) throw new Error("INVALID_ACTIVATION_HEIGHT");
    assertRollbackRetentionDepth(options.rollbackRetentionDepth);
    this.path = options.path === ":memory:" ? options.path : resolve(options.path);
    this.readOnly = options.readOnly ?? false;
    if (this.readOnly && this.path === ":memory:") throw new Error("READ_ONLY_STORAGE_REQUIRES_FILE");
    if (!this.readOnly && this.path !== ":memory:") mkdirSync(dirname(this.path), { recursive: true });
    this.db = new DatabaseSync(this.path, { readOnly: this.readOnly });
    try {
      const metadataExists = this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='metadata'").get();
      const version = metadataExists ? this.metadata('schema_version') : null;
      if (version !== null && version !== '1' && version !== '2') throw new Error('SQLITE_SCHEMA_VERSION_MISMATCH');
      this.legacySchema = version === '1';
      this.db.exec(this.readOnly
        ? "PRAGMA busy_timeout=5000; PRAGMA query_only=ON; PRAGMA foreign_keys=ON;"
        : this.legacySchema ? "PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;"
        : "PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;");
      if (!this.readOnly && !this.legacySchema) this.createSchema();
      this.verifyManifestIdentity();
    } catch (error) {
      try { this.db.close(); } catch { /* preserve the initialization error */ }
      throw error;
    }
  }

  async loadSnapshot(): Promise<IndexerSnapshot | null> {
    await this.upgradeLegacyIfNeeded();
    return this.loadVerifiedSnapshot();
  }

  private loadVerifiedSnapshot(): IndexerSnapshot | null {
    const row = this.db.prepare("SELECT snapshot_json FROM snapshots WHERE singleton = 1").get() as { snapshot_json?: string } | undefined;
    if (!row?.snapshot_json) return null;
    const stored = decode<IndexerSnapshot>(row.snapshot_json);
    const snapshot = stored.rollbackEntries.length > 0
      ? stored
      : {
          ...stored,
          rollbackEntries: (this.db.prepare("SELECT entry_json FROM rollback_journal ORDER BY height ASC").all() as Array<{ entry_json: string }>)
            .map((entry) => decode<IndexerSnapshot["rollbackEntries"][number]>(entry.entry_json)),
        };
    if (snapshot.schemaVersion !== 1 && snapshot.schemaVersion !== 2) throw new Error("UNSUPPORTED_SNAPSHOT_SCHEMA");
    this.verifyLoadedRetention(snapshot, stored.rollbackRetention !== undefined);
    const engine = engineSnapshot(snapshot, this.options.activationHeight);
    const authorizationRule = this.metadata("input_authorization_rule_id");
    if ((engine.inputAuthorizationRuleId ?? null) !== (authorizationRule || null)) {
      throw new Error("SQLITE_INPUT_AUTHORIZATION_RULE_MISMATCH");
    }
    const metadataHash = this.metadata("state_hash");
    if (metadataHash !== engine.stateHash) throw new Error("SQLITE_STATE_HASH_MISMATCH");
    return snapshot;
  }

  async saveSnapshot(snapshot: IndexerSnapshot,delta?:BlockTransferDelta): Promise<void> {
    await this.upgradeLegacyIfNeeded();
    this.saveSnapshotState(snapshot,delta);
  }

  private saveSnapshotState(input:IndexerSnapshot,delta?:BlockTransferDelta,withinTransaction=false):void {
    this.requireWritable();
    if (input.schemaVersion !== 1 && input.schemaVersion !== 2) throw new Error("UNSUPPORTED_SNAPSHOT_SCHEMA");
    const totalStartedAt = performance.now();
    const stateHashStartedAt = performance.now();
    const originalEngine = engineSnapshot(input, this.options.activationHeight);
    // V1 is an explicit full import into an empty store (or the checked one-way
    // converter), never a runtime checkpoint which can erase v2 history.
    if (input.schemaVersion === 1 && !withinTransaction && this.db.prepare('SELECT 1 FROM snapshots WHERE singleton=1').get()) {
      throw new Error('UNSUPPORTED_SNAPSHOT_SCHEMA');
    }
    const legacyTransfers = originalEngine.schemaVersion === 1 ? originalEngine.transferRecords : undefined;
    if (legacyTransfers?.some(row=>row.blockHeight<this.options.activationHeight||row.blockHeight>input.cursor.height)) throw Error('SQLITE_EXACT_TRANSFER_IDENTITY_MISMATCH');
    const snapshot = currentSnapshot(input);
    const engine = snapshot.engineState as SerializedEngineSnapshot;
    if (delta && (delta.block.height !== snapshot.cursor.height || delta.block.hash !== snapshot.cursor.hash)) throw Error('SQLITE_EXACT_TRANSFER_IDENTITY_MISMATCH');
    const stateHashValidationMs = performance.now() - stateHashStartedAt;
    const state = protocolStateFromCanonicalBytes(Buffer.from(engine.protocolStateHex, "hex"));
    const rollbackRetention = deriveRollbackRetentionWindow(
      this.options.activationHeight,
      snapshot.cursor.height,
      this.options.rollbackRetentionDepth,
      snapshot.rollbackEntries,
    );
    if (snapshot.rollbackRetention && !this.sameRetentionWindow(snapshot.rollbackRetention, rollbackRetention)) {
      throw new Error("ROLLBACK_RETENTION_WINDOW_MISMATCH");
    }
    const retainedEntries = this.retainedEntries(snapshot.rollbackEntries, snapshot.cursor.height, rollbackRetention);
    const tipEntry = retainedEntries.find((entry) => entry.block.height === snapshot.cursor.height);
    const parentHash = rollbackRetention.oldestRetainedHeight === null
      ? null
      : tipEntry?.block.previousHash ?? this.persistedParentHash(snapshot.cursor.height, snapshot.cursor.hash);
    const anchorHash = rollbackRetention.oldestRetainedHeight === null
      ? snapshot.cursor.hash
      : retainedEntries.find((entry) => entry.block.height === rollbackRetention.oldestRetainedHeight)?.block.previousHash ?? null;
    if (snapshot.cursor.height >= this.options.activationHeight && !anchorHash) throw new Error("ROLLBACK_RETENTION_ANCHOR_REQUIRED");
    const serializationStartedAt = performance.now();
    const snapshotJson = encode({ ...snapshot, rollbackEntries: [], rollbackRetention });
    const snapshotSerializationMs = performance.now() - serializationStartedAt;
    const transactionStartedAt = performance.now();
    let prunedEntries = 0;
    const changedRows = {
      snapshot: 0,
      metadata: 0,
      canonicalBlocks: 0,
      rollbackJournal: 0,
      assets: 0,
      canonicalNames: 0,
      locators: 0,
      balances: 0,
      transfers: 0,
    };
    const commit = () => {
      // Compare against the PRIOR canonical commit, before overwriting its head.
      // An older writer can reorg/prune blocks without maintaining these tables.
      this.invalidateUnmaintainedQueryProjection();
      changedRows.assets += this.syncAssets(engine.indexedAssets);
      changedRows.canonicalNames += this.syncCanonicalNames(state.assetIdByName);
      changedRows.locators += this.syncLocators(state.assetIdByLocator);
      changedRows.balances += this.syncBalances(state.balances);
      if (legacyTransfers) {
        changedRows.transfers += this.syncTransfers(legacyTransfers);
        rebuildTransferAccounts(this.db);
      } else changedRows.transfers += appendTransfers(this.db,snapshot.cursor.height,delta);
      storeBlockStateHashes(this.db,snapshot,this.options.activationHeight,legacyTransfers !== undefined);
      syncQueryProjection(this.db, engine, retainedEntries, snapshot.cursor.height);
      changedRows.snapshot += Number(this.db.prepare(`
        INSERT INTO snapshots(singleton, snapshot_json, protocol_state, state_hash) VALUES(1, ?, ?, ?)
        ON CONFLICT(singleton) DO UPDATE SET
          snapshot_json = excluded.snapshot_json,
          protocol_state = excluded.protocol_state,
          state_hash = excluded.state_hash
        WHERE snapshots.snapshot_json IS NOT excluded.snapshot_json
          OR snapshots.protocol_state IS NOT excluded.protocol_state
          OR snapshots.state_hash IS NOT excluded.state_hash
      `).run(snapshotJson, Buffer.from(engine.protocolStateHex, "hex"), engine.stateHash).changes);
      const metadata = this.db.prepare(`
        INSERT INTO metadata(key, value) VALUES(?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        WHERE metadata.value IS NOT excluded.value
      `);
      for (const [key, value] of [
        ["indexer_status", snapshot.status],
        ["canonical_height", snapshot.cursor.height.toString()],
        ["canonical_block_hash", snapshot.cursor.hash ?? ""],
        ["parent_hash", parentHash ?? ""],
        ["last_verified_height", engine.lastVerifiedHeight?.toString() ?? ""],
        ["state_hash", engine.stateHash],
        ["input_authorization_rule_id", engine.inputAuthorizationRuleId ?? ""],
        ["rollback_retention_depth", rollbackRetention.depth.toString()],
        ["oldest_retained_undo_height", rollbackRetention.oldestRetainedHeight?.toString() ?? ""],
        ["canonical_anchor_height", rollbackRetention.anchorHeight.toString()],
        ["canonical_anchor_hash", anchorHash ?? ""],
      ] as Array<[string, string]>) changedRows.metadata += Number(metadata.run(key, value).changes);

      let rollbackDeletes = 0;
      if (rollbackRetention.oldestRetainedHeight === null) {
        rollbackDeletes = Number(this.db.prepare("DELETE FROM rollback_journal").run().changes);
      } else {
        const lowDelete = this.db.prepare("DELETE FROM rollback_journal WHERE height < ?")
          .run(rollbackRetention.oldestRetainedHeight);
        prunedEntries = Number(lowDelete.changes);
        rollbackDeletes = prunedEntries + Number(this.db.prepare("DELETE FROM rollback_journal WHERE height > ?")
          .run(snapshot.cursor.height).changes);
      }
      changedRows.rollbackJournal += rollbackDeletes;
      changedRows.canonicalBlocks += rollbackRetention.oldestRetainedHeight === null
        ? Number(this.db.prepare("DELETE FROM canonical_blocks").run().changes)
        : Number(this.db.prepare("DELETE FROM canonical_blocks WHERE height < ? OR height > ?")
          .run(rollbackRetention.oldestRetainedHeight, snapshot.cursor.height).changes);
      const blockInsert = this.db.prepare(`
        INSERT INTO canonical_blocks(height, hash, parent_hash, block_json) VALUES(?, ?, ?, ?)
        ON CONFLICT(height) DO UPDATE SET
          hash = excluded.hash,
          parent_hash = excluded.parent_hash,
          block_json = excluded.block_json
        WHERE canonical_blocks.hash IS NOT excluded.hash
          OR canonical_blocks.parent_hash IS NOT excluded.parent_hash
          OR canonical_blocks.block_json IS NOT excluded.block_json
      `);
      const journalInsert = this.db.prepare(`
        INSERT INTO rollback_journal(height, block_hash, entry_json) VALUES(?, ?, ?)
        ON CONFLICT(height) DO UPDATE SET
          block_hash = excluded.block_hash,
          entry_json = excluded.entry_json
        WHERE rollback_journal.block_hash IS NOT excluded.block_hash
          OR rollback_journal.entry_json IS NOT excluded.entry_json
      `);
      for (const entry of retainedEntries) {
        const oldBlock = this.db.prepare('SELECT hash FROM canonical_blocks WHERE height=?').get(entry.block.height);
        const oldUndo = this.db.prepare('SELECT block_hash FROM rollback_journal WHERE height=?').get(entry.block.height);
        if (input.schemaVersion === 1 || oldBlock?.hash !== entry.block.hash) changedRows.canonicalBlocks += Number(blockInsert
          .run(entry.block.height, entry.block.hash, entry.block.previousHash, encode(entry.block)).changes);
        if (input.schemaVersion === 1 || oldUndo?.block_hash !== entry.block.hash) changedRows.rollbackJournal += Number(journalInsert
          .run(entry.block.height, entry.block.hash, encode(entry)).changes);
      }
      metadata.run("query_projection_version", QUERY_PROJECTION_VERSION);
      metadata.run("query_projection_height", snapshot.cursor.height.toString());
      metadata.run("query_projection_hash", snapshot.cursor.hash ?? "");
      metadata.run("query_projection_state_hash", engine.stateHash);
    };
    if (withinTransaction) commit(); else this.transaction(commit);
    if (prunedEntries > 0) {
      this.pruneCount += 1;
      this.prunedEntriesTotal += prunedEntries;
    }
    if (this.options.memoryTelemetry === true) {
      console.error(`INDEXER_PERSIST_TELEMETRY ${JSON.stringify({
        capturedAt: new Date().toISOString(),
        height: snapshot.cursor.height,
        rollbackEntries: retainedEntries.length,
        retentionDepth: rollbackRetention.depth,
        oldestRetainedHeight: rollbackRetention.oldestRetainedHeight,
        journalSize: retainedEntries.length,
        pruneCount: this.pruneCount,
        prunedEntriesTotal: this.prunedEntriesTotal,
        snapshotJsonCharacters: snapshotJson.length,
        stateHashValidationMs,
        snapshotSerializationMs,
        sqliteTransactionMs: performance.now() - transactionStartedAt,
        totalMs: performance.now() - totalStartedAt,
        changedRows,
        memory: process.memoryUsage(),
      })}`);
    }
  }

  exportSnapshot(): string | null {
    this.db.exec('BEGIN');
    try {
      const snapshot = this.loadVerifiedSnapshot();
      const exported = snapshot ? encode(completeExportSnapshot(this.db,snapshot)) : null;
      this.db.exec('COMMIT');
      return exported;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  async backupTo(path: string): Promise<void> {
    this.requireWritable();
    await backup(this.db, resolve(path));
  }

  /** Keep all offline reads on one committed generation while a writer follows. */
  beginReadSnapshot(): void {
    if (!this.readOnly) throw new Error("READ_SNAPSHOT_REQUIRES_READ_ONLY_STORAGE");
    this.db.exec("BEGIN");
  }

  private async upgradeLegacyIfNeeded():Promise<void> {
    // Immutable v1 replicas/explicit exports remain readable. Only a writable
    // source performs conversion, before its first load/checkpoint is returned.
    if (!this.legacySchema || this.readOnly) return;
    this.upgradePromise ??= this.upgradeLegacy();
    await this.upgradePromise;
  }

  private async upgradeLegacy():Promise<void> {
    let begun = false;
    try {
      this.db.exec('BEGIN IMMEDIATE'); begun = true;
      if (this.metadata('schema_version') === '2') {
        this.db.exec('COMMIT'); begun = false; this.legacySchema = false; return;
      }
      // Backup precedes ALL old snapshot/transfer decoding. Even malformed or
      // too-large old material must not make us skip its complete backup.
      const temporary = this.path+'.v1-backup.partial';
      if (existsSync(temporary)) unlinkSync(temporary);
      const fd = openSync(temporary,'wx',0o600); closeSync(fd);
      const source = new SqliteIndexerStorage({...this.options,readOnly:false,memoryTelemetry:false});
      try { await source.backupTo(temporary); } finally { source.close(); }
      const backupFd = openSync(temporary,'r');
      try { fsyncSync(backupFd); } finally { closeSync(backupFd); }
      const digest = await backupDigest(temporary);
      const destination = `${this.path}.v1-${digest}.backup.sqlite`;
      if (existsSync(destination)) {
        if (await backupDigest(destination)!==digest) throw Error('INDEXER_V1_UPGRADE_BACKUP_MISMATCH');
      } else linkSync(temporary,destination);
      unlinkSync(temporary);
      const directoryFd = openSync(dirname(destination),'r');
      try { fsyncSync(directoryFd); } finally { closeSync(directoryFd); }
      this.upgradeBackup = destination;
      const raw = this.db.prepare('SELECT snapshot_json FROM snapshots WHERE singleton=1').get() as {snapshot_json:string}|undefined;
      const old = this.loadVerifiedSnapshot();
      const records = old ? (old.engineState as SerializedEngineSnapshot).transferRecords : [];
      assertLegacyHistoryMatches(this.db,records);
      // A reused completed backup must still represent this exact old state.
      const saved = new SqliteIndexerStorage({...this.options,path:destination,readOnly:true,memoryTelemetry:false});
      try {
        const savedRaw = saved.db.prepare('SELECT snapshot_json FROM snapshots WHERE singleton=1').get() as {snapshot_json:string}|undefined;
        if (!saved.legacySchema || savedRaw?.snapshot_json !== raw?.snapshot_json) throw Error('INDEXER_V1_UPGRADE_BACKUP_MISMATCH');
        assertLegacyHistoryMatches(saved.db,records);
        const journal = this.db.prepare('SELECT height,block_hash,entry_json FROM rollback_journal ORDER BY height').all();
        const savedJournal = saved.db.prepare('SELECT height,block_hash,entry_json FROM rollback_journal ORDER BY height').all();
        if (encode(journal)!==encode(savedJournal)) throw Error('INDEXER_V1_UPGRADE_BACKUP_MISMATCH');
      } finally { saved.close(); }
      this.db.exec('DROP INDEX IF EXISTS transfers_height_idx');
      this.createSchema();
      if (old) this.saveSnapshotState(old,undefined,true);
      this.db.prepare("UPDATE metadata SET value='2' WHERE key='schema_version'").run();
      this.db.exec('COMMIT');
      begun = false;
      this.legacySchema = false;
    } catch (error) {
      if (begun) try { this.db.exec('ROLLBACK'); } catch { /* preserve conversion failure */ }
      throw new Error('INDEXER_V1_UPGRADE_FAILED', {cause:error});
    }
  }

  /**
   * Reads only the small, transactionally committed identity fields needed by a
   * same-tip follower/replica heartbeat.  Deliberately does not select or decode
   * snapshot_json, protocol_state, rollback entry JSON, or projection counts.
   */
  readCommittedHead(): SqliteCommittedStateHead | null {
    // One SELECT gives cross-process healthchecks one coherent WAL snapshot;
    // separate autocommit SELECTs could otherwise straddle a block commit and
    // falsely compare the old snapshot hash with the new metadata head.
    const row = this.db.prepare(`
      SELECT
        (SELECT state_hash FROM snapshots INDEXED BY snapshots_committed_head_idx
          WHERE singleton = 1) AS snapshot_state_hash,
        (SELECT value FROM metadata WHERE key = 'indexer_status') AS indexer_status,
        (SELECT value FROM metadata WHERE key = 'canonical_height') AS canonical_height,
        (SELECT value FROM metadata WHERE key = 'canonical_block_hash') AS canonical_block_hash,
        (SELECT value FROM metadata WHERE key = 'last_verified_height') AS last_verified_height,
        (SELECT value FROM metadata WHERE key = 'state_hash') AS metadata_state_hash,
        (SELECT value FROM metadata WHERE key = 'input_authorization_rule_id') AS input_authorization_rule_id,
        (SELECT value FROM metadata WHERE key = 'rollback_retention_depth') AS rollback_retention_depth,
        (SELECT value FROM metadata WHERE key = 'oldest_retained_undo_height') AS oldest_retained_undo_height,
        (SELECT value FROM metadata WHERE key = 'parent_hash') AS parent_hash,
        (SELECT value FROM metadata WHERE key = 'canonical_anchor_height') AS canonical_anchor_height,
        (SELECT value FROM metadata WHERE key = 'canonical_anchor_hash') AS canonical_anchor_hash,
        (SELECT COUNT(*) FROM canonical_blocks INDEXED BY canonical_committed_head_idx) AS canonical_count,
        (SELECT MIN(height) FROM canonical_blocks INDEXED BY canonical_committed_head_idx) AS canonical_min_height,
        (SELECT MAX(height) FROM canonical_blocks INDEXED BY canonical_committed_head_idx) AS canonical_max_height,
        (SELECT hash FROM canonical_blocks INDEXED BY canonical_committed_head_idx
          WHERE height = CAST((SELECT value FROM metadata WHERE key = 'canonical_height') AS INTEGER)) AS canonical_row_hash,
        (SELECT parent_hash FROM canonical_blocks INDEXED BY canonical_committed_head_idx
          WHERE height = CAST((SELECT value FROM metadata WHERE key = 'canonical_height') AS INTEGER)) AS canonical_tip_parent_hash,
        (SELECT parent_hash FROM canonical_blocks INDEXED BY canonical_committed_head_idx
          WHERE height = CAST(NULLIF((SELECT value FROM metadata WHERE key = 'oldest_retained_undo_height'), '') AS INTEGER)) AS canonical_oldest_parent_hash,
        (SELECT COUNT(*) FROM rollback_journal INDEXED BY rollback_committed_head_idx) AS rollback_count,
        (SELECT MIN(height) FROM rollback_journal INDEXED BY rollback_committed_head_idx) AS rollback_min_height,
        (SELECT MAX(height) FROM rollback_journal INDEXED BY rollback_committed_head_idx) AS rollback_max_height,
        (SELECT block_hash FROM rollback_journal INDEXED BY rollback_committed_head_idx
          WHERE height = CAST((SELECT value FROM metadata WHERE key = 'canonical_height') AS INTEGER)) AS rollback_tip_hash,
        (SELECT COUNT(*)
          FROM rollback_journal AS rollback_row INDEXED BY rollback_committed_head_idx
          JOIN canonical_blocks AS canonical_row INDEXED BY canonical_committed_head_idx
            ON canonical_row.height = rollback_row.height
          WHERE rollback_row.block_hash IS NOT canonical_row.hash) AS rollback_hash_mismatch_count,
        (SELECT COUNT(*)
          FROM canonical_blocks AS child INDEXED BY canonical_committed_head_idx
          JOIN canonical_blocks AS parent INDEXED BY canonical_committed_head_idx
            ON parent.height = child.height - 1
          WHERE child.height > CAST(NULLIF((SELECT value FROM metadata WHERE key = 'oldest_retained_undo_height'), '') AS INTEGER)
            AND child.parent_hash IS NOT parent.hash) AS canonical_parent_mismatch_count,
        (SELECT group_concat(hex(hash), ',') FROM canonical_blocks INDEXED BY canonical_committed_head_idx) AS canonical_hash_hexes,
        (SELECT group_concat(hex(parent_hash), ',') FROM canonical_blocks INDEXED BY canonical_committed_head_idx) AS canonical_parent_hash_hexes,
        (SELECT group_concat(hex(block_hash), ',') FROM rollback_journal INDEXED BY rollback_committed_head_idx) AS rollback_hash_hexes,
        (SELECT COUNT(*) FROM canonical_blocks INDEXED BY canonical_committed_head_idx
          WHERE typeof(hash) <> 'text' OR typeof(parent_hash) <> 'text') AS canonical_non_text_hash_count,
        (SELECT COUNT(*) FROM rollback_journal INDEXED BY rollback_committed_head_idx
          WHERE typeof(block_hash) <> 'text') AS rollback_non_text_hash_count
    `).get() as {
      readonly snapshot_state_hash: string | null;
      readonly indexer_status: string | null;
      readonly canonical_height: string | null;
      readonly canonical_block_hash: string | null;
      readonly last_verified_height: string | null;
      readonly metadata_state_hash: string | null;
      readonly input_authorization_rule_id: string | null;
      readonly rollback_retention_depth: string | null;
      readonly oldest_retained_undo_height: string | null;
      readonly parent_hash: string | null;
      readonly canonical_anchor_height: string | null;
      readonly canonical_anchor_hash: string | null;
      readonly canonical_count: number;
      readonly canonical_min_height: number | null;
      readonly canonical_max_height: number | null;
      readonly canonical_row_hash: string | null;
      readonly canonical_tip_parent_hash: string | null;
      readonly canonical_oldest_parent_hash: string | null;
      readonly rollback_count: number;
      readonly rollback_min_height: number | null;
      readonly rollback_max_height: number | null;
      readonly rollback_tip_hash: string | null;
      readonly rollback_hash_mismatch_count: number;
      readonly canonical_parent_mismatch_count: number;
      readonly canonical_hash_hexes: string | null;
      readonly canonical_parent_hash_hexes: string | null;
      readonly rollback_hash_hexes: string | null;
      readonly canonical_non_text_hash_count: number;
      readonly rollback_non_text_hash_count: number;
    };
    if (row.snapshot_state_hash === null) {
      if (row.indexer_status !== null
        || row.canonical_height !== null
        || row.canonical_block_hash !== null
        || row.last_verified_height !== null
        || row.metadata_state_hash !== null
        || row.input_authorization_rule_id !== null
        || row.rollback_retention_depth !== null
        || row.oldest_retained_undo_height !== null
        || row.parent_hash !== null
        || row.canonical_anchor_height !== null
        || row.canonical_anchor_hash !== null
        || row.canonical_count !== 0
        || row.rollback_count !== 0) {
        throw new Error("SQLITE_COMMITTED_HEAD_PARTIAL");
      }
      return null;
    }
    const status = row.indexer_status;
    if (status !== "SYNCING"
      && status !== "READY"
      && status !== "NEEDS_UPGRADE"
      && status !== "REORGING"
      && status !== "HALTED") {
      throw new Error("SQLITE_INVALID_METADATA:indexer_status");
    }
    const integerValues = {
      canonical_height: row.canonical_height,
      last_verified_height: row.last_verified_height,
      rollback_retention_depth: row.rollback_retention_depth,
      oldest_retained_undo_height: row.oldest_retained_undo_height,
      canonical_anchor_height: row.canonical_anchor_height,
    };
    const integerMetadata = (key: keyof typeof integerValues, minimum = 0): number => {
      const value = integerValues[key];
      if (value === null || !/^-?(?:0|[1-9][0-9]*)$/.test(value)) throw new Error(`SQLITE_INVALID_METADATA:${key}`);
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed) || parsed < minimum) throw new Error(`SQLITE_INVALID_METADATA:${key}`);
      return parsed;
    };
    const optionalIntegerMetadata = (key: keyof typeof integerValues, minimum = 0): number | null => {
      const value = integerValues[key];
      return value === "" ? null : integerMetadata(key, minimum);
    };
    const canonicalHeight = integerMetadata("canonical_height", this.options.activationHeight - 1);
    const inputAuthorizationRuleId = row.input_authorization_rule_id || null;
    if (inputAuthorizationRuleId !== INPUT_AUTHORIZATION_RULE_ID
      && !(inputAuthorizationRuleId === null && canonicalHeight === this.options.activationHeight - 1 && row.indexer_status !== "READY")) {
      throw new Error("SQLITE_INPUT_AUTHORIZATION_RULE_MISMATCH");
    }
    const canonicalBlockHashValue = row.canonical_block_hash;
    if (canonicalBlockHashValue === null) throw new Error("SQLITE_INVALID_METADATA:canonical_block_hash");
    const canonicalBlockHash = canonicalBlockHashValue === "" ? null : canonicalBlockHashValue;
    if (canonicalHeight < this.options.activationHeight - 1) {
      throw new Error("SQLITE_COMMITTED_HEAD_HEIGHT_BEFORE_ACTIVATION");
    }
    const stateHash = row.metadata_state_hash;
    if (!stateHash
      || !HASH_256_PATTERN.test(stateHash)
      || row.snapshot_state_hash !== stateHash) throw new Error("SQLITE_STATE_HASH_MISMATCH");
    const lastVerifiedHeight = optionalIntegerMetadata("last_verified_height");
    if (lastVerifiedHeight !== null && lastVerifiedHeight > canonicalHeight) {
      throw new Error("SQLITE_LAST_VERIFIED_HEIGHT_MISMATCH");
    }
    const rollbackRetentionDepth = integerMetadata("rollback_retention_depth", 1);
    if (rollbackRetentionDepth !== this.options.rollbackRetentionDepth) {
      throw new Error("SQLITE_ROLLBACK_RETENTION_DEPTH_MISMATCH");
    }
    const oldestRetainedHeight = optionalIntegerMetadata("oldest_retained_undo_height");
    const canonicalAnchorHeight = integerMetadata("canonical_anchor_height", this.options.activationHeight - 1);
    const canonicalAnchorHashValue = row.canonical_anchor_hash;
    if (canonicalAnchorHashValue === null) throw new Error("SQLITE_INVALID_METADATA:canonical_anchor_hash");
    const canonicalAnchorHash = canonicalAnchorHashValue === "" ? null : canonicalAnchorHashValue;
    const parentHashValue = row.parent_hash;
    if (parentHashValue === null) throw new Error("SQLITE_INVALID_METADATA:parent_hash");
    const parentHash = parentHashValue === "" ? null : parentHashValue;
    const assertEmptyWindow = (): void => {
      if (row.canonical_count !== 0
        || row.rollback_count !== 0
        || row.canonical_min_height !== null
        || row.canonical_max_height !== null
        || row.rollback_min_height !== null
        || row.rollback_max_height !== null
        || row.canonical_row_hash !== null
        || row.rollback_tip_hash !== null
        || row.canonical_hash_hexes !== null
        || row.canonical_parent_hash_hexes !== null
        || row.rollback_hash_hexes !== null) {
        throw new Error("SQLITE_COMMITTED_HEAD_EMPTY_WINDOW_MISMATCH");
      }
    };
    const validHashHexList = (value: string | null, expectedCount: number): boolean => {
      if (value === null) return expectedCount === 0;
      const encoded = value.split(",");
      return encoded.length === expectedCount && encoded.every((hash) => HASH_TEXT_HEX_PATTERN.test(hash));
    };
    if (canonicalHeight === this.options.activationHeight - 1) {
      assertEmptyWindow();
      if (oldestRetainedHeight !== null
        || lastVerifiedHeight !== null
        || parentHash !== null
        || (canonicalBlockHash !== null && !HASH_256_PATTERN.test(canonicalBlockHash))
        || canonicalAnchorHeight !== canonicalHeight
        || canonicalAnchorHash !== canonicalBlockHash) {
        throw new Error("SQLITE_COMMITTED_HEAD_PRE_ACTIVATION_MISMATCH");
      }
    } else {
      if (!canonicalBlockHash || !HASH_256_PATTERN.test(canonicalBlockHash)) {
        throw new Error("SQLITE_COMMITTED_HEAD_HASH_REQUIRED");
      }
      if (lastVerifiedHeight !== canonicalHeight) throw new Error("SQLITE_LAST_VERIFIED_HEIGHT_MISMATCH");
      if (oldestRetainedHeight === null) {
        assertEmptyWindow();
        if (parentHash !== null
          || canonicalAnchorHeight !== canonicalHeight
          || canonicalAnchorHash !== canonicalBlockHash) {
          throw new Error("SQLITE_ROLLBACK_RETENTION_EMPTY_WINDOW_MISMATCH");
        }
      } else {
        const retainedCount = canonicalHeight - oldestRetainedHeight + 1;
        if (oldestRetainedHeight < this.options.activationHeight
          || oldestRetainedHeight > canonicalHeight
          || retainedCount > rollbackRetentionDepth
          || canonicalAnchorHeight !== oldestRetainedHeight - 1
          || !canonicalAnchorHash
          || !HASH_256_PATTERN.test(canonicalAnchorHash)
          || row.canonical_count !== retainedCount
          || row.rollback_count !== retainedCount
          || row.canonical_min_height !== oldestRetainedHeight
          || row.canonical_max_height !== canonicalHeight
          || row.rollback_min_height !== oldestRetainedHeight
          || row.rollback_max_height !== canonicalHeight) {
          throw new Error("SQLITE_ROLLBACK_RETENTION_METADATA_MISMATCH");
        }
        if (row.canonical_row_hash !== canonicalBlockHash) throw new Error("SQLITE_COMMITTED_HEAD_CANONICAL_MISMATCH");
        if (row.rollback_tip_hash !== canonicalBlockHash) throw new Error("SQLITE_COMMITTED_HEAD_ROLLBACK_MISMATCH");
        if (row.rollback_hash_mismatch_count !== 0) throw new Error("SQLITE_COMMITTED_HEAD_ROLLBACK_HASH_MISMATCH");
        if (row.canonical_parent_mismatch_count !== 0
          || !validHashHexList(row.canonical_hash_hexes, retainedCount)
          || !validHashHexList(row.canonical_parent_hash_hexes, retainedCount)
          || !validHashHexList(row.rollback_hash_hexes, retainedCount)
          || row.canonical_non_text_hash_count !== 0
          || row.rollback_non_text_hash_count !== 0
          || row.canonical_oldest_parent_hash !== canonicalAnchorHash) {
          throw new Error("SQLITE_COMMITTED_HEAD_PARENT_MISMATCH");
        }
        if (!parentHash
          || !HASH_256_PATTERN.test(parentHash)
          || row.canonical_tip_parent_hash !== parentHash) {
          throw new Error("SQLITE_COMMITTED_HEAD_PARENT_METADATA_MISMATCH");
        }
      }
    }
    return {
      inputAuthorizationRuleId,
      status,
      network: this.options.network,
      activationHeight: this.options.activationHeight,
      canonicalHeight,
      canonicalBlockHash,
      lastVerifiedHeight,
      stateHash,
      rollbackRetentionDepth,
      oldestRetainedHeight,
    };
  }

  describeCommittedState(): SqliteCommittedStateDescriptor {
    const snapshot = this.loadVerifiedSnapshot();
    if (!snapshot || !snapshot.cursor.hash) throw new Error("SQLITE_COMMITTED_STATE_REQUIRED");
    if (this.metadata("input_authorization_rule_id") !== INPUT_AUTHORIZATION_RULE_ID) {
      throw new Error("SQLITE_INPUT_AUTHORIZATION_RULE_MISMATCH");
    }
    const stateHash = engineSnapshot(snapshot, this.options.activationHeight).stateHash;
    const integerMetadata = (key: string): number => {
      const value = this.metadata(key);
      if (value === null || !/^(0|[1-9][0-9]*)$/.test(value)) throw new Error(`SQLITE_INVALID_METADATA:${key}`);
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed)) throw new Error(`SQLITE_INVALID_METADATA:${key}`);
      return parsed;
    };
    const count = (table: "assets" | "balances" | "transfers"): number => {
      const row = this.db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count?: number | bigint } | undefined;
      const value = Number(row?.count);
      if (!Number.isSafeInteger(value) || value < 0) throw new Error(`SQLITE_INVALID_COUNT:${table}`);
      return value;
    };
    const oldest = this.metadata("oldest_retained_undo_height");
    return {
      inputAuthorizationRuleId: INPUT_AUTHORIZATION_RULE_ID,
      status: snapshot.status,
      network: this.options.network,
      activationHeight: this.options.activationHeight,
      canonicalHeight: snapshot.cursor.height,
      canonicalBlockHash: snapshot.cursor.hash,
      stateHash,
      assetCount: count("assets"),
      positiveBalanceCount: count("balances"),
      transferCount: count("transfers"),
      rollbackRetentionDepth: integerMetadata("rollback_retention_depth"),
      oldestRetainedHeight: oldest === "" ? null : integerMetadata("oldest_retained_undo_height"),
    };
  }

  /** Exact reads over the immutable, verified replica; never scan transfer history. */
  readTransferByTxid(txid: string): IndexedTransferRecord | null {
    if (!HASH_256_PATTERN.test(txid)) throw new Error("SQLITE_EXACT_TRANSFER_TXID_INVALID");
    const row = this.db.prepare(`
      SELECT txid, block_height, tx_index, asset_id, record_json FROM transfers WHERE txid = ?
    `).get(txid) as { txid: string; block_height: number; tx_index: number; asset_id: string; record_json: string } | undefined;
    if (!row) return null;
    return this.decodeTransferRow(row,txid);
  }

  readTransferPage(query:TransferQuery = {}):TransferPageContract {
    return transferPage(this.db,query,row=>this.decodeTransferRow(row,row.txid));
  }

  private decodeTransferRow(row:TransferRow,txid:string):IndexedTransferRecord {
    const transfer = decode<SerializedEngineSnapshot["transferRecords"][number]>(row.record_json);
    if (!transfer || transfer.txidDisplayBytes !== row.txid || row.txid !== txid
      || transfer.assetId !== row.asset_id || !HASH_256_PATTERN.test(row.asset_id)
      || transfer.blockHeight !== row.block_height || !Number.isSafeInteger(row.block_height) || row.block_height < this.options.activationHeight
      || transfer.txIndex !== row.tx_index || !Number.isSafeInteger(row.tx_index) || row.tx_index < 0
      || !HASH_256_PATTERN.test(transfer.senderAccount)
      || !Array.isArray(transfer.allocations) || transfer.allocations.length < 1 || transfer.allocations.length > MAX_ALLOCATIONS) {
      throw new Error("SQLITE_EXACT_TRANSFER_IDENTITY_MISMATCH");
    }
    const allocations = transfer.allocations.map((allocation) => {
      if (!allocation || !HASH_256_PATTERN.test(allocation.receiverAccount)
        || typeof allocation.amount !== "string" || !/^[1-9][0-9]*$/.test(allocation.amount)) {
        throw new Error("SQLITE_EXACT_TRANSFER_ALLOCATION_INVALID");
      }
      const amount = BigInt(allocation.amount);
      if (amount > MAX_U128) throw new Error("SQLITE_EXACT_TRANSFER_ALLOCATION_INVALID");
      return { receiverAccount: allocation.receiverAccount, amount };
    });
    return {
      txidDisplayBytes: row.txid,
      blockHeight: row.block_height,
      txIndex: row.tx_index,
      assetId: row.asset_id,
      senderAccount: transfer.senderAccount,
      allocations,
    };
  }

  readBalanceByAssetAccount(assetId: string, accountKey: string): bigint {
    if (!HASH_256_PATTERN.test(assetId) || !HASH_256_PATTERN.test(accountKey)) {
      throw new Error("SQLITE_EXACT_BALANCE_SCOPE_INVALID");
    }
    const row = this.db.prepare("SELECT balance FROM balances WHERE asset_id = ? AND account_key = ?")
      .get(assetId, accountKey) as { balance: string } | undefined;
    if (!row) return 0n;
    if (typeof row.balance !== "string" || !/^[1-9][0-9]*$/.test(row.balance)) {
      throw new Error("SQLITE_EXACT_BALANCE_INVALID");
    }
    return BigInt(row.balance);
  }

  readCanonicalBlockHash(height: number): string | null {
    if (!Number.isSafeInteger(height) || height < this.options.activationHeight) {
      throw new Error("SQLITE_EXACT_BLOCK_HEIGHT_INVALID");
    }
    const row = this.db.prepare("SELECT hash FROM canonical_blocks WHERE height = ?")
      .get(height) as { hash: string } | undefined;
    if (!row) return null; // Old headers leave the bounded rollback window; transfers do not.
    if (typeof row.hash !== "string" || !HASH_256_PATTERN.test(row.hash)) {
      throw new Error("SQLITE_EXACT_BLOCK_HASH_INVALID");
    }
    return row.hash;
  }

  readQueryProjectionHead(): QuerySnapshotContract {
    if (this.metadata("query_projection_version") !== QUERY_PROJECTION_VERSION) throw new Error("QUERY_PROJECTION_SCHEMA_UNAVAILABLE");
    const height = Number(this.metadata("query_projection_height"));
    const hash = this.metadata("query_projection_hash");
    const stateHash = this.metadata("query_projection_state_hash");
    if (!Number.isSafeInteger(height) || height < this.options.activationHeight || !hash || !HASH_256_PATTERN.test(hash)
      || !stateHash || !HASH_256_PATTERN.test(stateHash)
      || this.metadata("canonical_height") !== height.toString() || this.metadata("canonical_block_hash") !== hash
      || this.metadata("state_hash") !== stateHash) throw new Error("QUERY_PROJECTION_SNAPSHOT_MISMATCH");
    return { canonicalTip: { height, hash }, stateHash };
  }

  private invalidateUnmaintainedQueryProjection(): void {
    const maintained = this.metadata("query_projection_version") === QUERY_PROJECTION_VERSION
      && this.metadata("query_projection_height") === this.metadata("canonical_height")
      && this.metadata("query_projection_hash") === this.metadata("canonical_block_hash")
      && this.metadata("query_projection_state_hash") === this.metadata("state_hash");
    if (maintained) return;
    // Persist alongside the deletion in the existing transaction. Normal saves
    // never clear this notice; explicit rebuild records another history reset,
    // not a claim that canonical replay has already completed.
    if (this.metadata("canonical_height") !== null) {
      this.recordQueryHistoryReset(this.queryHistoryResetDiagnostic(this.metadata("query_projection_version") === QUERY_PROJECTION_VERSION ? "UNMAINTAINED_WRITER" : "LEGACY_PROJECTION"));
    }
    // Derived evidence only. Old headers may already have left the undo window,
    // so retaining any earlier COMPLETE claim would silently bless an orphan.
    // Missing legacy markers/older formats cannot authorize leftover query rows.
    this.db.exec("DELETE FROM recipient_transfers; DELETE FROM query_outcomes; DELETE FROM query_blocks;");
    this.db.prepare("DELETE FROM metadata WHERE key='query_complete_through_height'").run();
  }

  private queryHistoryResetDiagnostic(reason: QueryHistoryResetDiagnosticContract["reason"]): QueryHistoryResetDiagnosticContract {
    const height = (key: string) => { const value = this.metadata(key); return value !== null && /^(0|[1-9][0-9]*)$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null; };
    const hash = this.metadata("canonical_block_hash");
    return { code: "QUERY_HISTORY_RESET", reason, recovery: "FULL_CANONICAL_REPLAY", clearedAtUtc: new Date().toISOString(),
      priorCanonicalHash: hash !== null && HASH_256_PATTERN.test(hash) ? hash : null, priorProjectionVersion: this.metadata("query_projection_version"),
      priorCanonicalHeight: height("canonical_height"), priorProjectionHeight: height("query_projection_height") };
  }

  private recordQueryHistoryReset(record: QueryHistoryResetDiagnosticContract): void {
    this.db.prepare("INSERT INTO metadata(key, value) VALUES('query_projection_invalidation', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
      .run(JSON.stringify(record));
  }

  readQueryProjectionDiagnostic(): QueryProjectionDiagnosticContract | null {
    const value = this.metadata("query_projection_invalidation");
    if (value === null) return null;
    let record: QueryHistoryResetDiagnosticContract;
    try { record = JSON.parse(value) as QueryHistoryResetDiagnosticContract; }
    catch (error) { if (!(error instanceof SyntaxError)) throw error; return this.unreadableQueryDiagnostic("INVALID_JSON"); }
    if (!record || typeof record !== "object" || Array.isArray(record)
      || record.code !== "QUERY_HISTORY_RESET" || !["LEGACY_PROJECTION", "UNMAINTAINED_WRITER", "FULL_REBUILD_REQUESTED"].includes(record.reason)
      || record.recovery !== "FULL_CANONICAL_REPLAY" || typeof record.clearedAtUtc !== "string" || !Number.isFinite(Date.parse(record.clearedAtUtc))
      || !(record.priorCanonicalHash === null || (typeof record.priorCanonicalHash === "string" && HASH_256_PATTERN.test(record.priorCanonicalHash)))
      || !(record.priorProjectionVersion === null || typeof record.priorProjectionVersion === "string")
      || ![record.priorCanonicalHeight, record.priorProjectionHeight].every((height) => height === null || (Number.isSafeInteger(height) && height >= 0))) return this.unreadableQueryDiagnostic("INVALID_FIELDS");
    return record;
  }

  private lastDiagnosticWarning: string | null = null;
  private unreadableQueryDiagnostic(reason: "INVALID_JSON" | "INVALID_FIELDS"): QueryProjectionDiagnosticContract {
    if (this.lastDiagnosticWarning !== reason) {
      console.warn(`SQLITE_QUERY_DIAGNOSTIC_UNREADABLE:${reason}`);
      this.lastDiagnosticWarning = reason;
    }
    return { code: "UNREADABLE", reason }; // Preserve the original metadata bytes.
  }

  private validatePersistentRead(query: HeightIntervalQuery, after: readonly number[] | null, dimensions: number, limit: number): void {
    const head = this.readQueryProjectionHead();
    if (!Number.isSafeInteger(query.fromHeight) || query.fromHeight < 0 || !Number.isSafeInteger(query.toHeight)
      || query.toHeight < query.fromHeight || query.toHeight > head.canonicalTip.height || query.toHeight - query.fromHeight >= 1_000
      || !Number.isSafeInteger(limit) || limit < 1 || limit > 101
      || (after && (after.length !== dimensions || after.some((part) => !Number.isSafeInteger(part) || part < 0)
        || after[0]! < query.fromHeight || after[0]! > query.toHeight))) throw new Error("SQLITE_QUERY_BOUND_INVALID");
  }

  readQueryCoverage(fromHeight: number, toHeight: number): readonly BlockCoverageContract[] {
    this.validatePersistentRead({ fromHeight, toHeight }, null, 0, 1);
    const rows = this.db.prepare(`SELECT height, hash, transaction_count, marked_transaction_count,
      (SELECT COUNT(*) FROM query_outcomes WHERE block_height = query_blocks.height) AS outcome_count,
      (SELECT MIN(tx_index) FROM query_outcomes WHERE block_height = query_blocks.height) AS first_marked_index,
      (SELECT MAX(tx_index) FROM query_outcomes WHERE block_height = query_blocks.height) AS last_marked_index
      FROM query_blocks WHERE height BETWEEN ? AND ? ORDER BY height ASC`).all(fromHeight, toHeight) as
      Array<{ height: number; hash: string; transaction_count: number; marked_transaction_count: number; outcome_count: number;
        first_marked_index: number | null; last_marked_index: number | null }>;
    const byHeight = new Map(rows.map((row) => [row.height, row]));
    return Array.from({ length: toHeight - fromHeight + 1 }, (_, offset) => {
      const blockHeight = fromHeight + offset;
      const row = byHeight.get(blockHeight);
      if (!row) return { blockHeight, blockHash: null, coverage: "UNKNOWN" as const, transactionCount: null, markedTransactionCount: null };
      if (!HASH_256_PATTERN.test(row.hash) || !Number.isSafeInteger(row.transaction_count) || row.transaction_count < 0
        || !Number.isSafeInteger(row.marked_transaction_count) || row.marked_transaction_count < 0 || row.marked_transaction_count > row.transaction_count
        || row.outcome_count !== row.marked_transaction_count
        || (row.marked_transaction_count > 0 && (!Number.isSafeInteger(row.first_marked_index) || row.first_marked_index! < 0
          || !Number.isSafeInteger(row.last_marked_index) || row.last_marked_index! >= row.transaction_count))) throw new Error("SQLITE_QUERY_COVERAGE_MISMATCH");
      return { blockHeight, blockHash: row.hash, coverage: "COMPLETE" as const, transactionCount: row.transaction_count,
        markedTransactionCount: row.marked_transaction_count };
    });
  }

  readBlockOutcomes(query: HeightIntervalQuery, after: readonly number[] | null, limit: number): readonly BlockOutcomeContract[] {
    this.validatePersistentRead(query, after, 2, limit);
    // validatePersistentRead already binds after[0] inside the height range.
    // A separate height lower bound makes SQLite seek from the block's first
    // row and filter the retained tx index. Use the existing compound key as
    // the actual lower bound; the no-continuation path keeps its full range.
    const scope = after ? "(o.block_height, o.tx_index) > (?, ?) AND o.block_height <= ?"
      : "o.block_height BETWEEN ? AND ?";
    const parameters = after ? [after[0]!, after[1]!, query.toHeight] : [query.fromHeight, query.toHeight];
    const rows = this.db.prepare(`SELECT o.block_height, o.tx_index, o.txid, o.record_json, o.input_evidence_hash, b.hash, b.transaction_count
      FROM query_outcomes o LEFT JOIN query_blocks b ON b.height = o.block_height
      WHERE ${scope}
      ORDER BY o.block_height ASC, o.tx_index ASC LIMIT ?`)
      .all(...parameters, limit) as
      Array<{ block_height: number; tx_index: number; txid: string; record_json: string; input_evidence_hash: string; hash: string; transaction_count: number }>;
    return rows.map((row) => {
      if (row.hash == null) throw new Error("SQLITE_QUERY_OUTCOME_ASSOCIATION_MISSING");
      const record = JSON.parse(row.record_json) as BlockOutcomeContract;
      if (!record || record.blockHeight !== row.block_height || record.txIndex !== row.tx_index
        || record.txidDisplayBytes !== row.txid || !HASH_256_PATTERN.test(row.txid)
        || record.blockHash !== row.hash || !HASH_256_PATTERN.test(row.hash)
        || !Number.isSafeInteger(row.tx_index) || row.tx_index < 0 || row.tx_index >= row.transaction_count
        || !validOutcomeEvidence(record, row.input_evidence_hash)
        || (record.result?.status !== "APPLIED" && record.result?.status !== "NO_OP")
        || typeof record.result.reason !== "string"
        || (record.result.assetId !== undefined && !HASH_256_PATTERN.test(record.result.assetId))) throw new Error("SQLITE_QUERY_OUTCOME_IDENTITY_MISMATCH");
      return record;
    });
  }

  readCompleteProjectionCoverage(): CompleteProjectionCoverageContract {
    const head = this.readQueryProjectionHead(), raw = this.metadata("query_complete_through_height");
    const throughHeight = raw !== null && /^(0|[1-9][0-9]*)$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : this.options.activationHeight - 1;
    return { fromHeight: this.options.activationHeight, throughHeight,
      coverage: throughHeight === head.canonicalTip.height ? "COMPLETE" : "UNKNOWN" };
  }

  readOutcomeByTxid(txid: string): BlockOutcomeContract | null {
    if (!HASH_256_PATTERN.test(txid)) throw new Error("SQLITE_QUERY_TXID_INVALID");
    this.readQueryProjectionHead();
    const rows = this.db.prepare("SELECT block_height, tx_index FROM query_outcomes INDEXED BY query_outcomes_txid_idx WHERE txid=? ORDER BY block_height,tx_index LIMIT 2").all(txid) as Array<{block_height:number;tx_index:number}>;
    if (rows.length > 1) throw new Error("SQLITE_QUERY_TXID_DUPLICATE");
    const row = rows[0];
    if (!row) return null;
    const result = this.readBlockOutcomes({ fromHeight: row.block_height, toHeight: row.block_height }, row.tx_index > 0 ? [row.block_height,row.tx_index-1] : null, 1)[0];
    if (!result || result.txidDisplayBytes !== txid) throw new Error("SQLITE_QUERY_TXID_ASSOCIATION_MISSING");
    return result;
  }

  readAppliedAllocationsByTxid(txid: string): readonly RecipientTransferContract[] {
    const outcome = this.readOutcomeByTxid(txid);
    if (!outcome || outcome.result.status !== "APPLIED" || !outcome.result.assetId) return [];
    const transfer = this.readTransferByTxid(txid);
    if (!transfer || transfer.assetId !== outcome.result.assetId || transfer.allocations.length > MAX_ALLOCATIONS) throw new Error("SQLITE_QUERY_APPLIED_TRANSFER_MISSING");
    return transfer.allocations.map((allocation,index) => {
      const rows = [...this.iterateRecipientTransfers({ assetId: transfer.assetId, recipientAccount: allocation.receiverAccount,
        fromHeight:outcome.blockHeight,toHeight:outcome.blockHeight }, null,MAX_ALLOCATIONS,undefined,outcome.txIndex)];
      const row = rows.find(item => item.allocationIndex === index);
      if (!row || row.txidDisplayBytes !== txid || row.allocationIndex !== index) throw new Error("SQLITE_QUERY_ALLOCATION_MISSING");
      return row;
    });
  }

  readRecipientTransfers(query: RecipientTransferQuery, after: readonly number[] | null, limit: number, excludeSenderAccount?: string): readonly RecipientTransferContract[] {
    return [...this.iterateRecipientTransfers(query, after, limit, excludeSenderAccount)];
  }

  readExternalIncomingTotal(query: RecipientTransferQuery): Readonly<{ amount: bigint; allocationCount: number }> {
    if (query.toHeight - query.fromHeight >= 6) throw new Error("SQLITE_QUERY_INCOMING_WINDOW_INVALID");
    let amount = 0n, allocationCount = 0;
    // Statement iteration and the same row validator keep one allocation's
    // input evidence live at a time. No full array, SQL SUM or Number amounts.
    for (const row of this.iterateRecipientTransfers(query, null, null, query.recipientAccount)) {
      if (row.senderAccount === query.recipientAccount) throw new Error("SQLITE_QUERY_EXTERNAL_INCOMING_SCOPE_MISMATCH");
      amount += BigInt(row.amount); allocationCount++;
      if (!Number.isSafeInteger(allocationCount)) throw new Error("SQLITE_QUERY_ALLOCATION_COUNT_INVALID");
    }
    return { amount, allocationCount };
  }

  private *iterateRecipientTransfers(query: RecipientTransferQuery, after: readonly number[] | null, limit: number | null, excludeSenderAccount?: string, exactTxIndex?: number): Generator<RecipientTransferContract> {
    this.validatePersistentRead(query, after, 3, limit ?? 1);
    if (!HASH_256_PATTERN.test(query.assetId) || !HASH_256_PATTERN.test(query.recipientAccount)
      || (excludeSenderAccount !== undefined && !HASH_256_PATTERN.test(excludeSenderAccount))) throw new Error("SQLITE_QUERY_SCOPE_INVALID");
    const rows = this.db.prepare(`SELECT r.block_height, r.tx_index, r.allocation_index, r.asset_id, r.recipient_account, r.record_json, b.hash,
        o.txid, o.record_json AS outcome_json, o.input_evidence_hash, t.record_json AS transfer_json
      FROM recipient_transfers r INDEXED BY recipient_transfer_scope_idx
      LEFT JOIN query_blocks b ON b.height = r.block_height
      LEFT JOIN query_outcomes o ON o.block_height = r.block_height AND o.tx_index = r.tx_index
      LEFT JOIN transfers t ON t.txid = o.txid AND t.block_height = r.block_height AND t.tx_index = r.tx_index
      WHERE r.asset_id = ? AND r.recipient_account = ? AND r.block_height BETWEEN ? AND ?
        AND (r.block_height, r.tx_index, r.allocation_index) > (?, ?, ?)
        AND (? IS NULL OR r.tx_index = ?)
        AND (? IS NULL OR t.record_json IS NULL OR json_extract(t.record_json, '$.senderAccount') IS NULL OR json_extract(t.record_json, '$.senderAccount') != ?)
      ORDER BY r.block_height ASC, r.tx_index ASC, r.allocation_index ASC LIMIT ?`)
      .iterate(query.assetId, query.recipientAccount, query.fromHeight, query.toHeight,
        after?.[0] ?? -1, after?.[1] ?? -1, after?.[2] ?? -1, exactTxIndex ?? null, exactTxIndex ?? null, excludeSenderAccount ?? null, excludeSenderAccount ?? null, limit ?? -1) as
      Iterable<{ block_height: number; tx_index: number; allocation_index: number; asset_id: string; recipient_account: string;
        record_json: string; hash: string; txid: string; outcome_json: string; input_evidence_hash: string; transfer_json: string }>;
    for (const row of rows) {
      if (row.hash == null || row.outcome_json == null || row.transfer_json == null) throw new Error("SQLITE_QUERY_TRANSFER_ASSOCIATION_MISSING");
      const record = JSON.parse(row.record_json) as RecipientTransferContract;
      const outcome = JSON.parse(row.outcome_json) as BlockOutcomeContract;
      const transfer = JSON.parse(row.transfer_json) as SerializedEngineSnapshot["transferRecords"][number];
      const allocation = transfer.allocations?.[record.allocationIndex];
      if (!record || record.blockHeight !== row.block_height || record.blockHash !== row.hash || !HASH_256_PATTERN.test(row.hash)
        || record.txIndex !== row.tx_index || record.allocationIndex !== row.allocation_index
        || !Number.isSafeInteger(record.txIndex) || record.txIndex < 0 || !Number.isSafeInteger(record.allocationIndex) || record.allocationIndex < 0
        || record.assetId !== row.asset_id || record.assetId !== query.assetId || record.recipientAccount !== row.recipient_account
        || record.recipientAccount !== query.recipientAccount || record.txidDisplayBytes !== row.txid || !HASH_256_PATTERN.test(row.txid)
        || !HASH_256_PATTERN.test(record.senderAccount) || typeof record.amount !== "string" || !/^[1-9][0-9]*$/.test(record.amount)
        || BigInt(record.amount) > MAX_U128 || outcome.result.status !== "APPLIED" || outcome.result.assetId !== record.assetId
        || outcome.blockHeight !== record.blockHeight || outcome.blockHash !== record.blockHash || outcome.txIndex !== record.txIndex
        || outcome.txidDisplayBytes !== record.txidDisplayBytes
        || !validOutcomeEvidence(outcome, row.input_evidence_hash)
        || transfer.txidDisplayBytes !== record.txidDisplayBytes || transfer.blockHeight !== record.blockHeight || transfer.txIndex !== record.txIndex
        || transfer.assetId !== record.assetId || transfer.senderAccount !== record.senderAccount
        || !allocation || allocation.receiverAccount !== record.recipientAccount || allocation.amount !== record.amount
        || (record.identityEvidence !== "COMPLETE" && record.identityEvidence !== "UNKNOWN")
        || (record.identityEvidence === "UNKNOWN" && (record.authInputIndex !== null || record.authInputOutpoint !== null))
        || (record.identityEvidence === "COMPLETE" && (!Number.isSafeInteger(record.authInputIndex) || record.authInputIndex! < 0
          || !record.authInputOutpoint || !HASH_256_PATTERN.test(record.authInputOutpoint.txidDisplayBytes)
          || !Number.isSafeInteger(record.authInputOutpoint.vout) || record.authInputOutpoint.vout < 0 || record.authInputOutpoint.vout > 0xffff_ffff
          || outcome.authorizationEvidence !== "COMPLETE" || record.authInputIndex !== outcome.authInputIndex
          || record.authInputOutpoint.txidDisplayBytes !== outcome.authInputOutpoint!.txidDisplayBytes
          || record.authInputOutpoint.vout !== outcome.authInputOutpoint!.vout))) {
        throw new Error("SQLITE_QUERY_TRANSFER_IDENTITY_MISMATCH");
      }
      // Old v2 allocation JSON remains usable: input evidence is stored once,
      // verified above, and hydrated from the associated outcome on every read.
      yield { ...record, inputCount: outcome.inputCount, inputOutpoints: outcome.inputOutpoints, inputEvidence: outcome.inputEvidence };
    }
  }

  rebuild(): void {
    this.requireWritable();
    if (this.legacySchema) throw Error('SQLITE_SCHEMA_VERSION_MISMATCH');
    this.transaction(() => {
      const diagnostic = this.queryHistoryResetDiagnostic("FULL_REBUILD_REQUESTED");
      this.db.exec("DELETE FROM query_blocks; DELETE FROM snapshots; DELETE FROM canonical_blocks; DELETE FROM rollback_journal; DELETE FROM assets; DELETE FROM canonical_names; DELETE FROM locators; DELETE FROM balances; DELETE FROM transfers; DELETE FROM block_state_hashes;");
      this.db.prepare("DELETE FROM metadata WHERE key NOT IN ('schema_version', 'network', 'activation_height')").run();
      this.recordQueryHistoryReset(diagnostic);
    });
  }

  assertReadOnlyWriteProbeRejected(): void {
    if (!this.readOnly) throw new Error("SQLITE_WRITE_PROBE_REQUIRES_READ_ONLY_STORAGE");
    let rejected = false;
    try {
      this.db.prepare("UPDATE metadata SET value = value WHERE key = 'schema_version'").run();
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error("SQLITE_READ_ONLY_WRITE_PROBE_SUCCEEDED");
  }

  close(): void { this.db.close(); }

  private createSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS snapshots(singleton INTEGER PRIMARY KEY CHECK(singleton=1), snapshot_json TEXT NOT NULL, protocol_state BLOB NOT NULL, state_hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS canonical_blocks(height INTEGER PRIMARY KEY, hash TEXT NOT NULL UNIQUE, parent_hash TEXT, block_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS rollback_journal(height INTEGER PRIMARY KEY, block_hash TEXT NOT NULL, entry_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assets(asset_id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, locator_height INTEGER NOT NULL, locator_tx_index INTEGER NOT NULL, total_supply TEXT NOT NULL, record_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS canonical_names(name TEXT PRIMARY KEY, asset_id TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS locators(locator_key TEXT PRIMARY KEY, asset_id TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS balances(asset_id TEXT NOT NULL, account_key TEXT NOT NULL, balance TEXT NOT NULL CHECK(balance <> '0'), PRIMARY KEY(asset_id, account_key));
      CREATE TABLE IF NOT EXISTS transfers(txid TEXT PRIMARY KEY, block_height INTEGER NOT NULL, tx_index INTEGER NOT NULL, asset_id TEXT NOT NULL, record_json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS snapshots_committed_head_idx ON snapshots(singleton, state_hash);
      CREATE INDEX IF NOT EXISTS canonical_committed_head_idx ON canonical_blocks(height, hash, parent_hash);
      CREATE INDEX IF NOT EXISTS rollback_committed_head_idx ON rollback_journal(height, block_hash);
      ${QUERY_PROJECTION_SCHEMA}
      ${TRANSFER_HISTORY_SCHEMA}
    `);
    ensureQueryProjectionColumns(this.db);
  }

  private syncAssets(assets: SerializedEngineSnapshot["indexedAssets"]): number {
    const desired = new Set<string>();
    for (const asset of assets) {
      if (desired.has(asset.assetId)) throw new Error("DUPLICATE_INDEXED_ASSET_ID");
      desired.add(asset.assetId);
    }
    let changes = this.deleteMissingSingleProjectionKeys(
      { table: "assets", column: "asset_id" },
      (assetId) => desired.has(assetId),
    );
    const upsert = this.db.prepare(`
      INSERT INTO assets(asset_id, name, locator_height, locator_tx_index, total_supply, record_json)
      VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(asset_id) DO UPDATE SET
        name = excluded.name,
        locator_height = excluded.locator_height,
        locator_tx_index = excluded.locator_tx_index,
        total_supply = excluded.total_supply,
        record_json = excluded.record_json
      WHERE assets.name IS NOT excluded.name
        OR assets.locator_height IS NOT excluded.locator_height
        OR assets.locator_tx_index IS NOT excluded.locator_tx_index
        OR assets.total_supply IS NOT excluded.total_supply
        OR assets.record_json IS NOT excluded.record_json
    `);
    for (const asset of assets) {
      changes += Number(upsert.run(
        asset.assetId,
        asset.name,
        asset.locator.blockHeight,
        asset.locator.txIndex,
        asset.totalSupply,
        encode(asset),
      ).changes);
    }
    return changes;
  }

  private syncCanonicalNames(names: ReadonlyMap<string, string>): number {
    let changes = this.deleteMissingSingleProjectionKeys(
      { table: "canonical_names", column: "name" },
      (name) => names.has(name),
    );
    const upsert = this.db.prepare(`
      INSERT INTO canonical_names(name, asset_id) VALUES(?, ?)
      ON CONFLICT(name) DO UPDATE SET asset_id = excluded.asset_id
      WHERE canonical_names.asset_id IS NOT excluded.asset_id
    `);
    for (const [name, assetId] of names) changes += Number(upsert.run(name, assetId).changes);
    return changes;
  }

  private syncLocators(locators: ReadonlyMap<string, string>): number {
    let changes = this.deleteMissingSingleProjectionKeys(
      { table: "locators", column: "locator_key" },
      (locator) => locators.has(locator),
    );
    const upsert = this.db.prepare(`
      INSERT INTO locators(locator_key, asset_id) VALUES(?, ?)
      ON CONFLICT(locator_key) DO UPDATE SET asset_id = excluded.asset_id
      WHERE locators.asset_id IS NOT excluded.asset_id
    `);
    for (const [locator, assetId] of locators) changes += Number(upsert.run(locator, assetId).changes);
    return changes;
  }

  private syncBalances(balances: ReadonlyMap<string, bigint>): number {
    type BalanceKeyRow = { readonly asset_id: string; readonly account_key: string };
    for (const [key, balance] of balances) {
      if (balance <= 0n) throw new Error("NON_POSITIVE_CANONICAL_BALANCE");
      const separator = key.indexOf(":");
      if (separator <= 0 || separator === key.length - 1) throw new Error("INVALID_CANONICAL_BALANCE_KEY");
    }
    const firstPage = this.db.prepare(`
      SELECT asset_id, account_key FROM balances
      ORDER BY asset_id ASC, account_key ASC LIMIT ?
    `);
    const nextPage = this.db.prepare(`
      SELECT asset_id, account_key FROM balances
      WHERE asset_id > ? OR (asset_id = ? AND account_key > ?)
      ORDER BY asset_id ASC, account_key ASC LIMIT ?
    `);
    const remove = this.db.prepare("DELETE FROM balances WHERE asset_id = ? AND account_key = ?");
    let changes = 0;
    let after: BalanceKeyRow | null = null;
    while (true) {
      // `.all()` completes this page's SELECT before any same-table DELETE.
      const rows = (after === null
        ? firstPage.all(PROJECTION_KEYSET_BATCH_SIZE)
        : nextPage.all(
            after.asset_id,
            after.asset_id,
            after.account_key,
            PROJECTION_KEYSET_BATCH_SIZE,
          )) as BalanceKeyRow[];
      if (rows.length === 0) break;
      for (const row of rows) {
        if (balances.has(`${row.asset_id}:${row.account_key}`)) continue;
        changes += Number(remove.run(row.asset_id, row.account_key).changes);
      }
      after = rows.at(-1)!;
      if (rows.length < PROJECTION_KEYSET_BATCH_SIZE) break;
    }
    const upsert = this.db.prepare(`
      INSERT INTO balances(asset_id, account_key, balance) VALUES(?, ?, ?)
      ON CONFLICT(asset_id, account_key) DO UPDATE SET balance = excluded.balance
      WHERE balances.balance IS NOT excluded.balance
    `);
    for (const [key, balance] of balances) {
      const separator = key.indexOf(":");
      changes += Number(upsert.run(key.slice(0, separator), key.slice(separator + 1), balance.toString()).changes);
    }
    return changes;
  }

  private syncTransfers(transfers: SerializedEngineSnapshot["transferRecords"]): number {
    const desired = new Set<string>();
    for (const transfer of transfers) {
      if (desired.has(transfer.txidDisplayBytes)) throw new Error("DUPLICATE_INDEXED_TRANSFER_TXID");
      desired.add(transfer.txidDisplayBytes);
    }
    let changes = this.deleteMissingSingleProjectionKeys(
      { table: "transfers", column: "txid" },
      (txid) => desired.has(txid),
    );
    const upsert = this.db.prepare(`
      INSERT INTO transfers(txid, block_height, tx_index, asset_id, record_json)
      VALUES(?, ?, ?, ?, ?)
      ON CONFLICT(txid) DO UPDATE SET
        block_height = excluded.block_height,
        tx_index = excluded.tx_index,
        asset_id = excluded.asset_id,
        record_json = excluded.record_json
      WHERE transfers.block_height IS NOT excluded.block_height
        OR transfers.tx_index IS NOT excluded.tx_index
        OR transfers.asset_id IS NOT excluded.asset_id
        OR transfers.record_json IS NOT excluded.record_json
    `);
    for (const transfer of transfers) {
      changes += Number(upsert.run(
        transfer.txidDisplayBytes,
        transfer.blockHeight,
        transfer.txIndex,
        transfer.assetId,
        encode(transfer),
      ).changes);
    }
    return changes;
  }

  private deleteMissingSingleProjectionKeys(
    target: SingleProjectionKeyTable,
    keep: (key: string) => boolean,
  ): number {
    const firstPage = this.db.prepare(`
      SELECT ${target.column} AS projection_key FROM ${target.table}
      ORDER BY ${target.column} ASC LIMIT ?
    `);
    const nextPage = this.db.prepare(`
      SELECT ${target.column} AS projection_key FROM ${target.table}
      WHERE ${target.column} > ?
      ORDER BY ${target.column} ASC LIMIT ?
    `);
    const remove = this.db.prepare(
      `DELETE FROM ${target.table} WHERE ${target.column} = ?`,
    );
    let changes = 0;
    let after: string | null = null;
    while (true) {
      // `.all()` closes the active scan before any DELETE mutates this table.
      const rows = (after === null
        ? firstPage.all(PROJECTION_KEYSET_BATCH_SIZE)
        : nextPage.all(after, PROJECTION_KEYSET_BATCH_SIZE)) as Array<{
          projection_key: string;
        }>;
      if (rows.length === 0) break;
      for (const row of rows) {
        if (!keep(row.projection_key)) {
          changes += Number(remove.run(row.projection_key).changes);
        }
      }
      after = rows.at(-1)!.projection_key;
      if (rows.length < PROJECTION_KEYSET_BATCH_SIZE) break;
    }
    return changes;
  }

  private verifyManifestIdentity(): void {
    if (!this.readOnly && !this.legacySchema) {
      const insert = this.db.prepare("INSERT OR IGNORE INTO metadata(key, value) VALUES(?, ?)");
      insert.run("schema_version", DATABASE_SCHEMA_VERSION.toString());
      insert.run("network", this.options.network);
      insert.run("activation_height", this.options.activationHeight.toString());
    }
    if (this.metadata("schema_version") !== (this.legacySchema ? '1' : DATABASE_SCHEMA_VERSION.toString())) throw new Error("SQLITE_SCHEMA_VERSION_MISMATCH");
    if (this.metadata("network") !== this.options.network) throw new Error("SQLITE_NETWORK_MISMATCH");
    if (this.metadata("activation_height") !== this.options.activationHeight.toString()) throw new Error("SQLITE_ACTIVATION_HEIGHT_MISMATCH");
    if (this.options.runtimeIdentity !== undefined) {
      const identity = this.metadata("reference_runtime_identity");
      if (identity === null && !this.readOnly
        && !this.db.prepare("SELECT 1 FROM snapshots LIMIT 1").get()) {
        this.db.prepare("INSERT INTO metadata(key, value) VALUES('reference_runtime_identity', ?)").run(this.options.runtimeIdentity);
      } else if (identity !== this.options.runtimeIdentity) {
        throw new Error("SQLITE_RUNTIME_IDENTITY_MISMATCH");
      }
    }
    const persistedRetentionDepth = this.metadata("rollback_retention_depth");
    if (persistedRetentionDepth !== null && persistedRetentionDepth !== this.options.rollbackRetentionDepth.toString()) {
      throw new Error("SQLITE_ROLLBACK_RETENTION_DEPTH_MISMATCH");
    }
  }

  private retainedEntries(
    entries: readonly RollbackJournalEntry[],
    cursorHeight: number,
    window: RollbackRetentionWindow,
  ): readonly RollbackJournalEntry[] {
    const retained = entries
      .filter((entry) => window.oldestRetainedHeight !== null
        && entry.block.height >= window.oldestRetainedHeight
        && entry.block.height <= cursorHeight)
      .sort((left, right) => left.block.height - right.block.height);
    if (retained.length > window.depth) throw new Error("ROLLBACK_RETENTION_WINDOW_EXCEEDED");
    for (let index = 1; index < retained.length; index += 1) {
      if (retained[index]!.block.height !== retained[index - 1]!.block.height + 1) {
        throw new Error("ROLLBACK_RETENTION_WINDOW_DISCONTINUITY");
      }
    }
    if (retained.length > 0 && retained.at(-1)!.block.height !== cursorHeight) {
      throw new Error("ROLLBACK_RETENTION_TIP_MISSING");
    }
    return retained;
  }

  private verifyLoadedRetention(snapshot: IndexerSnapshot, boundedFormat: boolean): void {
    this.verifyJournalSequence(snapshot.rollbackEntries, snapshot.cursor.height, !boundedFormat);
    if (!boundedFormat) return;
    const expected = deriveRollbackRetentionWindow(
      this.options.activationHeight,
      snapshot.cursor.height,
      this.options.rollbackRetentionDepth,
      snapshot.rollbackEntries,
    );
    if (!snapshot.rollbackRetention || !this.sameRetentionWindow(snapshot.rollbackRetention, expected)) {
      throw new Error("ROLLBACK_RETENTION_WINDOW_MISMATCH");
    }
    this.retainedEntries(snapshot.rollbackEntries, snapshot.cursor.height, expected);
    if (this.metadata("rollback_retention_depth") !== expected.depth.toString()
      || this.metadata("oldest_retained_undo_height") !== (expected.oldestRetainedHeight?.toString() ?? "")
      || this.metadata("canonical_anchor_height") !== expected.anchorHeight.toString()) {
      throw new Error("SQLITE_ROLLBACK_RETENTION_METADATA_MISMATCH");
    }
    const anchorHash = expected.oldestRetainedHeight === null
      ? snapshot.cursor.hash
      : snapshot.rollbackEntries[0]?.block.previousHash ?? null;
    if (this.metadata("canonical_anchor_hash") !== (anchorHash ?? "")) {
      throw new Error("SQLITE_ROLLBACK_RETENTION_ANCHOR_MISMATCH");
    }
  }

  private verifyJournalSequence(
    entries: readonly RollbackJournalEntry[],
    cursorHeight: number,
    requireTipEntry: boolean,
  ): void {
    if (requireTipEntry && cursorHeight >= this.options.activationHeight && entries.length === 0) {
      throw new Error("LEGACY_ROLLBACK_JOURNAL_TIP_MISSING");
    }
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]!;
      if (!Number.isSafeInteger(entry.block.height) || entry.block.height < this.options.activationHeight) {
        throw new Error("ROLLBACK_JOURNAL_INVALID_HEIGHT");
      }
      if (index > 0) {
        const previous = entries[index - 1]!;
        if (entry.block.height !== previous.block.height + 1 || entry.block.previousHash !== previous.block.hash) {
          throw new Error("ROLLBACK_JOURNAL_DISCONTINUITY");
        }
      }
    }
    if (entries.length > 0 && entries.at(-1)!.block.height !== cursorHeight) {
      throw new Error("ROLLBACK_JOURNAL_TIP_MISMATCH");
    }
  }

  private sameRetentionWindow(left: RollbackRetentionWindow, right: RollbackRetentionWindow): boolean {
    return left.depth === right.depth
      && left.oldestRetainedHeight === right.oldestRetainedHeight
      && left.anchorHeight === right.anchorHeight;
  }

  private persistedParentHash(height: number, hash: string | null): string | null {
    if (!hash) return null;
    const row = this.db.prepare("SELECT parent_hash FROM canonical_blocks WHERE height = ? AND hash = ?")
      .get(height, hash) as { parent_hash?: string | null } | undefined;
    return row?.parent_hash ?? null;
  }

  private metadata(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM metadata WHERE key = ?").get(key) as { value?: string } | undefined;
    return row?.value ?? null;
  }

  private transaction(action: () => void): void {
    this.requireWritable();
    this.db.exec("BEGIN IMMEDIATE");
    try { action(); this.db.exec("COMMIT"); }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  private requireWritable(): void {
    if (this.readOnly) throw new Error("READ_ONLY_STORAGE");
  }
}
