import type { BlockReference } from "../core/index.js";
import { decodeBitcoinTransaction } from "@aibrc/protocol/decoder";
import { deriveInputSighashType, extractAibrcPayloadsFromOutputs, UNSUPPORTED_INPUT_SIGHASH } from "@aibrc/protocol";
import { decodeRawBitcoinBlock, type RawBitcoinBlockInput, type ResolvedPrevout, type SignetBlockProvider } from "../ingestion/index.js";
import type { BlockchainInfo, BlockHeaderInfo, IndexerBitcoinNetwork, RpcTransport, TestMempoolAcceptResult } from "./types.js";

interface VerbosePrevout { readonly scriptPubKey?: { readonly hex?: string } }
interface VerboseVin { readonly txid?: string; readonly vout?: number; readonly coinbase?: string; readonly prevout?: VerbosePrevout }
interface VerboseTx { readonly txid: string; readonly vin: readonly VerboseVin[] }
interface VerboseBlock { readonly hash: string; readonly height: number; readonly previousblockhash?: string; readonly tx: readonly VerboseTx[] }
interface TxOut { readonly scriptPubKey?: { readonly hex?: string } }

/**
 * Returned for any input whose sighash cannot be derived (unsupported prevout
 * script, missing/short witness, non key-path taproot witness). It is not a
 * valid Bitcoin sighash flag, so `validateAuthorization` yields UNSUPPORTED_SCRIPT
 * or UNSUPPORTED_SIGHASH and the instruction becomes a NO_OP — which is the
 * behaviour the protocol already specifies for such inputs.
 *
 * Ingestion must never throw at the state machine: a transaction merely carrying
 * the 4-byte AIBRC marker is attacker-controlled, and any input of it reaches
 * here (including BTC-only fee inputs, which the protocol never consults).
 * Throwing here previously halted the mainnet indexer permanently.
 */
const UNSUPPORTED_SIGHASH_SENTINEL = UNSUPPORTED_INPUT_SIGHASH;

/** Core's `-8 Block height out of range` — the only `-8` a tip race can produce. */
function isHeightOutOfRange(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /^(?:SIGNET|INDEXER)_RPC_ERROR:-8:/.test(message) && /height out of range/i.test(message);
}

const COINBASE_PREVOUT_TXID = "0".repeat(64);
const COINBASE_PREVOUT_VOUT = 0xffffffff;

/** Coinbase identity as defined by the raw transaction bytes (BIP30/consensus form). */
function isCoinbaseInput(input: { readonly txidDisplayBytes: string; readonly vout: number }): boolean {
  return input.txidDisplayBytes === COINBASE_PREVOUT_TXID && input.vout === COINBASE_PREVOUT_VOUT;
}

export class BitcoinCoreIndexerProvider implements SignetBlockProvider {
  private verified = false;

  constructor(
    private readonly rpc: RpcTransport,
    readonly network: IndexerBitcoinNetwork,
    private readonly mismatchCode = "INDEXER_NETWORK_IDENTITY_MISMATCH",
  ) {}

  async verifyNetwork(): Promise<BlockchainInfo> {
    const info = await this.getBlockchainInfo();
    const expectedChain = this.network === "mainnet" ? "main" : this.network;
    if (info.chain !== expectedChain) throw new Error(`${this.mismatchCode}:${info.chain}`);
    this.verified = true;
    return info;
  }

