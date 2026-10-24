import assert from "node:assert/strict";
import test from "node:test";
import { deriveInputSighashType, UNSUPPORTED_INPUT_SIGHASH } from "../src/index.js";

const taproot = `5120${"11".repeat(32)}`;
const p2wpkh = `0014${"22".repeat(20)}`;
const signature = "ab".repeat(64);
const controlBlock = `c0${"33".repeat(32)}`;

for (const [name, witness, expected] of [
  ["one aggregated key-path DEFAULT", [signature], 0],
  ["key-path explicit ALL", [`${signature}01`], 1],
  ["DEFAULT key-path with annex", [signature, "50abcd"], 0],
  ["ALL key-path with annex", [`${signature}01`, "50"], 1],
  ["one signature starting with 50 is not annex", [`50${"ab".repeat(63)}`], 0],
  ["script-path first argument 64 bytes", [signature, "51", controlBlock], UNSUPPORTED_INPUT_SIGHASH],
  ["script-path first argument 65 bytes", [`${signature}01`, "51", controlBlock], UNSUPPORTED_INPUT_SIGHASH],
  ["script-path plus annex", [signature, "51", controlBlock, "50abcd"], UNSUPPORTED_INPUT_SIGHASH],
  ["two non-annex elements are not key-path", [signature, "51"], UNSUPPORTED_INPUT_SIGHASH],
  ["empty stack", [], UNSUPPORTED_INPUT_SIGHASH],
  ["empty signature", [""], UNSUPPORTED_INPUT_SIGHASH],
  ["explicit DEFAULT is invalid", [`${signature}00`], UNSUPPORTED_INPUT_SIGHASH],
  ["unsupported key-path NONE remains its original flag", [`${signature}02`], 2],
] as const) {
  test(`BIP341 authorization interpretation: ${name}`, () => {
    assert.equal(deriveInputSighashType(witness, taproot), expected);
  });
}

test("P2WPKH preserves ALL, unsupported scripts remain unauthorized", () => {
  assert.equal(deriveInputSighashType([`${"30".repeat(40)}01`, `02${"33".repeat(32)}`], p2wpkh), 1);
  assert.equal(deriveInputSighashType([signature], `0020${"44".repeat(32)}`), UNSUPPORTED_INPUT_SIGHASH);
  assert.equal(deriveInputSighashType([], ""), UNSUPPORTED_INPUT_SIGHASH);
});

test("malformed witness context is a data failure, not unsupported authorization", () => {
  assert.throws(() => deriveInputSighashType(["zz"], taproot), /INVALID_INPUT_WITNESS_CONTEXT/);
  assert.throws(() => deriveInputSighashType(["a"], taproot), /INVALID_INPUT_WITNESS_CONTEXT/);
  assert.throws(() => deriveInputSighashType([signature], "zz"), /INVALID_INPUT_PREVOUT_CONTEXT/);
  assert.throws(() => deriveInputSighashType([signature], undefined as unknown as string), /INVALID_INPUT_PREVOUT_CONTEXT/);
});
