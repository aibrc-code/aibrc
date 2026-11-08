export interface SignetRpcConnectionConfig {
  readonly network: "signet";
  readonly url: string;
  readonly username?: string;
  readonly password?: string;
  readonly cookie?: string;
  readonly timeoutMs?: number;
}

export type IndexerBitcoinNetwork = "signet" | "mainnet" | "regtest";

export const MAINNET_ZERO_VALUE_CORE_RPC_METHODS = [
  "getblockchaininfo",
  "getblockcount",
  "getblockhash",
  "getblockheader",
  "getblock",
  "getrawtransaction",
  "getindexinfo",
] as const;

export type MainnetZeroValueCoreRpcMethod =
  (typeof MAINNET_ZERO_VALUE_CORE_RPC_METHODS)[number];

export interface IndexerRpcConnectionConfig {
  readonly network: IndexerBitcoinNetwork;
  readonly url: string;
  readonly username?: string;
  readonly password?: string;
  readonly cookie?: string;
  readonly timeoutMs?: number;
}

export interface RpcTransport {
  call<T>(method: ReadonlyRpcMethod, params?: readonly unknown[]): Promise<T>;
}

export type ReadonlyRpcMethod =
  | "getblockchaininfo"
  | "getblockcount"
  | "getblockhash"
  | "getblockheader"
  | "getblock"
  | "getrawtransaction"
  | "gettxout"
  | "getbestblockhash"
  | "getindexinfo"
  /** Policy simulation only; it never relays, stores, or broadcasts a transaction. */
  | "testmempoolaccept";

export type IndexerSyncRpcMethod = Exclude<ReadonlyRpcMethod, "testmempoolaccept">;

export interface TestMempoolAcceptResult {
  readonly txid?: string;
  readonly allowed: boolean;
  readonly "reject-reason"?: string;
}

export interface BlockchainInfo {
  readonly chain: string;
  readonly blocks: number;
  readonly headers: number;
  readonly bestblockhash: string;
  readonly initialblockdownload: boolean;
}

export interface BlockHeaderInfo {
  readonly hash: string;
  readonly height: number;
  readonly previousblockhash?: string;
  readonly confirmations: number;
}
