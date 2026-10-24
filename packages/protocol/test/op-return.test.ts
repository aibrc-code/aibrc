import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  classifyPayloadProfile,
  extractAibrcPayloadFromScript,
  extractAibrcPayloadsFromOutputs,
} from "../src/index.js";

interface ExtractionVector {
  id: string;
  scriptPubKeyHex: string;
  expectedStatus: "NOT_AIBRC" | "VALID_AIBRC_PAYLOAD" | "MALFORMED_AIBRC_MARKER";
  expectedReason: string | null;
  payloadHex: string | null;
}

const document = JSON.parse(readFileSync(
  new URL("../../../vectors/op-return-vectors.json", import.meta.url),
  "utf8",
)) as { count: number; vectors: ExtractionVector[] };

test("all canonical OP_RETURN extraction vectors replay", () => {
  assert.equal(document.count, 15);
  for (const vector of document.vectors) {
    const result = extractAibrcPayloadFromScript(vector.scriptPubKeyHex);
    assert.equal(result.status, vector.expectedStatus, vector.id);
    assert.equal(result.status === "MALFORMED_AIBRC_MARKER" ? result.reason : null, vector.expectedReason, vector.id);
    assert.equal(result.status === "VALID_AIBRC_PAYLOAD" ? result.payload.toString("hex") : null, vector.payloadHex, vector.id);
  }
});

test("multiple AIBR outputs remain separate for duplicate-marker classification", () => {
  const valid = document.vectors.find((vector) => vector.id === "minimal-direct-push")!;
  const extracted = extractAibrcPayloadsFromOutputs([
    { scriptPubKeyHex: valid.scriptPubKeyHex },
    { scriptPubKeyHex: "0014" + "11".repeat(20) },
    { scriptPubKeyHex: valid.scriptPubKeyHex },
  ]);
  assert.equal(extracted.payloads.length, 2);
  assert.equal(extracted.validMarkerCount, 2);
  assert.equal(extracted.malformedMarkerCount, 0);
  assert.equal(extracted.recognizedMarkerCount, 2);
});

test("only a complete first-push AIBR prefix contributes to marker counts", () => {
  const byId = (id: string) => document.vectors.find((vector) => vector.id === id)!;
  const extracted = extractAibrcPayloadsFromOutputs([
    { scriptPubKeyHex: byId("non-aibr-first-aibr-second-push").scriptPubKeyHex },
    { scriptPubKeyHex: byId("incomplete-magic-first-push").scriptPubKeyHex },
    { scriptPubKeyHex: byId("declared-length-mismatch").scriptPubKeyHex },
  ]);
  assert.deepEqual(
    { valid: extracted.validMarkerCount, malformed: extracted.malformedMarkerCount, recognized: extracted.recognizedMarkerCount },
    { valid: 0, malformed: 1, recognized: 1 },
  );
  assert.equal(extracted.outputs[2]?.result.status, "MALFORMED_AIBRC_MARKER");
});

test("80 and 81 bytes preserve profile boundary while 480/481 preserve hard-limit handoff", () => {
  for (const [length, profile] of [[80, "COMPATIBILITY"], [81, "EXTENDED"], [480, "EXTENDED"]] as const) {
    const vector = document.vectors.find((item) => item.id === `payload-${length}`)!;
    const result = extractAibrcPayloadFromScript(vector.scriptPubKeyHex);
    assert.equal(result.status, "VALID_AIBRC_PAYLOAD");
    if (result.status === "VALID_AIBRC_PAYLOAD") assert.equal(classifyPayloadProfile(result.payload), profile);
  }
  const oversized = document.vectors.find((item) => item.id === "payload-481")!;
  const result = extractAibrcPayloadFromScript(oversized.scriptPubKeyHex);
  assert.equal(result.status, "VALID_AIBRC_PAYLOAD");
  if (result.status === "VALID_AIBRC_PAYLOAD") assert.throws(() => classifyPayloadProfile(result.payload), /PAYLOAD_TOO_LARGE/);
});
