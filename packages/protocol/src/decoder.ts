import { Buffer } from "buffer";
import { sha256Bytes } from "./hash.js";
import {
  classifyExtractedAibrcTransaction,
  extractAibrcPayloadsFromOutputs,
  type AibrcScriptExtraction,
  type ProtocolClassificationContext,
  type ProtocolInstruction,
  type ReasonCode,
} from "./index.js";

export interface DecodedInput {
  readonly txidDisplayBytes: string;
  readonly vout: number;
  readonly scriptSigHex: string;
  readonly sequence: number;
  readonly witnessHex: readonly string[];
}

export interface DecodedOutput {
  readonly valueSats: bigint;
  readonly scriptPubKeyHex: string;
  readonly protocolPayloadHex: string | null;
  readonly aibrcExtraction: AibrcScriptExtraction;
}

export interface DecodedBitcoinTransaction {
  readonly version: number;
  readonly lockTime: number;
  readonly hasWitness: boolean;
  readonly inputs: readonly DecodedInput[];
  readonly outputs: readonly DecodedOutput[];
  readonly protocolPayloadsHex: readonly string[];
  readonly protocol: {
    readonly status: "VALID" | "NO_OP" | "NEEDS_UPGRADE" | "UNCLASSIFIED";
    readonly reason: ReasonCode | "EXPECTED_NETWORK_REQUIRED" | "NAME_POLICY_CONTEXT_REQUIRED";
    readonly validMarkerCount: number;
    readonly malformedMarkerCount: number;
    readonly recognizedMarkerCount: number;
    readonly instruction?: ProtocolInstruction;
  };
  readonly strippedTransactionHex: string;
  readonly txidDisplayBytes: string;
  readonly totalBytes: number;
  readonly strippedBytes: number;
  readonly witnessBytes: number;
  readonly weight: number;
  readonly vsize: number;
}

export interface PrePostSignComparison {
  readonly equal: boolean;
  readonly reason: "MATCH" | "STRIPPED_TRANSACTION_CHANGED" | "TXID_CHANGED" | "PROTOCOL_PAYLOAD_CHANGED";
  readonly pre: DecodedBitcoinTransaction;
  readonly post: DecodedBitcoinTransaction;
}

interface CompactSize { value: number; nextOffset: number; }

function readCompactSize(buffer: Buffer, offset: number): CompactSize {
  if (offset >= buffer.length) throw new Error("TRUNCATED_COMPACT_SIZE");
  const prefix = buffer[offset]!;
  if (prefix < 0xfd) return { value: prefix, nextOffset: offset + 1 };
  if (prefix === 0xfd) {
    if (offset + 3 > buffer.length) throw new Error("TRUNCATED_COMPACT_SIZE");
    const value = buffer.readUInt16LE(offset + 1);
    if (value < 0xfd) throw new Error("NON_CANONICAL_COMPACT_SIZE");
    return { value, nextOffset: offset + 3 };
  }
  if (prefix === 0xfe) {
    if (offset + 5 > buffer.length) throw new Error("TRUNCATED_COMPACT_SIZE");
    const value = buffer.readUInt32LE(offset + 1);
    if (value <= 0xffff) throw new Error("NON_CANONICAL_COMPACT_SIZE");
    return { value, nextOffset: offset + 5 };
  }
  throw new Error("COMPACT_SIZE_U64_UNSUPPORTED_OFFLINE");
}

function compactSize(value: number): Buffer {
  if (value < 0xfd) return Buffer.from([value]);
  if (value <= 0xffff) { const result = Buffer.alloc(3); result[0] = 0xfd; result.writeUInt16LE(value, 1); return result; }
  const result = Buffer.alloc(5); result[0] = 0xfe; result.writeUInt32LE(value, 1); return result;
}

function readBytes(buffer: Buffer, offset: number, length: number): { bytes: Buffer; nextOffset: number } {
  if (!Number.isSafeInteger(length) || length < 0 || offset + length > buffer.length) throw new Error("TRUNCATED_TRANSACTION");
  return { bytes: buffer.subarray(offset, offset + length), nextOffset: offset + length };
}

