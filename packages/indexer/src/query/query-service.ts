import type { IndexerStatus } from "../core/types.js";
import type { IndexerConsensusState } from "../engine/types.js";
import type {
  AssetContract,
  BalanceContract,
  IndexerStatusContract,
  TransferContract,
  TransferPageContract,
  TransferQuery,
  AssetMaturityContract, AssetMaturityQuery, BlockCoverageContract, BlockOutcomeContract,
  BlockOutcomePageContract, HeightIntervalQuery, QuerySnapshotContract, RecipientTransferContract,
  RecipientTransferPageContract, RecipientTransferQuery,
  BalanceWithRecentIncomingContract, BalanceWithRecentIncomingQuery, QueryProjectionDiagnosticContract,
  CompleteProjectionCoverageContract, LiabilityViewDataContract, LiabilityViewQuery,
} from "./contracts.js";

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

/** Only verified replica storage supplies this capability; no history fallback. */
export interface ExactQueryStoragePort {
  readTransferPage?(query:TransferQuery):TransferPageContract;
  readTransferByTxid(txid: string): IndexerConsensusState["transferRecords"][number] | null;
  readBalanceByAssetAccount(assetId: string, accountKey: string): bigint;
  readCanonicalBlockHash(height: number): string | null;
  readQueryCoverage?(fromHeight: number, toHeight: number): readonly BlockCoverageContract[];
  readQueryProjectionHead?(): QuerySnapshotContract;
  readRecipientTransfers?(query: RecipientTransferQuery, after: readonly number[] | null, limit: number, excludeSenderAccount?: string): readonly RecipientTransferContract[];
  readBlockOutcomes?(query: HeightIntervalQuery, after: readonly number[] | null, limit: number): readonly BlockOutcomeContract[];
  readQueryProjectionDiagnostic?(): QueryProjectionDiagnosticContract | null;
  readExternalIncomingTotal?(query: RecipientTransferQuery): Readonly<{ amount: bigint; allocationCount: number }>;
  readCompleteProjectionCoverage?(): CompleteProjectionCoverageContract;
  readOutcomeByTxid?(txid: string): BlockOutcomeContract | null;
  readAppliedAllocationsByTxid?(txid: string): readonly RecipientTransferContract[];
}

export const MAX_PERSISTENT_QUERY_HEIGHTS = 1_000;
export const MAX_PERSISTENT_QUERY_ITEMS = 100;
const HEX_32 = /^[0-9a-f]{64}$/;

/** Validation errors are safe to distinguish from storage availability failures. */
export class PersistentQueryInputError extends Error {}

/** Inventory reads require a concrete deployment identity; maturity's optional policy is unchanged. */
export function hasCanonicalDeploymentPin(input: Readonly<{ locator?: unknown; deployTxidDisplayBytes?: unknown }>): boolean {
  const locator = input.locator;
  if (locator === undefined && input.deployTxidDisplayBytes === undefined) return false;
  if (locator !== undefined) {
    if (!locator || typeof locator !== "object" || Array.isArray(locator)) return false;
    const point = locator as Record<string, unknown>;
    if (typeof point.blockHeight !== "number" || !Number.isSafeInteger(point.blockHeight) || point.blockHeight < 0
      || typeof point.txIndex !== "number" || !Number.isSafeInteger(point.txIndex) || point.txIndex < 0) return false;
  }
  return input.deployTxidDisplayBytes === undefined
    || (typeof input.deployTxidDisplayBytes === "string" && /^[0-9a-fA-F]{64}$/.test(input.deployTxidDisplayBytes));
}

function interval(query: HeightIntervalQuery, tip: number): number {
  if (!Number.isSafeInteger(query.fromHeight) || query.fromHeight < 0
    || !Number.isSafeInteger(query.toHeight) || query.toHeight < query.fromHeight || query.toHeight > tip
    || query.toHeight - query.fromHeight >= MAX_PERSISTENT_QUERY_HEIGHTS) {
    throw new PersistentQueryInputError("Query interval must contain 1-1000 verified heights.");
  }
  const limit = query.limit ?? 50;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PERSISTENT_QUERY_ITEMS) {
    throw new PersistentQueryInputError("Query limit must be 1-100.");
  }
  return limit;
}

