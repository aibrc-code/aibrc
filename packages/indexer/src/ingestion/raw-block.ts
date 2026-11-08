import { createHash } from "node:crypto";
import type { BlockTransaction, IndexerBlock } from "../core/index.js";
import { decodeBitcoinTransaction } from "@aibrc/protocol/decoder";
import { INPUT_AUTHORIZATION_RULE_ID, NetworkId, deriveInputSighashType, extractAibrcPayloadsFromOutputs, UNSUPPORTED_INPUT_SIGHASH } from "@aibrc/protocol";
import type { DecodedRawBitcoinBlock, ParsedBitcoinBlockIdentity, RawBitcoinBlockInput, RawBitcoinTransactionInput } from "./types.js";

const SIGNET_DECODER_CONTEXT = { expectedNetwork: NetworkId.SIGNET } as const;

function sha256d(bytes: Buffer): Buffer {
  return createHash("sha256").update(createHash("sha256").update(bytes).digest()).digest();
}

function displayHash(bytes: Buffer): string {
  return Buffer.from(bytes).reverse().toString("hex");
}

function requireBytes(bytes: Buffer, offset: number, length: number): number {
  if (!Number.isSafeInteger(length) || length < 0 || offset + length > bytes.length) throw new Error("TRUNCATED_BITCOIN_BYTES");
  return offset + length;
}

