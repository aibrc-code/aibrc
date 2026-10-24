import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { deriveStateHash } from "../src/index.js";
import {
  PureChainReplayHarness,
  executeChainVector,
  type ChainReplayResult,
  type ChainVectorDefinition,
} from "./chain-harness.js";

interface StoredChainVector extends ChainVectorDefinition {
  expected: ChainReplayResult;
}

const document = JSON.parse(readFileSync(new URL("../../../vectors/chain-vectors.json", import.meta.url), "utf8")) as {
  count: number;
  harness: string;
  vectors: StoredChainVector[];
};

test("all eight chain vectors contain concrete canonical blocks and transactions", () => {
  assert.equal(document.count, 8);
  assert.equal(document.vectors.length, 8);
  assert.equal(new Set(document.vectors.map((vector) => vector.id)).size, 8);
  assert.match(document.harness, /in-memory canonical fixture replay/);
  for (const vector of document.vectors) {
    assert.ok(vector.phases.length >= 1, `${vector.id}: phases`);
    assert.ok(vector.initialState, `${vector.id}: initial state`);
    assert.match(vector.expected.stateHash, /^[0-9a-f]{64}$/);
    for (const phase of vector.phases) {
      phase.blocks.forEach((block, index) => {
        assert.equal(block.height, index, `${vector.id}/${phase.label}: height`);
        assert.match(block.hash, /^[0-9a-f]{64}$/, `${vector.id}/${phase.label}: block hash`);
        assert.equal(block.parentHash, index === 0 ? null : phase.blocks[index - 1]!.hash);
        const indexes = block.transactions.map((transaction) => transaction.txIndex);
        assert.deepEqual(indexes, [...indexes].sort((left, right) => left - right));
        for (const transaction of block.transactions) {
          assert.match(transaction.txid, /^[0-9a-f]{64}$/);
          assert.equal(transaction.txidDisplayBytes, transaction.txid);
          assert.match(transaction.rawProtocolPayloadHex, /^[0-9a-f]+$/);
          assert.ok(transaction.inputs.length >= 1);
          assert.ok(transaction.outputs.length >= 1);
          assert.deepEqual(transaction.bitcoinTransactionContext, {
            inputs: transaction.inputs,
            outputs: transaction.outputs,
          });
        }
      });
    }
  }
});

test("all eight chain vectors replay to their complete expected canonical state", async () => {
  for (const vector of document.vectors) {
    assert.deepEqual(await executeChainVector(vector), vector.expected, vector.id);
  }
});

test("repeated chain-vector replay is deterministic", async () => {
  for (const vector of document.vectors) {
    const first = await executeChainVector(vector);
    const second = await executeChainVector(vector);
    assert.equal(first.stateHash, second.stateHash, vector.id);
    assert.equal(JSON.stringify(first), JSON.stringify(second), vector.id);
  }
});

test("snapshot restore then continuation produces the same final state hash", async () => {
  const vector = document.vectors.find((item) => item.id === "chain-rollback-then-replay")!;
  const firstHarness = new PureChainReplayHarness();
  await firstHarness.replay([vector.phases[0]!]);
  const snapshot = firstHarness.captureSnapshot();

  const restoredHarness = new PureChainReplayHarness();
  restoredHarness.restoreSnapshot(snapshot);
  const restoredState = await restoredHarness.replay([vector.phases[1]!]);
  const direct = await executeChainVector(vector);
  const restoredHash = deriveStateHash(restoredState);
  assert.equal(restoredHash, direct.stateHash);
  assert.deepEqual(restoredHarness.canonicalTip, direct.canonicalTip);
});

test("rollback-then-replay equals direct replay of the replacement chain", async () => {
  const rollback = document.vectors.find((vector) => vector.id === "chain-rollback-then-replay")!;
  const direct = document.vectors.find((vector) => vector.id === "chain-direct-replay-replacement")!;
  const rollbackResult = await executeChainVector(rollback);
  const directResult = await executeChainVector(direct);
  assert.equal(rollbackResult.stateHash, directResult.stateHash);
  assert.deepEqual(rollbackResult.canonicalFinalState, directResult.canonicalFinalState);
  assert.deepEqual(rollbackResult.balances, directResult.balances);
});

test("replacement and invalidation scenarios expose the expected winner and locator outcomes", () => {
  const sameBlock = document.vectors.find((vector) => vector.id === "chain-same-block-duplicate-name-race")!;
  assert.equal(sameBlock.expected.nameWinners.PANDA?.deployTxid, sameBlock.phases[0]!.blocks[0]!.transactions[0]!.txid);
  assert.deepEqual(sameBlock.expected.locatorValidity.map((value) => value.valid), [true, false]);

  const replaced = document.vectors.find((vector) => vector.id === "chain-deploy-winner-replaced")!;
  assert.equal(replaced.expected.nameWinners.WINNER?.deployTxid, replaced.phases[1]!.blocks[0]!.transactions[0]!.txid);

  const invalidated = document.vectors.find((vector) => vector.id === "chain-locator-invalidated")!;
  assert.equal(invalidated.expected.nameWinners.LOC, null);
  assert.deepEqual(invalidated.expected.locatorValidity.map((value) => value.valid), [false]);
});