function continuation(cursor: string | undefined, identity: unknown, dimensions: number): readonly number[] | null {
  if (!cursor) return null;
  try {
    if (cursor.length > 1_024 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { identity: unknown; after: unknown };
    if (JSON.stringify(decoded.identity) !== JSON.stringify(identity)
      || !Array.isArray(decoded.after) || decoded.after.length !== dimensions
      || !decoded.after.every((item: unknown) => Number.isSafeInteger(item) && Number(item) >= 0)) throw new Error();
    return decoded.after;
  } catch { throw new PersistentQueryInputError("Unknown, stale, or mismatched query cursor."); }
}

function nextCursor(identity: unknown, after: readonly number[]): string {
  return Buffer.from(JSON.stringify({ identity, after }), "utf8").toString("base64url");
}

/** Fresh READY proof plus an unchanged block, never a relaxed old snapshot cursor. */
function businessContinuation(query: HeightIntervalQuery, coverage: readonly BlockCoverageContract[], dimensions: 2 | 3): readonly number[] | null {
  if (query.after === undefined) return null;
  const point = query.after;
  if (!point || typeof point !== "object" || Array.isArray(point)
    || Object.keys(point).sort().join(",") !== (dimensions === 3 ? "allocationIndex,blockHash,blockHeight,txIndex" : "blockHash,blockHeight,txIndex")
    || !Number.isSafeInteger(point.blockHeight) || point.blockHeight < query.fromHeight || point.blockHeight > query.toHeight
    || !HEX_32.test(point.blockHash) || !Number.isSafeInteger(point.txIndex) || point.txIndex < 0
    || (dimensions === 3 && (!Number.isSafeInteger(point.allocationIndex) || point.allocationIndex! < 0))) {
    throw new PersistentQueryInputError("Invalid canonical business position.");
  }
  const anchor = coverage.find(row => row.blockHeight === point.blockHeight);
  if (anchor?.coverage !== "COMPLETE" || anchor.blockHash !== point.blockHash || anchor.transactionCount === null || point.txIndex >= anchor.transactionCount) {
    throw new PersistentQueryInputError("Canonical business position changed or is unverified.");
  }
  return dimensions === 3 ? [point.blockHeight, point.txIndex, point.allocationIndex!] : [point.blockHeight, point.txIndex];
}

function laterPosition(left: readonly number[], right: readonly number[]): boolean {
  for (let i = 0; i < left.length; i++) { if (left[i] !== right[i]) return left[i]! > right[i]!; }
  return true;
}

function assetContract(asset: IndexerConsensusState["indexedAssets"] extends ReadonlyMap<string, infer T> ? T : never): AssetContract {
  return { ...asset, locator: { ...asset.locator }, totalSupply: asset.totalSupply.toString() };
}

function transferContract(record: IndexerConsensusState["transferRecords"][number]): TransferContract {
  return {
    ...record,
    allocations: record.allocations.map((allocation) => ({
      receiverAccount: allocation.receiverAccount,
      amount: allocation.amount.toString(),
    })),
  };
}

function cursorFor(transfer: TransferContract): string {
  return `${transfer.blockHeight}:${transfer.txIndex}:${transfer.txidDisplayBytes}`;
}

export class IndexerQueryService {
  constructor(
    private readonly stateProvider: () => IndexerConsensusState,
    private readonly statusProvider: () => IndexerStatus,
    private readonly exactStorage?: ExactQueryStoragePort,
    private readonly transferHistory?: {readTransferPage(query:TransferQuery):TransferPageContract},
  ) {}

  getStatus(): IndexerStatusContract {
    const state = this.stateProvider();
    return {
      status: this.statusProvider(),
      canonicalTip: state.canonicalTip ? { ...state.canonicalTip } : null,
      lastVerifiedHeight: state.lastVerifiedHeight,
      stateHash: state.stateHash,
      ...(this.exactStorage?.readQueryProjectionDiagnostic ? { queryProjectionDiagnostic: this.exactStorage.readQueryProjectionDiagnostic() } : {}),
    };
  }

  getAssetById(assetId: string): AssetContract | null {
    const asset = this.stateProvider().indexedAssets.get(assetId);
    return asset ? assetContract(asset) : null;
  }

  getAssetByName(name: string): AssetContract | null {
    const state = this.stateProvider();
    const assetId = state.protocolState.assetIdByName.get(name);
    if (!assetId) return null;
    const asset = state.indexedAssets.get(assetId);
    return asset ? assetContract(asset) : null;
  }

  /** Occupancy is a canonical directory fact, independent of display metadata. */
  isNameTaken(name: string): boolean {
    return this.stateProvider().protocolState.assetIdByName.has(name);
  }

  getAssetByLocator(blockHeight: number, txIndex: number): AssetContract | null {
    const state = this.stateProvider();
    const assetId = state.protocolState.assetIdByLocator.get(`${blockHeight}:${txIndex}`);
    if (!assetId) return null;
    const asset = state.indexedAssets.get(assetId);
    return asset ? assetContract(asset) : null;
  }

  listBalancesByAccount(accountKey: string): readonly BalanceContract[] {
    return [...this.stateProvider().protocolState.balances.entries()]
      .filter(([key, balance]) => key.endsWith(`:${accountKey}`) && balance > 0n)
      .map(([key, balance]) => ({
        assetId: key.slice(0, key.indexOf(":")),
        accountKey,
        balance: balance.toString(),
      }))
      .sort((left, right) => compareStrings(left.assetId, right.assetId));
  }

  getBalance(assetId: string, accountKey: string): BalanceContract {
    return this.balanceForState(assetId, accountKey, this.stateProvider());
  }

  private balanceForState(assetId: string, accountKey: string, state: IndexerConsensusState): BalanceContract {
    const canonical = state.protocolState.balances.get(`${assetId}:${accountKey}`) ?? 0n;
    const balance = this.exactStorage
      ? this.exactStorage.readBalanceByAssetAccount(assetId, accountKey)
      : canonical;
    if (balance !== canonical) throw new Error("QUERY_EXACT_BALANCE_STATE_MISMATCH");
    return { assetId, accountKey, balance: balance.toString() };
  }

  getTransferByTxid(txid: string): TransferContract | null {
    if (!this.exactStorage) throw new Error("QUERY_EXACT_TRANSFER_PORT_REQUIRED");
    const transfer = this.exactStorage.readTransferByTxid(txid);
    return transfer ? transferContract(transfer) : null;
  }

  getCanonicalBlockHash(height: number): string | null {
    if (!this.exactStorage) throw new Error("QUERY_EXACT_TRANSFER_PORT_REQUIRED");
    return this.exactStorage.readCanonicalBlockHash(height);
  }

  private verifiedSnapshot(state: IndexerConsensusState): QuerySnapshotContract {
    if (this.statusProvider() !== "READY" || !state.canonicalTip
      || state.lastVerifiedHeight !== state.canonicalTip.height) throw new Error("QUERY_READY_SNAPSHOT_REQUIRED");
    return { canonicalTip: { ...state.canonicalTip }, stateHash: state.stateHash };
  }

  private assertProjectionSnapshot(snapshot: QuerySnapshotContract): void {
    if (!this.exactStorage?.readQueryProjectionHead) throw new Error("QUERY_PERSISTENT_PORT_REQUIRED");
    const projection = this.exactStorage.readQueryProjectionHead();
    if (projection.stateHash !== snapshot.stateHash || projection.canonicalTip.height !== snapshot.canonicalTip.height
      || projection.canonicalTip.hash !== snapshot.canonicalTip.hash) throw new Error("QUERY_PROJECTION_SNAPSHOT_MISMATCH");
  }

  getAssetMaturity(input: AssetMaturityQuery): AssetMaturityContract {
    return this.assetMaturityForState(input, this.stateProvider());
  }

  private assetMaturityForState(input: AssetMaturityQuery, state: IndexerConsensusState): AssetMaturityContract {
    if (!HEX_32.test(input.assetId) || (input.deployTxidDisplayBytes !== undefined && !HEX_32.test(input.deployTxidDisplayBytes))
      || (input.locator && (!Number.isSafeInteger(input.locator.blockHeight) || input.locator.blockHeight < 0
        || !Number.isSafeInteger(input.locator.txIndex) || input.locator.txIndex < 0))) {
      throw new PersistentQueryInputError("Invalid canonical asset identity.");
    }
    const snapshot = this.verifiedSnapshot(state);
    const finalThroughHeight = snapshot.canonicalTip.height - 6;
    const asset = state.indexedAssets.get(input.assetId);
    const locatorAssetId = input.locator
      ? state.protocolState.assetIdByLocator.get(`${input.locator.blockHeight}:${input.locator.txIndex}`) : undefined;
    const unknown = { snapshot, finalThroughHeight, status: "UNKNOWN" as const, asset: null };
    if (!asset) return locatorAssetId && locatorAssetId !== input.assetId
      ? { ...unknown, status: "ASSET_MISMATCH" } : unknown;
    const canonical = state.protocolState.assetsById.get(input.assetId);
    if (!canonical || asset.deployHeight > snapshot.canonicalTip.height || state.protocolState.assetIdByLocator.get(`${asset.deployHeight}:${asset.deployTxIndex}`) !== input.assetId
      || canonical.deployTxid !== asset.deployTxidDisplayBytes
      || asset.locator.blockHeight !== asset.deployHeight || asset.locator.txIndex !== asset.deployTxIndex
      || canonical.locator.blockHeight !== asset.deployHeight || canonical.locator.txIndex !== asset.deployTxIndex) return unknown;
    if ((input.locator && (locatorAssetId !== input.assetId || input.locator.blockHeight !== asset.deployHeight || input.locator.txIndex !== asset.deployTxIndex))
      || (input.deployTxidDisplayBytes && input.deployTxidDisplayBytes !== asset.deployTxidDisplayBytes)) {
      return { snapshot, finalThroughHeight, asset: assetContract(asset), status: "ASSET_MISMATCH" };
    }
    // Readiness is one confirmation; finality remains the separate tip-minus-six boundary.
    return { snapshot, finalThroughHeight, asset: assetContract(asset), status: asset.deployHeight <= snapshot.canonicalTip.height ? "MATURE" : "IMMATURE" };
  }

  listRecipientTransfers(query: RecipientTransferQuery): RecipientTransferPageContract {
    if (!HEX_32.test(query.assetId) || !HEX_32.test(query.recipientAccount)) throw new PersistentQueryInputError("Invalid recipient transfer scope.");
    const snapshot = this.verifiedSnapshot(this.stateProvider());
    const limit = interval(query, snapshot.canonicalTip.height);
    const scope = { assetId: query.assetId, recipientAccount: query.recipientAccount, fromHeight: query.fromHeight, toHeight: query.toHeight, ...(query.after ? { after: query.after } : {}) };
    const identity = { version: 2, kind: "RECIPIENT", snapshot, scope };
    const cursorAfter = continuation(query.cursor, identity, 3);
    this.assertProjectionSnapshot(snapshot);
    if (!this.exactStorage?.readRecipientTransfers || !this.exactStorage.readQueryCoverage) throw new Error("QUERY_PERSISTENT_PORT_REQUIRED");
    const coverage = this.exactStorage.readQueryCoverage(query.fromHeight, query.toHeight);
    const businessAfter = businessContinuation(query, coverage, 3);
    if (cursorAfter && businessAfter && !laterPosition(cursorAfter, businessAfter)) throw new PersistentQueryInputError("Cursor precedes business position.");
    const rows = this.exactStorage.readRecipientTransfers(query, cursorAfter ?? businessAfter, limit + 1);
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    this.assertProjectionSnapshot(snapshot);
    return { snapshot, scope, coverage, items,
      nextCursor: rows.length > limit && last ? nextCursor(identity, [last.blockHeight, last.txIndex, last.allocationIndex]) : null };
  }

  listBlockOutcomes(query: HeightIntervalQuery): BlockOutcomePageContract {
    const snapshot = this.verifiedSnapshot(this.stateProvider());
    const limit = interval(query, snapshot.canonicalTip.height);
    const scope = { fromHeight: query.fromHeight, toHeight: query.toHeight, ...(query.after ? { after: query.after } : {}) };
    const identity = { version: 2, kind: "OUTCOMES", snapshot, scope };
    const cursorAfter = continuation(query.cursor, identity, 2);
    this.assertProjectionSnapshot(snapshot);
    if (!this.exactStorage?.readBlockOutcomes || !this.exactStorage.readQueryCoverage) throw new Error("QUERY_PERSISTENT_PORT_REQUIRED");
    const coverage = this.exactStorage.readQueryCoverage(query.fromHeight, query.toHeight);
    const businessAfter = businessContinuation(query, coverage, 2);
    if (cursorAfter && businessAfter && !laterPosition(cursorAfter, businessAfter)) throw new PersistentQueryInputError("Cursor precedes business position.");
    const rows = this.exactStorage.readBlockOutcomes(query, cursorAfter ?? businessAfter, limit + 1);
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    this.assertProjectionSnapshot(snapshot);
    return { snapshot, scope, coverage, items,
      nextCursor: rows.length > limit && last ? nextCursor(identity, [last.blockHeight, last.txIndex]) : null };
  }

  getBalanceWithRecentIncoming(input: BalanceWithRecentIncomingQuery): BalanceWithRecentIncomingContract {
    if (!HEX_32.test(input.assetId) || !HEX_32.test(input.accountKey)) throw new PersistentQueryInputError("Invalid balance/incoming scope.");
    if (!hasCanonicalDeploymentPin(input)) throw new PersistentQueryInputError("A valid canonical deployment locator or txid pin is required.");
    const state = this.stateProvider(), snapshot = this.verifiedSnapshot(state);
    const scope = { assetId: input.assetId, accountKey: input.accountKey, ...(input.locator ? { locator: input.locator } : {}),
      ...(input.deployTxidDisplayBytes ? { deployTxidDisplayBytes: input.deployTxidDisplayBytes } : {}) } as BalanceWithRecentIncomingContract["scope"];
    this.assertProjectionSnapshot(snapshot);
    const maturity = this.assetMaturityForState(input, state);
    const asset = maturity.status === "MATURE" ? maturity.asset : null;
    // No transfers in this asset precede its canonical deployment. This also
    // avoids demanding nonexistent pre-activation coverage for a new asset.
    const window = asset ? { fromHeight: Math.max(asset.deployHeight, snapshot.canonicalTip.height - 5), toHeight: snapshot.canonicalTip.height } : null;
    const identity = { version: 2, kind: "BALANCE_INCOMING", snapshot, scope, window };
    const after = continuation(input.cursor, identity, 3);
    const limit = interval({ fromHeight: window?.fromHeight ?? snapshot.canonicalTip.height, toHeight: snapshot.canonicalTip.height, limit: input.limit }, snapshot.canonicalTip.height);
    if (!this.exactStorage?.readRecipientTransfers || !this.exactStorage.readQueryCoverage || !this.exactStorage.readExternalIncomingTotal) throw new Error("QUERY_PERSISTENT_PORT_REQUIRED");
    if (!asset || !window) {
      this.assertProjectionSnapshot(snapshot);
      return { snapshot, scope, asset: null, balance: null, window: null, status: "UNKNOWN", coverage: [], items: [], recentIncomingPageAmount: null, recentIncomingTotal: null, externalIncomingAllocationCount: null, nextCursor: null };
    }
    const balance = this.balanceForState(input.assetId, input.accountKey, state);
    const rows = this.exactStorage.readRecipientTransfers({ assetId: input.assetId, recipientAccount: input.accountKey, ...window }, after, limit + 1, input.accountKey);
    const items = rows.slice(0, limit), last = items.at(-1);
    const coverage = this.exactStorage.readQueryCoverage(window.fromHeight, window.toHeight);
    const complete = coverage.length === window.toHeight - window.fromHeight + 1 && coverage.every((row, index) => row.blockHeight === window.fromHeight + index && row.coverage === "COMPLETE");
    const total = complete ? this.exactStorage.readExternalIncomingTotal({ assetId: input.assetId, recipientAccount: input.accountKey, ...window }) : null;
    if (items.some((row) => row.senderAccount === input.accountKey)) throw new Error("QUERY_EXTERNAL_INCOMING_SCOPE_MISMATCH");
    this.assertProjectionSnapshot(snapshot);
    return { snapshot, scope, asset, balance, window, coverage, items, status: complete ? "COVERAGE_COMPLETE" : "UNKNOWN",
      recentIncomingPageAmount: complete ? items.reduce((sum, row) => sum + BigInt(row.amount), 0n).toString() : null,
      recentIncomingTotal: total?.amount.toString() ?? null, externalIncomingAllocationCount: total?.allocationCount ?? null,
      nextCursor: rows.length > limit && last ? nextCursor(identity, [last.blockHeight, last.txIndex, last.allocationIndex]) : null };
  }

  getLiabilityView(input: LiabilityViewQuery): LiabilityViewDataContract {
    if (!Array.isArray(input.txids) || input.txids.length < 1 || input.txids.length > 20
      || input.txids.some(txid => !HEX_32.test(txid)) || new Set(input.txids).size !== input.txids.length) throw new PersistentQueryInputError("Provide 1-20 distinct original txids.");
    const incoming = this.getBalanceWithRecentIncoming({ assetId: input.assetId, accountKey: input.accountKey,
      ...(input.locator ? { locator: input.locator } : {}), ...(input.deployTxidDisplayBytes ? { deployTxidDisplayBytes: input.deployTxidDisplayBytes } : {}), limit:1 } as BalanceWithRecentIncomingQuery);
    const storage = this.exactStorage;
    if (!storage?.readCompleteProjectionCoverage || !storage.readOutcomeByTxid || !storage.readAppliedAllocationsByTxid) throw new Error("QUERY_LIABILITY_PORT_REQUIRED");
    const completeProjectionCoverage = storage.readCompleteProjectionCoverage();
    const complete = incoming.status === "COVERAGE_COMPLETE" && completeProjectionCoverage.coverage === "COMPLETE"
      && completeProjectionCoverage.throughHeight === incoming.snapshot.canonicalTip.height;
    const records = input.txids.map(txid => {
      if (!complete) return { txid, outcome:"INSUFFICIENT_EVIDENCE" as const, current:null };
      const currentOutcome = storage.readOutcomeByTxid!(txid);
      if (!currentOutcome) return { txid, outcome:"NOT_APPLIED_IN_VIEW" as const, current:null };
      const coverage = storage.readQueryCoverage!(currentOutcome.blockHeight,currentOutcome.blockHeight)[0];
      if (coverage?.coverage !== "COMPLETE" || coverage.blockHash !== currentOutcome.blockHash) return { txid,outcome:"INSUFFICIENT_EVIDENCE" as const,current:null };
      const allocations = currentOutcome.result.status === "APPLIED" ? storage.readAppliedAllocationsByTxid!(txid) : [];
      return { txid, outcome:currentOutcome.result.status === "NO_OP" ? "NOT_APPLIED_IN_VIEW" as const
        : currentOutcome.result.assetId === input.assetId && allocations.length > 0 ? "APPLIED_IN_VIEW" as const : "INSUFFICIENT_EVIDENCE" as const,
        current:{ outcome:currentOutcome,allocations } };
    });
    this.assertProjectionSnapshot(incoming.snapshot);
    return { snapshot:incoming.snapshot, scope:{ assetId:input.assetId,accountKey:input.accountKey,txids:[...input.txids],
      ...(input.locator ? { locator:input.locator } : {}), ...(input.deployTxidDisplayBytes ? { deployTxidDisplayBytes:input.deployTxidDisplayBytes } : {}) } as LiabilityViewQuery,
      status:complete ? "COVERAGE_COMPLETE" : "INSUFFICIENT_EVIDENCE", asset:incoming.asset,balance:incoming.balance,
      window:incoming.window, coverage:incoming.coverage,completeProjectionCoverage,recentIncomingTotal:incoming.recentIncomingTotal,
      externalIncomingAllocationCount:incoming.externalIncomingAllocationCount,records };
  }

  listTransfers(query: TransferQuery = {}): TransferPageContract {
    const limit = query.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("Transfer query limit must be 1-100.");
    const history = this.transferHistory ?? (this.exactStorage?.readTransferPage ? this.exactStorage : undefined);
    if (history?.readTransferPage) return history.readTransferPage(query);
    let records = this.stateProvider().transferRecords.map(transferContract)
      .filter((record) => !query.assetId || record.assetId === query.assetId)
      .filter((record) => !query.accountKey
        || record.senderAccount === query.accountKey
        || record.allocations.some((allocation) => allocation.receiverAccount === query.accountKey))
      .sort((left, right) => left.blockHeight - right.blockHeight || left.txIndex - right.txIndex || compareStrings(left.txidDisplayBytes, right.txidDisplayBytes));
    if (query.cursor) {
      const cursorIndex = records.findIndex((record) => cursorFor(record) === query.cursor);
      if (cursorIndex < 0) throw new Error("Unknown or stale transfer cursor.");
      records = records.slice(cursorIndex + 1);
    }
    const items = records.slice(0, limit);
    return {
      items,
      nextCursor: records.length > limit && items.length > 0 ? cursorFor(items[items.length - 1]!) : null,
    };
  }
}