function txid(bytes: Buffer): string {
  return sha256Bytes(sha256Bytes(bytes)).reverse().toString("hex");
}

export function decodeBitcoinTransaction(
  rawTransactionHex: string,
  classificationContext?: ProtocolClassificationContext,
): DecodedBitcoinTransaction {
  if (!/^[0-9a-fA-F]+$/.test(rawTransactionHex) || rawTransactionHex.length % 2 !== 0) throw new Error("INVALID_TRANSACTION_HEX");
  const raw = Buffer.from(rawTransactionHex, "hex");
  if (raw.length < 10) throw new Error("TRUNCATED_TRANSACTION");
  const versionBytes = raw.subarray(0, 4);
  const version = raw.readInt32LE(0);
  let offset = 4;
  const hasWitness = raw[offset] === 0 && raw[offset + 1] !== 0;
  if (hasWitness) offset += 2;
  const inputCount = readCompactSize(raw, offset);
  offset = inputCount.nextOffset;
  const strippedInputs: Buffer[] = [];
  const inputs: Array<Omit<DecodedInput, "witnessHex"> & { witnessHex: string[] }> = [];
  for (let index = 0; index < inputCount.value; index += 1) {
    const start = offset;
    const outpoint = readBytes(raw, offset, 36);
    offset = outpoint.nextOffset;
    const scriptLength = readCompactSize(raw, offset);
    const scriptLengthBytes = raw.subarray(offset, scriptLength.nextOffset);
    offset = scriptLength.nextOffset;
    const scriptSig = readBytes(raw, offset, scriptLength.value);
    offset = scriptSig.nextOffset;
    const sequenceBytes = readBytes(raw, offset, 4);
    offset = sequenceBytes.nextOffset;
    strippedInputs.push(Buffer.concat([raw.subarray(start, start + 36), scriptLengthBytes, scriptSig.bytes, sequenceBytes.bytes]));
    inputs.push({
      txidDisplayBytes: Buffer.from(outpoint.bytes.subarray(0, 32)).reverse().toString("hex"),
      vout: outpoint.bytes.readUInt32LE(32),
      scriptSigHex: scriptSig.bytes.toString("hex"),
      sequence: sequenceBytes.bytes.readUInt32LE(0),
      witnessHex: [],
    });
  }
  const outputCount = readCompactSize(raw, offset);
  const outputCountBytes = raw.subarray(offset, outputCount.nextOffset);
  offset = outputCount.nextOffset;
  const strippedOutputs: Buffer[] = [];
  const parsedOutputs: Array<Omit<DecodedOutput, "protocolPayloadHex" | "aibrcExtraction">> = [];
  for (let index = 0; index < outputCount.value; index += 1) {
    const value = readBytes(raw, offset, 8);
    offset = value.nextOffset;
    const scriptLength = readCompactSize(raw, offset);
    const scriptLengthBytes = raw.subarray(offset, scriptLength.nextOffset);
    offset = scriptLength.nextOffset;
    const script = readBytes(raw, offset, scriptLength.value);
    offset = script.nextOffset;
    strippedOutputs.push(Buffer.concat([value.bytes, scriptLengthBytes, script.bytes]));
    parsedOutputs.push({
      valueSats: value.bytes.readBigUInt64LE(),
      scriptPubKeyHex: script.bytes.toString("hex"),
    });
  }
  const extraction = extractAibrcPayloadsFromOutputs(parsedOutputs);
  const protocolPayloads = [...extraction.payloads];
  const outputs: DecodedOutput[] = parsedOutputs.map((output, outputIndex) => {
    const result = extraction.outputs[outputIndex]!.result;
    return {
      ...output,
      aibrcExtraction: result,
      protocolPayloadHex: result.status === "VALID_AIBRC_PAYLOAD" ? result.payload.toString("hex") : null,
    };
  });
  if (hasWitness) {
    for (const input of inputs) {
      const count = readCompactSize(raw, offset);
      offset = count.nextOffset;
      for (let item = 0; item < count.value; item += 1) {
        const length = readCompactSize(raw, offset);
        offset = length.nextOffset;
        const witness = readBytes(raw, offset, length.value);
        offset = witness.nextOffset;
        input.witnessHex.push(witness.bytes.toString("hex"));
      }
    }
  }
  const lockTime = readBytes(raw, offset, 4);
  offset = lockTime.nextOffset;
  if (offset !== raw.length) throw new Error("TRAILING_TRANSACTION_BYTES");
  const stripped = Buffer.concat([
    versionBytes,
    compactSize(inputCount.value),
    ...strippedInputs,
    outputCountBytes,
    ...strippedOutputs,
    lockTime.bytes,
  ]);
  const protocolClassification = classificationContext?.namePolicy
    ? classifyExtractedAibrcTransaction(extraction, classificationContext)
    : {
        status: "UNCLASSIFIED" as const,
        reason: classificationContext ? "NAME_POLICY_CONTEXT_REQUIRED" as const : "EXPECTED_NETWORK_REQUIRED" as const,
        validMarkerCount: extraction.validMarkerCount,
        malformedMarkerCount: extraction.malformedMarkerCount,
        recognizedMarkerCount: extraction.recognizedMarkerCount,
        instruction: undefined,
      };
  const witnessBytes = raw.length - stripped.length;
  const weight = stripped.length * 4 + witnessBytes;
  return {
    version,
    lockTime: lockTime.bytes.readUInt32LE(),
    hasWitness,
    inputs,
    outputs,
    protocolPayloadsHex: protocolPayloads.map((payload) => payload.toString("hex")),
    protocol: {
      status: protocolClassification.status,
      reason: protocolClassification.reason,
      validMarkerCount: protocolClassification.validMarkerCount,
      malformedMarkerCount: protocolClassification.malformedMarkerCount,
      recognizedMarkerCount: protocolClassification.recognizedMarkerCount,
      ...(protocolClassification.instruction ? { instruction: protocolClassification.instruction } : {}),
    },
    strippedTransactionHex: stripped.toString("hex"),
    txidDisplayBytes: txid(stripped),
    totalBytes: raw.length,
    strippedBytes: stripped.length,
    witnessBytes,
    weight,
    vsize: Math.ceil(weight / 4),
  };
}

