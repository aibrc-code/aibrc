import type { IndexerStatus } from "../core/types.js";

export interface QueryTip {
  readonly height: number;
  readonly hash: string;
}

export interface IndexerStatusContract {
  readonly status: IndexerStatus;
  readonly canonicalTip: QueryTip | null;
  readonly lastVerifiedHeight: number | null;
  readonly stateHash: string;
  /** Persistent operational notice; clearing history is not a full rebuild. */
  readonly queryProjectionDiagnostic?: QueryProjectionDiagnosticContract | null;
}

export type QueryProjectionDiagnosticContract = QueryHistoryResetDiagnosticContract | Readonly<{
  code: "UNREADABLE";
  reason: "INVALID_JSON" | "INVALID_FIELDS";
}>;

export interface QueryHistoryResetDiagnosticContract {
  readonly code: "QUERY_HISTORY_RESET";
  readonly reason: "LEGACY_PROJECTION" | "UNMAINTAINED_WRITER" | "FULL_REBUILD_REQUESTED";
  readonly recovery: "FULL_CANONICAL_REPLAY";
  readonly clearedAtUtc: string;
  readonly priorCanonicalHash: string | null;
  readonly priorProjectionVersion: string | null;
  readonly priorCanonicalHeight: number | null;
  readonly priorProjectionHeight: number | null;
}

export interface AssetContract {
  readonly assetId: string;
  readonly name: string;
  readonly compactLocatorHex: string;
  readonly locator: { readonly blockHeight: number; readonly txIndex: number };
  readonly deployTxidDisplayBytes: string;
  readonly deployHeight: number;
  readonly deployTxIndex: number;
  readonly deployerAccount: string;
  readonly ownerAccount: string;
  readonly totalSupply: string;
}

export interface BalanceContract {
  readonly assetId: string;
  readonly accountKey: string;
  readonly balance: string;
}

export interface TransferAllocationContract {
  readonly receiverAccount: string;
  readonly amount: string;
}

export interface TransferContract {
  readonly txidDisplayBytes: string;
  readonly blockHeight: number;
  readonly txIndex: number;
  readonly assetId: string;
  readonly senderAccount: string;
  readonly allocations: readonly TransferAllocationContract[];
}

