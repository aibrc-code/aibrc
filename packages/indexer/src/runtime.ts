import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { IndexerCore, MemoryRollbackJournal, type BlockSource, type IndexerStatus } from './core/index.js';
import { OfflineProtocolEngine } from './engine/index.js';
import { SqliteIndexerStorage } from './storage/index.js';
import { IndexerQueryService } from './query/index.js';
import { PersistentQueryInputError } from './query/query-service.js';
import { NetworkBoundBlockSource } from './ingestion/index.js';
import { BitcoinCoreIndexerProvider } from './rpc/signet-rpc-provider.js';
import { BitcoinCoreIndexerHttpTransport } from './rpc/http-transport.js';
import { loadContext, assertContextUnchanged, type RuntimeContext } from './config.js';
import { classifySyncError } from './sync-errors.js';

function openStorage(context: RuntimeContext, readOnly: boolean): SqliteIndexerStorage {
  return new SqliteIndexerStorage({ path: context.config.databasePath,
    network: context.config.network, explicitNetworkIdentity: true,
    activationHeight: context.genesisHeight,
    rollbackRetentionDepth: context.config.rollbackRetentionDepth,
    runtimeIdentity: context.identity, readOnly });
}

function queryFor(engine: OfflineProtocolEngine, storage: SqliteIndexerStorage, status: () => IndexerStatus): IndexerQueryService {
  return new IndexerQueryService(() => engine.state, status, storage, storage);
}