  getBlockchainInfo(): Promise<BlockchainInfo> { return this.rpc.call("getblockchaininfo"); }
  getBlockHash(height: number): Promise<string> { return this.rpc.call("getblockhash", [height]); }
  getBlockHeader(hash: string): Promise<BlockHeaderInfo> { return this.rpc.call("getblockheader", [hash, true]); }
  getBlock<T = unknown>(hash: string, verbosity: 0 | 1 | 2 | 3): Promise<T> { return this.rpc.call("getblock", [hash, verbosity]); }
  getRawTransaction(txid: string): Promise<string> { return this.rpc.call("getrawtransaction", [txid, false]); }
  getTxOut(txid: string, vout: number): Promise<TxOut | null> { return this.rpc.call("gettxout", [txid, vout, true]); }
  getBestBlockHash(): Promise<string> { return this.rpc.call("getbestblockhash"); }
  getBlockCount(): Promise<number> { return this.rpc.call("getblockcount"); }
  getIndexInfo<T = unknown>(): Promise<T> { return this.rpc.call("getindexinfo"); }
  /** Signet policy preflight only. Callers must never substitute this for Decoder validity. */
  async testMempoolAccept(rawTransactionHex: string): Promise<TestMempoolAcceptResult> {
    await this.ensureVerified();
    if (!/^[0-9a-fA-F]+$/.test(rawTransactionHex) || rawTransactionHex.length % 2 !== 0) throw new Error("INVALID_TRANSACTION_HEX");
    const results = await this.rpc.call<readonly TestMempoolAcceptResult[]>("testmempoolaccept", [[rawTransactionHex]]);
    if (results.length !== 1) throw new Error("TEST_MEMPOOL_ACCEPT_RESULT_MISMATCH");
    return results[0]!;
  }

  async getTip(): Promise<BlockReference | null> {
    await this.ensureVerified();
    const settled = this.network === "mainnet"
      ? await this.settledTip()
      : undefined;
    const height = settled?.height;
    const hash = settled === undefined ? await this.getBestBlockHash() : settled.hash;
    const header = await this.getBlockHeader(hash);
    if (height !== undefined && (header.height !== height || header.hash.toLowerCase() !== hash.toLowerCase())) {
      throw new Error("RPC_TIP_IDENTITY_MISMATCH");
    }
    return { height: header.height, hash: header.hash.toLowerCase() };
  }

  /**
   * `getTip()` on mainnet reads the height and the hash in two separate RPCs. A
   * reorg landing between them makes Core answer the second call with a perfectly
   * correct `-8 Block height out of range` — the height it just reported no longer
   * exists. That is an ordinary chain race, not a consensus failure, but it used to
   * reach classifySyncError as a bare `-8` and persist a sticky HALT recoverable
   * only by a destructive full re-index.
   *
   * Deliberately narrow: only a height-range error at THIS call site is retried, and
   * only once, by re-reading the count. Every other `-8` — and a second consecutive
   * race — keeps its own meaning; the retry surfaces as a typed transient rather
   * than being globally whitelisted in the classifier.
   */
  private async settledTip(): Promise<{ readonly height: number; readonly hash: string }> {
    const height = await this.getBlockCount();
    try {
      return { height, hash: await this.getBlockHash(height) };
    } catch (error) {
      if (!isHeightOutOfRange(error)) throw error;
      // The height Core reported no longer exists. Re-read it and use the height
      // that actually resolved — the caller's identity check compares the header
      // against this pair, so both must come from the same successful read.
      const settledHeight = await this.getBlockCount();
      try {
        return { height: settledHeight, hash: await this.getBlockHash(settledHeight) };
      } catch (retryError) {
        if (!isHeightOutOfRange(retryError)) throw retryError;
        throw new Error(`${this.network === "signet" ? "SIGNET" : "INDEXER"}_RPC_UNAVAILABLE:TIP_HEIGHT_RACE_UNSETTLED`);
      }
    }
  }