export interface TransferQuery {
  readonly assetId?: string;
  readonly accountKey?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface TransferPageContract {
  readonly items: readonly TransferContract[];
  readonly nextCursor: string | null;
}

/** Snapshot identity is mandatory across pages; a changed tip requires a restart. */
export interface QuerySnapshotContract {
  readonly canonicalTip: QueryTip;
  readonly stateHash: string;
}

export interface HeightIntervalQuery {
  readonly fromHeight: number;
  readonly toHeight: number;
  readonly cursor?: string;
  readonly limit?: number;
  /** Durable business position. Valid only while this exact canonical block survives. */
  readonly after?: CanonicalQueryPosition;
}

export interface CanonicalQueryPosition {
  readonly blockHeight: number;
  readonly blockHash: string;
  readonly txIndex: number;
  readonly allocationIndex?: number;
}

export interface RecipientTransferQuery extends HeightIntervalQuery {
  readonly assetId: string;
  readonly recipientAccount: string;
}

export interface TransactionOutpointContract {
  readonly txidDisplayBytes: string;
  readonly vout: number;
}

/** One APPLIED allocation, not an inference from balance or a shared fee input. */
export interface RecipientTransferContract {
  readonly txidDisplayBytes: string;
  readonly blockHeight: number;
  readonly blockHash: string;
  readonly txIndex: number;
  readonly allocationIndex: number;
  readonly assetId: string;
  readonly senderAccount: string;
  readonly recipientAccount: string;
  readonly amount: string;
  readonly authInputIndex: number | null;
  readonly authInputOutpoint: TransactionOutpointContract | null;
  readonly identityEvidence: "COMPLETE" | "UNKNOWN";
  readonly inputCount: number | null;
  /** Hydrated from the verified outcome; not duplicated in allocation storage. */
  readonly inputOutpoints: readonly TransactionOutpointContract[] | null;
  readonly inputEvidence: "COMPLETE" | "UNKNOWN";
}

export type PinnedAssetIdentityQuery = AssetMaturityQuery & (
  Readonly<{ locator: { readonly blockHeight: number; readonly txIndex: number } }> | Readonly<{ deployTxidDisplayBytes: string }>
);

export type BalanceWithRecentIncomingQuery = PinnedAssetIdentityQuery & Readonly<{
  readonly accountKey: string;
  readonly cursor?: string;
  readonly limit?: number;
}>;

/** Full-window aggregate and bounded receipt page from one held snapshot. */
export interface BalanceWithRecentIncomingContract {
  readonly snapshot: QuerySnapshotContract;
  readonly scope: PinnedAssetIdentityQuery & { readonly accountKey: string };
  readonly asset: AssetContract | null;
  readonly balance: BalanceContract | null;
  readonly window: { readonly fromHeight: number; readonly toHeight: number } | null;
  readonly status: "COVERAGE_COMPLETE" | "UNKNOWN";
  readonly coverage: readonly BlockCoverageContract[];
  readonly items: readonly RecipientTransferContract[];
  /** PAGE ONLY. UNKNOWN coverage => null, never an invented zero. */
  readonly recentIncomingPageAmount: string | null;
  /** Exact FULL WINDOW aggregate, independent of the requested receipt page. */
  readonly recentIncomingTotal: string | null;
  readonly externalIncomingAllocationCount: number | null;
  readonly nextCursor: string | null;
}

/** Producer-maintained contiguous positive coverage, never inferred from READY. */
export interface CompleteProjectionCoverageContract {
  readonly fromHeight: number;
  readonly throughHeight: number;
  readonly coverage: "COMPLETE" | "UNKNOWN";
}

export type LiabilityViewQuery = PinnedAssetIdentityQuery & Readonly<{
  accountKey: string;
  txids: readonly string[];
}>;

export interface LiabilityTransactionContract {
  readonly txid: string;
  readonly outcome: "APPLIED_IN_VIEW" | "NOT_APPLIED_IN_VIEW" | "INSUFFICIENT_EVIDENCE";
  readonly current: Readonly<{ outcome: BlockOutcomeContract; allocations: readonly RecipientTransferContract[] }> | null;
}

/** Balance, complete recent aggregate and exact targeted effects from one session. */
export interface LiabilityViewDataContract {
  readonly snapshot: QuerySnapshotContract;
  readonly scope: LiabilityViewQuery;
  readonly status: "COVERAGE_COMPLETE" | "INSUFFICIENT_EVIDENCE";
  readonly asset: AssetContract | null;
  readonly balance: BalanceContract | null;
  readonly window: BalanceWithRecentIncomingContract["window"];
  readonly coverage: readonly BlockCoverageContract[];
  readonly completeProjectionCoverage: CompleteProjectionCoverageContract;
  readonly recentIncomingTotal: string | null;
  readonly externalIncomingAllocationCount: number | null;
  readonly records: readonly LiabilityTransactionContract[];
}

export interface BlockOutcomeContract {
  readonly blockHeight: number;
  readonly blockHash: string;
  readonly txidDisplayBytes: string;
  readonly txIndex: number;
  /** Positive canonical marker recognition, including malformed/duplicate markers. */
  readonly recognizedMarkerCount: number;
  readonly inputCount: number | null;
  /** Original input order; only verified raw bytes can establish this list. */
  readonly inputOutpoints: readonly TransactionOutpointContract[] | null;
  readonly inputEvidence: "COMPLETE" | "UNKNOWN";
  readonly authInputIndex: number | null;
  readonly authInputOutpoint: TransactionOutpointContract | null;
  /** A decoded instruction's selected input, not proof that its result is APPLIED. */
  readonly authorizationEvidence: "COMPLETE" | "UNKNOWN";
  readonly result: { readonly status: "APPLIED" | "NO_OP"; readonly reason: string; readonly assetId?: string };
}

export interface BlockCoverageContract {
  readonly blockHeight: number;
  readonly blockHash: string | null;
  readonly coverage: "COMPLETE" | "UNKNOWN";
  readonly transactionCount: number | null;
  readonly markedTransactionCount: number | null;
}

export interface RecipientTransferPageContract {
  readonly snapshot: QuerySnapshotContract;
  readonly scope: { readonly assetId: string; readonly recipientAccount: string; readonly fromHeight: number; readonly toHeight: number; readonly after?: CanonicalQueryPosition };
  readonly coverage: readonly BlockCoverageContract[];
  readonly items: readonly RecipientTransferContract[];
  readonly nextCursor: string | null;
}

export interface BlockOutcomePageContract {
  readonly snapshot: QuerySnapshotContract;
  readonly scope: { readonly fromHeight: number; readonly toHeight: number; readonly after?: CanonicalQueryPosition };
  readonly coverage: readonly BlockCoverageContract[];
  readonly items: readonly BlockOutcomeContract[];
  readonly nextCursor: string | null;
}

export interface AssetMaturityQuery {
  readonly assetId: string;
  /** When provided, must still resolve to this same canonical deployment. */
  readonly locator?: { readonly blockHeight: number; readonly txIndex: number };
  readonly deployTxidDisplayBytes?: string;
}

export interface AssetMaturityContract {
  readonly snapshot: QuerySnapshotContract;
  readonly status: "MATURE" | "IMMATURE" | "ASSET_MISMATCH" | "UNKNOWN";
  readonly asset: AssetContract | null;
  readonly finalThroughHeight: number;
}
