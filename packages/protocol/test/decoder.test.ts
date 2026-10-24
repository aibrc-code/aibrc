import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { NAME_POLICY_V1_SCHEDULE, NetworkId, namePolicyContextForBlock } from '../src/index.js';
import { addWitnessToUnsignedTransaction, comparePreAndPostSign, decodeBitcoinTransaction } from '../src/decoder.js';
const context = { expectedNetwork: NetworkId.SIGNET, namePolicy: namePolicyContextForBlock(NAME_POLICY_V1_SCHEDULE, 0) };
const fixtures = JSON.parse(readFileSync(new URL('../../../vectors/bitcoin-transaction-fixtures.json', import.meta.url), 'utf8')).fixtures;
const operations = JSON.parse(readFileSync(new URL('../../../vectors/operation-vectors.json', import.meta.url), 'utf8')).vectors;
test('raw transaction decoder matches all six upstream Bitcoin byte/weight fixtures', () => {
  assert.equal(fixtures.length, 6);
  for (const fixture of fixtures) {
    const tx = decodeBitcoinTransaction(fixture.rawTransactionHex, context);
    for (const key of ['strippedBytes', 'witnessBytes', 'weight', 'vsize']) assert.equal(tx[key as keyof typeof tx], fixture[key], `${fixture.id}: ${key}`);
    assert.equal(tx.inputs.length, fixture.inputs.length, fixture.id);
    assert.equal(tx.outputs.length, fixture.outputs.length, fixture.id);
    assert.equal(tx.protocol.status, 'VALID', fixture.id);
    const unsigned = tx.strippedTransactionHex;
    const restored = addWitnessToUnsignedTransaction(unsigned, tx.inputs.map((input) => input.witnessHex));
    assert.equal(restored, fixture.rawTransactionHex, fixture.id);
    assert.equal(comparePreAndPostSign(unsigned, restored, context).reason, 'MATCH');
  }
});
test('raw decoder matches all fourteen upstream marker/network hardening classifications', () => {
  const hardening = operations.filter((v: any) => v.category.startsWith('protocol-hardening-'));
  assert.equal(hardening.length, 14);
  for (const vector of hardening) {
    const decoded = decodeBitcoinTransaction(vector.rawTransactionHex, { expectedNetwork: vector.expectedNetwork, activatedVersions: new Set(vector.execution.activatedVersions), namePolicy: vector.execution.namePolicy });
    assert.deepEqual({ status: decoded.protocol.status, reason: decoded.protocol.reason }, vector.expectedClassification, vector.id);
    assert.deepEqual({ valid: decoded.protocol.validMarkerCount, malformed: decoded.protocol.malformedMarkerCount, recognized: decoded.protocol.recognizedMarkerCount }, vector.markerCounts, vector.id);
  }
});
test('decoder requires explicit network/name-policy context and rejects malformed transaction boundaries', () => {
  const raw = fixtures[0].rawTransactionHex;
  assert.equal(decodeBitcoinTransaction(raw).protocol.reason, 'EXPECTED_NETWORK_REQUIRED');
  assert.equal(decodeBitcoinTransaction(raw, { expectedNetwork: NetworkId.SIGNET }).protocol.reason, 'NAME_POLICY_CONTEXT_REQUIRED');
  assert.throws(() => decodeBitcoinTransaction(raw + '00', context), /TRAILING_TRANSACTION_BYTES/);
  assert.throws(() => decodeBitcoinTransaction('gg', context), /INVALID_TRANSACTION_HEX/);
  const bytes = Buffer.from(raw, 'hex');
  assert.throws(() => decodeBitcoinTransaction(bytes.subarray(0, -1).toString('hex'), context), /TRUNCATED_TRANSACTION/);
});