export function addWitnessToUnsignedTransaction(rawUnsignedHex: string, witnessStacks: readonly (readonly string[])[]): string {
  const decoded = decodeBitcoinTransaction(rawUnsignedHex);
  if (decoded.hasWitness) throw new Error("Transaction already has witness data.");
  if (witnessStacks.length !== decoded.inputs.length) throw new Error("Witness stack count must match input count.");
  const stripped = Buffer.from(decoded.strippedTransactionHex, "hex");
  const lockTime = stripped.subarray(stripped.length - 4);
  const body = stripped.subarray(4, stripped.length - 4);
  const witness = Buffer.concat(witnessStacks.map((stack) => Buffer.concat([
    compactSize(stack.length),
    ...stack.map((hex) => {
      if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) throw new Error("Invalid witness hex.");
      const bytes = Buffer.from(hex, "hex");
      return Buffer.concat([compactSize(bytes.length), bytes]);
    }),
  ])));
  return Buffer.concat([stripped.subarray(0, 4), Buffer.from([0, 1]), body, witness, lockTime]).toString("hex");
}

export function comparePreAndPostSign(
  preSignHex: string,
  postSignHex: string,
  classificationContext?: ProtocolClassificationContext,
): PrePostSignComparison {
  const pre = decodeBitcoinTransaction(preSignHex, classificationContext);
  const post = decodeBitcoinTransaction(postSignHex, classificationContext);
  if (pre.strippedTransactionHex !== post.strippedTransactionHex) return { equal: false, reason: "STRIPPED_TRANSACTION_CHANGED", pre, post };
  if (pre.txidDisplayBytes !== post.txidDisplayBytes) return { equal: false, reason: "TXID_CHANGED", pre, post };
  if (JSON.stringify(pre.protocolPayloadsHex) !== JSON.stringify(post.protocolPayloadsHex)) return { equal: false, reason: "PROTOCOL_PAYLOAD_CHANGED", pre, post };
  return { equal: true, reason: "MATCH", pre, post };
}
