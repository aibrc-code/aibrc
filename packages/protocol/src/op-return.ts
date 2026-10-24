import { Buffer } from "buffer";
import {
  MAGIC,
  classifyProtocolPayload,
  type ProtocolClassificationContext,
  type TransactionClassificationResult,
} from "./index.js";

export type AibrcScriptExtraction =
  | { readonly status: "NOT_AIBRC" }
  | { readonly status: "VALID_AIBRC_PAYLOAD"; readonly payload: Buffer }
  | {
      readonly status: "MALFORMED_AIBRC_MARKER";
      readonly reason: "NON_MINIMAL_PUSH" | "PUSH_LENGTH_MISMATCH" | "TRAILING_SCRIPT_OPERATION";
    };

export interface AibrcOutputExtraction {
  readonly outputIndex: number;
  readonly result: AibrcScriptExtraction;
}

export interface AibrcOutputsExtraction {
  readonly outputs: readonly AibrcOutputExtraction[];
  readonly payloads: readonly Buffer[];
  readonly validMarkerCount: number;
  readonly malformedMarkerCount: number;
  readonly recognizedMarkerCount: number;
}

function startsWithMagic(bytes: Buffer): boolean {
  return bytes.length >= MAGIC.length && bytes.subarray(0, MAGIC.length).equals(MAGIC);
}

export function extractAibrcPayloadFromScript(scriptPubKeyHex: string): AibrcScriptExtraction {
  if (!/^[0-9a-fA-F]+$/.test(scriptPubKeyHex) || scriptPubKeyHex.length % 2 !== 0) return { status: "NOT_AIBRC" };
  const script = Buffer.from(scriptPubKeyHex, "hex");
  if (script[0] !== 0x6a || script.length < 2) return { status: "NOT_AIBRC" };

  const opcode = script[1]!;
  let declaredLength: number;
  let payloadOffset: number;
  let minimal = true;
  if (opcode <= 75) {
    declaredLength = opcode;
    payloadOffset = 2;
  } else if (opcode === 0x4c) {
    if (script.length < 3) return { status: "NOT_AIBRC" };
    declaredLength = script[2]!;
    payloadOffset = 3;
    minimal = declaredLength > 75;
  } else if (opcode === 0x4d) {
    if (script.length < 4) return { status: "NOT_AIBRC" };
    declaredLength = script.readUInt16LE(2);
    payloadOffset = 4;
    minimal = declaredLength > 0xff;
  } else if (opcode === 0x4e) {
    if (script.length < 6) return { status: "NOT_AIBRC" };
    declaredLength = script.readUInt32LE(2);
    payloadOffset = 6;
    minimal = false;
  } else {
    return { status: "NOT_AIBRC" };
  }

  const available = script.subarray(payloadOffset);
  const markerVisible = declaredLength >= MAGIC.length && startsWithMagic(available);
  if (!markerVisible) return { status: "NOT_AIBRC" };
  if (!minimal) return { status: "MALFORMED_AIBRC_MARKER", reason: "NON_MINIMAL_PUSH" };
  if (available.length < declaredLength) return { status: "MALFORMED_AIBRC_MARKER", reason: "PUSH_LENGTH_MISMATCH" };
  if (available.length > declaredLength) return { status: "MALFORMED_AIBRC_MARKER", reason: "TRAILING_SCRIPT_OPERATION" };
  return { status: "VALID_AIBRC_PAYLOAD", payload: Buffer.from(available.subarray(0, declaredLength)) };
}

export function extractAibrcPayloadsFromOutputs(
  outputs: readonly { readonly scriptPubKeyHex: string }[],
): AibrcOutputsExtraction {
  const discoveries = outputs.map((output, outputIndex) => ({
    outputIndex,
    result: extractAibrcPayloadFromScript(output.scriptPubKeyHex),
  }));
  const payloads = discoveries.flatMap(({ result }) => result.status === "VALID_AIBRC_PAYLOAD" ? [result.payload] : []);
  const malformedMarkerCount = discoveries.filter(({ result }) => result.status === "MALFORMED_AIBRC_MARKER").length;
  return {
    outputs: discoveries,
    payloads,
    validMarkerCount: payloads.length,
    malformedMarkerCount,
    recognizedMarkerCount: payloads.length + malformedMarkerCount,
  };
}

export function classifyExtractedAibrcTransaction(
  extraction: AibrcOutputsExtraction,
  context: ProtocolClassificationContext,
): TransactionClassificationResult {
  const counts = {
    validMarkerCount: extraction.validMarkerCount,
    malformedMarkerCount: extraction.malformedMarkerCount,
    recognizedMarkerCount: extraction.recognizedMarkerCount,
  };
  if (counts.recognizedMarkerCount >= 2) {
    return { status: "NO_OP", reason: "DUPLICATE_STATE_INSTRUCTION", ...counts };
  }
  if (counts.recognizedMarkerCount === 0) {
    return { status: "NO_OP", reason: "NOT_AIBRC", ...counts };
  }
  if (counts.malformedMarkerCount === 1) {
    const malformed = extraction.outputs.find(({ result }) => result.status === "MALFORMED_AIBRC_MARKER");
    if (!malformed || malformed.result.status !== "MALFORMED_AIBRC_MARKER") {
      throw new Error("MALFORMED_MARKER_COUNT_MISMATCH");
    }
    return { status: "NO_OP", reason: malformed.result.reason, ...counts };
  }
  return { ...classifyProtocolPayload(extraction.payloads[0]!, context), ...counts };
}