  async getRawBlock(height: number): Promise<RawBitcoinBlockInput | null> {
    await this.ensureVerified();
    let hash: string;
    try { hash = await this.getBlockHash(height); } catch (error) {
      if (error instanceof Error && /height|range|not found/i.test(error.message)) return null;
      throw error;
    }
    const [rawBlockHex, verbose] = await Promise.all([
      this.getBlock<string>(hash, 0),
      this.getBlock<VerboseBlock>(hash, 3),
    ]);
    if (verbose.hash.toLowerCase() !== hash.toLowerCase() || verbose.height !== height) throw new Error("RPC_BLOCK_IDENTITY_MISMATCH");
    const decodedBlock = decodeRawBitcoinBlock(height, rawBlockHex);
    if (decodedBlock.hash !== hash.toLowerCase()) throw new Error("RPC_RAW_BLOCK_HASH_MISMATCH");
    if (verbose.tx.length !== decodedBlock.rawTransactionsHex.length) throw new Error("RPC_TRANSACTION_COUNT_MISMATCH");
    const resolvedPrevoutsByTxid: Record<string, ResolvedPrevout[]> = {};
    for (let txIndex = 0; txIndex < decodedBlock.rawTransactionsHex.length; txIndex += 1) {
      const decoded = decodeBitcoinTransaction(decodedBlock.rawTransactionsHex[txIndex]!);
      const extracted = extractAibrcPayloadsFromOutputs(decoded.outputs);
      if (extracted.payloads.length === 0) continue;
      const verboseTx = verbose.tx[txIndex];
      if (!verboseTx || verboseTx.txid.toLowerCase() !== decoded.txidDisplayBytes) throw new Error("RPC_TRANSACTION_ORDER_MISMATCH");
      const resolved: ResolvedPrevout[] = [];
      for (let inputIndex = 0; inputIndex < decoded.inputs.length; inputIndex += 1) {
        const vin = verboseTx.vin[inputIndex];
        const decodedInput = decoded.inputs[inputIndex]!;
        if (!vin) throw new Error("RPC_INPUT_ORDER_MISMATCH");
        // A coinbase input spends no prevout, so it can never authorize an AIBRC
        // instruction — but a miner may still place the 4-byte marker in a coinbase
        // output. Resolve it as explicitly unauthorized rather than failing the block.
        //
        // Coinbase identity is decided by the RAW transaction (the object whose txid
        // and merkle root were verified), never by the verbose RPC alone: trusting
        // `vin.coinbase` on its own would let a lying or malfunctioning node skip the
        // txid/vout ordering check below and silently downgrade a valid instruction to
        // NO_OP. raw and verbose must agree in BOTH directions or the block is fatal —
        // the raw/verbose cross-check is a consensus-read integrity boundary.
        const rawIsCoinbase = isCoinbaseInput(decodedInput);
        if (rawIsCoinbase !== (vin.coinbase !== undefined)) throw new Error("RPC_COINBASE_IDENTITY_MISMATCH");
        if (rawIsCoinbase) {
          if (inputIndex !== 0 || decoded.inputs.length !== 1) throw new Error("RPC_COINBASE_INPUT_POSITION_INVALID");
          if (txIndex !== 0) throw new Error("RPC_COINBASE_TRANSACTION_POSITION_INVALID");
          resolved.push({ prevoutScriptPubKeyHex: "", sighashType: UNSUPPORTED_SIGHASH_SENTINEL });
          continue;
        }
        if (vin.txid?.toLowerCase() !== decodedInput.txidDisplayBytes || vin.vout !== decodedInput.vout) throw new Error("RPC_INPUT_ORDER_MISMATCH");
        const script = vin.prevout?.scriptPubKey?.hex ?? await this.resolvePrevoutScript(decodedInput.txidDisplayBytes, decodedInput.vout);
        resolved.push({ prevoutScriptPubKeyHex: script, sighashType: deriveInputSighashType(decodedInput.witnessHex, script) });
      }
      resolvedPrevoutsByTxid[decoded.txidDisplayBytes] = resolved;
    }
    return { height, rawBlockHex, resolvedPrevoutsByTxid };
  }

  private async resolvePrevoutScript(txid: string, vout: number): Promise<string> {
    if (this.network === "mainnet") {
      const raw = await this.getRawTransaction(txid);
      const output = decodeBitcoinTransaction(raw).outputs[vout];
      if (output) return output.scriptPubKeyHex;
      throw new Error(`PREVOUT_RESOLUTION_FAILED:${txid}:${vout}`);
    }
    const txout = await this.getTxOut(txid, vout);
    const liveScript = txout?.scriptPubKey?.hex;
    if (liveScript) return liveScript;
    try {
      const raw = await this.getRawTransaction(txid);
      const output = decodeBitcoinTransaction(raw).outputs[vout];
      if (output) return output.scriptPubKeyHex;
    } catch {}
    throw new Error(`PREVOUT_RESOLUTION_FAILED:${txid}:${vout}`);
  }

  private async ensureVerified(): Promise<void> {
    if (!this.verified) await this.verifyNetwork();
  }
}

export class BitcoinCoreSignetProvider extends BitcoinCoreIndexerProvider {
  constructor(rpc: RpcTransport) {
    super(rpc, "signet", "NON_SIGNET_CHAIN_REJECTED");
  }
}
