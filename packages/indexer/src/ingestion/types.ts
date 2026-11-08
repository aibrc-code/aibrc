import type { BlockReference } from "../core/index.js";

export interface ResolvedPrevout {
  readonly prevoutScriptPubKeyHex: string;
  readonly sighashType: number;
}

export interface RawBitcoinBlockInput {
  readonly height: number;
  readonly rawBlockHex: string;
  readonly resolvedPrevoutsByTxid?: Readonly<Record<string, readonly ResolvedPrevout[]>>;
}

export interface RawBitcoinTransactionInput {
  readonly rawTransactionHex: string;
  readonly txIndex: number;
  readonly resolvedPrevouts?: readonly ResolvedPrevout[];
}

export interface ParsedBitcoinBlockIdentity {
  readonly height: number;
  readonly hash: string;
  readonly previousHash: string;
  readonly transactionCount: number;
}

export interface DecodedRawBitcoinBlock extends ParsedBitcoinBlockIdentity {
  readonly rawTransactionsHex: readonly string[];
}

export interface SignetIngestionConfig {
  readonly network: "signet";
  readonly enabled: boolean;
}

export type IndexerIngestionNetwork = "signet" | "mainnet" | "regtest";

export interface NetworkBoundIngestionConfig {
  readonly network: IndexerIngestionNetwork;
  readonly enabled: boolean;
}

/** Read-only boundary. Implementations and credentials remain outside this package. */
export interface SignetBlockProvider {
  getTip(): Promise<BlockReference | null>;
  getRawBlock(height: number): Promise<RawBitcoinBlockInput | null>;
}

export interface NetworkBoundBlockProvider extends SignetBlockProvider {
  readonly network: IndexerIngestionNetwork;
}
