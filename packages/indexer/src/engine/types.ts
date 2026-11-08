import type {
  ApplyResult,
  AssetLocator,
  ProtocolState,
  TransactionContext,
} from "@aibrc/protocol";

export interface OfflineTransactionMetadata {
  readonly inputAuthorizationRuleId: string;
  readonly txIndex: number;
  readonly txidDisplayBytes: string;
  readonly payloadSource: { readonly kind: "CANONICAL_OUTPUT_EXTRACTION" };
  readonly bitcoinTransactionContext: {
    readonly inputs: TransactionContext["inputs"];
    readonly outputs: ReadonlyArray<
      Omit<TransactionContext["outputs"][number], "valueSats"> & { readonly valueSats: bigint | string }
    >;
  };
}

export interface IndexedAssetRecord {
  readonly assetId: string;
  readonly name: string;
  readonly compactLocatorHex: string;
  readonly locator: AssetLocator;
  readonly deployTxidDisplayBytes: string;
  readonly deployHeight: number;
  readonly deployTxIndex: number;
  readonly deployerAccount: string;
  readonly ownerAccount: string;
  readonly totalSupply: bigint;
}

export interface IndexedTransferAllocation {
  readonly receiverAccount: string;
  readonly amount: bigint;
}

export interface IndexedTransferRecord {
  readonly txidDisplayBytes: string;
  readonly blockHeight: number;
  readonly txIndex: number;
  readonly assetId: string;
  readonly senderAccount: string;
  readonly allocations: readonly IndexedTransferAllocation[];
}

export interface TransactionOutcome {
  readonly txidDisplayBytes: string;
  readonly txIndex: number;
  readonly result: ApplyResult;
}

export interface CanonicalTip {
  readonly height: number;
  readonly hash: string;
}

export interface IndexerConsensusState {
  readonly protocolState: ProtocolState;
  readonly indexedAssets: ReadonlyMap<string, IndexedAssetRecord>;
  readonly transferRecords: readonly IndexedTransferRecord[];
  readonly canonicalTip: CanonicalTip | null;
  readonly lastVerifiedHeight: number | null;
  readonly stateHash: string;
  readonly lastBlockOutcomes: readonly TransactionOutcome[];
}

export interface SerializedEngineSnapshot {
  readonly schemaVersion: 1 | 2;
  readonly inputAuthorizationRuleId: string;
  readonly protocolStateHex: string;
  readonly indexedAssets: ReadonlyArray<{
    readonly assetId: string;
    readonly name: string;
    readonly compactLocatorHex: string;
    readonly locator: AssetLocator;
    readonly deployTxidDisplayBytes: string;
    readonly deployHeight: number;
    readonly deployTxIndex: number;
    readonly deployerAccount: string;
    readonly ownerAccount: string;
    readonly totalSupply: string;
  }>;
  /** V1 explicit exports/reference snapshots contain history; persistent v2 is []. */
  readonly transferRecords: ReadonlyArray<{
    readonly txidDisplayBytes: string;
    readonly blockHeight: number;
    readonly txIndex: number;
    readonly assetId: string;
    readonly senderAccount: string;
    readonly allocations: ReadonlyArray<{ readonly receiverAccount: string; readonly amount: string }>;
  }>;
  readonly canonicalTip: CanonicalTip | null;
  readonly lastVerifiedHeight: number | null;
  readonly stateHash: string;
  readonly lastBlockOutcomes: readonly TransactionOutcome[];
}