function compactSize(bytes: Buffer, offset: number): { value: number; next: number } {
  const tag = bytes[offset];
  if (tag === undefined) throw new Error("TRUNCATED_COMPACT_SIZE");
  if (tag < 0xfd) return { value: tag, next: offset + 1 };
  if (tag === 0xfd) {
    requireBytes(bytes, offset + 1, 2);
    const value = bytes.readUInt16LE(offset + 1);
    if (value < 0xfd) throw new Error("NON_CANONICAL_COMPACT_SIZE");
    return { value, next: offset + 3 };
  }
  if (tag === 0xfe) {
    requireBytes(bytes, offset + 1, 4);
    const value = bytes.readUInt32LE(offset + 1);
    if (value <= 0xffff) throw new Error("NON_CANONICAL_COMPACT_SIZE");
    return { value, next: offset + 5 };
  }
  requireBytes(bytes, offset + 1, 8);
  const value = bytes.readBigUInt64LE(offset + 1);
  if (value <= 0xffffffffn || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("INVALID_COMPACT_SIZE");
  return { value: Number(value), next: offset + 9 };
}

function transactionEnd(bytes: Buffer, start: number): number {
  let offset = requireBytes(bytes, start, 4);
  const hasWitness = bytes[offset] === 0 && bytes[offset + 1] !== 0;
  if (hasWitness) offset = requireBytes(bytes, offset, 2);
  const inputCount = compactSize(bytes, offset);
  offset = inputCount.next;
  for (let index = 0; index < inputCount.value; index += 1) {
    offset = requireBytes(bytes, offset, 36);
    const scriptLength = compactSize(bytes, offset);
    offset = requireBytes(bytes, scriptLength.next, scriptLength.value + 4);
  }
  const outputCount = compactSize(bytes, offset);
  offset = outputCount.next;
  for (let index = 0; index < outputCount.value; index += 1) {
    offset = requireBytes(bytes, offset, 8);
    const scriptLength = compactSize(bytes, offset);
    offset = requireBytes(bytes, scriptLength.next, scriptLength.value);
  }
  if (hasWitness) {
    for (let input = 0; input < inputCount.value; input += 1) {
      const itemCount = compactSize(bytes, offset);
      offset = itemCount.next;
      for (let item = 0; item < itemCount.value; item += 1) {
        const itemLength = compactSize(bytes, offset);
        offset = requireBytes(bytes, itemLength.next, itemLength.value);
      }
    }
  }
  return requireBytes(bytes, offset, 4);
}

function merkleRoot(txids: readonly string[]): Buffer {
  if (txids.length === 0) throw new Error("EMPTY_BITCOIN_BLOCK");
  let level: Buffer<ArrayBufferLike>[] = txids.map((txid) => Buffer.from(txid, "hex").reverse());
  while (level.length > 1) {
    if (level.length % 2 === 1) level.push(Buffer.from(level[level.length - 1]!));
    const next: Buffer<ArrayBufferLike>[] = [];
    for (let index = 0; index < level.length; index += 2) next.push(sha256d(Buffer.concat([level[index]!, level[index + 1]!]))) ;
    level = next;
  }
  return level[0]!;
}

export function parseRawBitcoinBlock(input: RawBitcoinBlockInput): IndexerBlock {
  if (!Number.isSafeInteger(input.height) || input.height < 0) throw new Error("INVALID_BLOCK_HEIGHT");
  const decodedBlock = decodeRawBitcoinBlock(input.height, input.rawBlockHex);
  const transactions: IndexerBlock["transactions"][number][] = decodedBlock.rawTransactionsHex.map((rawHex, txIndex) => {
    const decoded = decodeBitcoinTransaction(rawHex, SIGNET_DECODER_CONTEXT);
    const key = decoded.txidDisplayBytes.toLowerCase();
    const resolved = input.resolvedPrevoutsByTxid?.[key] ?? [];
    return adaptRawBitcoinTransaction({ rawTransactionHex: rawHex, txIndex, resolvedPrevouts: resolved });
  });
  return {
    height: input.height,
    hash: decodedBlock.hash,
    previousHash: decodedBlock.previousHash,
    transactions,
  };
}

export function decodeRawBitcoinBlock(height: number, rawBlockHex: string): DecodedRawBitcoinBlock {
  if (!Number.isSafeInteger(height) || height < 0) throw new Error("INVALID_BLOCK_HEIGHT");
  if (!/^[0-9a-fA-F]+$/.test(rawBlockHex) || rawBlockHex.length % 2 !== 0) throw new Error("INVALID_RAW_BLOCK_HEX");
  const raw = Buffer.from(rawBlockHex, "hex");
  if (raw.length < 81) throw new Error("TRUNCATED_BITCOIN_BLOCK");
  const header = raw.subarray(0, 80);
  const count = compactSize(raw, 80);
  let offset = count.next;
  const rawTransactionsHex: string[] = [];
  const txids: string[] = [];
  for (let txIndex = 0; txIndex < count.value; txIndex += 1) {
    const end = transactionEnd(raw, offset);
    const rawHex = raw.subarray(offset, end).toString("hex");
    offset = end;
    const decoded = decodeBitcoinTransaction(rawHex, SIGNET_DECODER_CONTEXT);
    txids.push(decoded.txidDisplayBytes.toLowerCase());
    rawTransactionsHex.push(rawHex);
  }
  if (offset !== raw.length) throw new Error("TRAILING_BLOCK_BYTES");
  if (!merkleRoot(txids).equals(header.subarray(36, 68))) throw new Error("MERKLE_ROOT_MISMATCH");
  return {
    height,
    hash: displayHash(sha256d(header)),
    previousHash: displayHash(header.subarray(4, 36)),
    transactionCount: rawTransactionsHex.length,
    rawTransactionsHex,
  };
}

export function adaptRawBitcoinTransaction(input: RawBitcoinTransactionInput): BlockTransaction {
  if (!Number.isSafeInteger(input.txIndex) || input.txIndex < 0) throw new Error("INVALID_TRANSACTION_INDEX");
  const decoded = decodeBitcoinTransaction(input.rawTransactionHex, SIGNET_DECODER_CONTEXT);
  const extraction = extractAibrcPayloadsFromOutputs(decoded.outputs);
  if (extraction.payloads.map((payload) => payload.toString("hex")).join(",") !== decoded.protocolPayloadsHex.join(",")) {
    throw new Error("DECODER_EXTRACTION_MISMATCH");
  }
  const key = decoded.txidDisplayBytes.toLowerCase();
  const resolved = input.resolvedPrevouts ?? [];
  if (extraction.payloads.length > 0 && resolved.length !== decoded.inputs.length) {
    throw new Error(`AIBRC transaction ${key} lacks complete prevout context.`);
  }
  const inputs = resolved.map((prevout, index) => {
    const input = decoded.inputs[index];
    if (!input) throw new Error("RAW_PREVOUT_INPUT_COUNT_MISMATCH");
    const coinbase = input.txidDisplayBytes === "0".repeat(64) && input.vout === 0xffffffff;
    if (coinbase) {
      if (index !== 0 || decoded.inputs.length !== 1) throw new Error("RAW_COINBASE_INPUT_POSITION_INVALID");
      if (prevout.prevoutScriptPubKeyHex !== "") throw new Error("RAW_COINBASE_PREVOUT_MISMATCH");
      return { prevoutScriptPubKeyHex: "", sighashType: UNSUPPORTED_INPUT_SIGHASH };
    }
    if (typeof prevout.prevoutScriptPubKeyHex !== "string" || !/^(?:[0-9a-fA-F]{2})*$/.test(prevout.prevoutScriptPubKeyHex)) {
      throw new Error("RAW_PREVOUT_SCRIPT_REQUIRED");
    }
    // Captured sighash metadata is not authoritative. Re-derive from the original
    // witness for replay just as the live provider does for freshly fetched blocks.
    return {
      prevoutScriptPubKeyHex: prevout.prevoutScriptPubKeyHex,
      sighashType: deriveInputSighashType(input.witnessHex, prevout.prevoutScriptPubKeyHex),
    };
  });
  return {
    txid: key,
    rawHex: input.rawTransactionHex.toLowerCase(),
    metadata: {
      inputAuthorizationRuleId: INPUT_AUTHORIZATION_RULE_ID,
      txIndex: input.txIndex,
      txidDisplayBytes: key,
      payloadSource: { kind: "CANONICAL_OUTPUT_EXTRACTION" },
      bitcoinTransactionContext: {
        inputs,
        outputs: decoded.outputs.map((output) => ({ valueSats: output.valueSats, scriptPubKeyHex: output.scriptPubKeyHex })),
      },
    },
  };
}

export function inspectRawBitcoinBlock(input: RawBitcoinBlockInput): ParsedBitcoinBlockIdentity {
  const block = parseRawBitcoinBlock(input);
  return { height: block.height, hash: block.hash, previousHash: block.previousHash!, transactionCount: block.transactions.length };
}