/** One OS-released SQLite writer lease per local database; no stale PID lock. */
function acquireWriter(databasePath: string): DatabaseSync {
  mkdirSync(dirname(databasePath), { recursive: true });
  const lease = new DatabaseSync(databasePath + '.writer.sqlite');
  try { lease.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE;'); }
  catch { lease.close(); throw new Error('INDEXER_WRITER_ALREADY_RUNNING'); }
  return lease;
}

export interface ReferenceSession {
  sync(): Promise<unknown>;
  status(): unknown;
  query: IndexerQueryService;
  close(): void;
}

interface BlockStateHash {
  height: number;
  blockHash: string;
  stateHash: string;
}

function readBlockStateHash(storage: SqliteIndexerStorage, height: number): BlockStateHash | null {
  // The pinned storage has no historical hash accessor. Use its own connection
  // so the row and the response context share the same committed read snapshot.
  const db = storage['db'];
  const table = db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'block_state_hashes'").get();
  if (!table) return null;
  const row = db.prepare('SELECT height, block_hash AS blockHash, state_hash AS stateHash FROM block_state_hashes WHERE height = ?').get(height);
  return (row as BlockStateHash | undefined) ?? null;
}

/** Read-only Bitcoin RPC; the only writes are to this operator's local index. */
export async function openSession(configFile: string): Promise<ReferenceSession> {
  const context = loadContext(configFile), { config } = context;
  const cookie = config.rpc.cookieFile === undefined ? undefined : readFileSync(config.rpc.cookieFile, 'utf8').trim();
  if (cookie !== undefined && (!cookie.includes(':') || /[\r\n]/.test(cookie))) throw new Error('INVALID_RPC_COOKIE');
  const transport = new BitcoinCoreIndexerHttpTransport({ network: config.network,
    url: config.rpc.url, timeoutMs: config.rpc.timeoutMs, ...(cookie === undefined ? {} : { cookie }) });
  const provider = new BitcoinCoreIndexerProvider(transport, config.network);
  await provider.verifyNetwork();
  // Learn only the pre-activation parent, never skip an AIBRC block.
  const anchorHash = context.genesisHeight === 0 ? '0'.repeat(64) : (await provider.getBlockHash(context.genesisHeight - 1)).toLowerCase();
  if (anchorHash !== null && !/^[0-9a-f]{64}$/.test(anchorHash)) throw new Error('INVALID_ANCHOR_HASH');
  assertContextUnchanged(context);
  const lease = acquireWriter(config.databasePath);
  let storage: SqliteIndexerStorage | undefined;
  try {
    storage = openStorage(context, false);
    const snapshot = await storage.loadSnapshot();
    const engine = new OfflineProtocolEngine({ expectedNetwork: context.expectedNetwork, namePolicy: context.namePolicy });
    const source = new NetworkBoundBlockSource({ network: config.network, enabled: true }, provider);
    const verified: BlockSource = {
      async getTip() { await provider.verifyNetwork(); return source.getTip(); },
      getBlock(height) { return source.getBlock(height); },
    };
    const core = new IndexerCore({ startHeight: context.genesisHeight, anchorHash,
      blockSource: verified, rollbackJournal: new MemoryRollbackJournal(), storage,
      protocolEngine: engine, rollbackRetentionDepth: config.rollbackRetentionDepth, classifySyncError });
    await core.initialize(snapshot);
    const query = queryFor(engine, storage, () => core.status);
    let closed = false;
    const status = () => ({ ...query.getStatus(), view: 'LOCAL_CHECKPOINT',
      network: config.network, genesisHeight: context.genesisHeight, runtimeIdentity: JSON.parse(context.identity) });
    return {
      query, status,
      async sync() {
        if (closed) throw new Error('SESSION_CLOSED');
        assertContextUnchanged(context);
        try { await core.syncToTip(); }
        catch (error) {
          // Never keep retrying behind a stale durable READY checkpoint.
          const durable = storage!.readCommittedHead();
          if (classifySyncError(error) === 'TRANSIENT_SYNC_ERROR'
            && (!durable || durable.status !== 'SYNCING' || core.status !== 'SYNCING')) {
            throw new Error('FAILURE_STATE_NOT_DURABLE', { cause: error });
          }
          throw error;
        }
        return { ...status(), liveChainChecked: true, checkedAt: new Date().toISOString() };
      },
      close() {
        if (closed) return;
        closed = true;
        try { storage!.close(); } finally { lease.close(); }
      },
    };
  } catch (error) {
    try { storage?.close(); } finally { lease.close(); }
    throw error;
  }
}

export async function openLocalQuery(configFile: string) {
  const context = loadContext(configFile), storage = openStorage(context, true);
  try {
    storage.beginReadSnapshot();
    const snapshot = await storage.loadSnapshot();
    if (!snapshot) throw new Error('INDEX_NOT_INITIALIZED');
    const engine = new OfflineProtocolEngine({ expectedNetwork: context.expectedNetwork, namePolicy: context.namePolicy });
    engine.useExternalTransferHistory();
    await engine.restoreState(snapshot.engineState);
    const query = queryFor(engine, storage, () => snapshot.status);
    return { query, storage, stateAt: (height: number) => readBlockStateHash(storage, height),
      status: () => ({ ...query.getStatus(), network: context.config.network,
        genesisHeight: context.genesisHeight, runtimeIdentity: JSON.parse(context.identity),
        view: 'LOCAL_CHECKPOINT', liveChainChecked: false }),
      close: () => storage.close() };
  } catch (error) { storage.close(); throw error; }
}

const persistentInputCodes = new Map([
  ['Invalid recipient transfer scope.', 'INVALID_QUERY_ID'],
  ['Query interval must contain 1-1000 verified heights.', 'INVALID_QUERY_RANGE'],
  ['Query limit must be 1-100.', 'INVALID_QUERY_LIMIT'],
  ['Unknown, stale, or mismatched query cursor.', 'INVALID_QUERY_CURSOR'],
  ['Cursor precedes business position.', 'INVALID_QUERY_CURSOR'],
  ['Invalid canonical business position.', 'INVALID_QUERY_POSITION'],
  ['Canonical business position changed or is unverified.', 'STALE_QUERY_POSITION'],
]);

/** Preserve useful machine-readable codes without echoing a node's error text. */
export function safeErrorCode(error: unknown): string {
  const explicit = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (typeof explicit === 'string' && /^[A-Z][A-Z0-9_]+$/.test(explicit)) return explicit;
  const message = error instanceof Error ? error.message : '';
  const code = /^[A-Z][A-Z0-9_]+(?=[:\s]|$)/.exec(message)?.[0];
  if (code) return code;
  return error instanceof PersistentQueryInputError
    ? persistentInputCodes.get(message) ?? 'INVALID_ARGUMENTS'
    : 'INDEXER_FAILED';
}
