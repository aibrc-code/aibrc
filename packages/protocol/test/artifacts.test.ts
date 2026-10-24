import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, SourceTextModule } from 'node:vm';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../../../vectors/${name}`, import.meta.url), 'utf8'));
const operations = read('operation-vectors.json').vectors;
const chains = read('chain-vectors.json').vectors;
const auth = read('authorization-vectors.json').vectors;
const opReturns = read('op-return-vectors.json').vectors;
const fixtures = read('bitcoin-transaction-fixtures.json').fixtures;

function fromState(api: any, serialized: any) {
  const state = api.createProtocolState();
  state.assetsById = new Map(serialized.assetsById.map(([key, asset]: any) => [key, { ...asset, totalSupply: BigInt(asset.totalSupply) }]));
  state.assetIdByName = new Map(serialized.assetIdByName);
  state.assetIdByLocator = new Map(serialized.assetIdByLocator);
  state.balances = new Map(serialized.balances.map(([key, amount]: any) => [key, BigInt(amount)]));
  return state;
}
function stateObject(state: any) {
  const cmp = ([a]: any, [b]: any) => a < b ? -1 : a > b ? 1 : 0;
  return {
    assetsById: [...state.assetsById].sort(cmp).map(([key, asset]) => [key, { ...asset, totalSupply: asset.totalSupply.toString() }]),
    assetIdByName: [...state.assetIdByName].sort(cmp),
    assetIdByLocator: [...state.assetIdByLocator].sort(cmp),
    balances: [...state.balances].sort(cmp).map(([key, amount]) => [key, amount.toString()]),
  };
}
function script(api: any, hex: string) {
  const payload = api.Buffer.from(hex, 'hex');
  if (payload.length <= 75) return api.Buffer.concat([api.Buffer.from([0x6a, payload.length]), payload]).toString('hex');
  if (payload.length <= 255) return api.Buffer.concat([api.Buffer.from([0x6a, 0x4c, payload.length]), payload]).toString('hex');
  const length = api.Buffer.alloc(2); length.writeUInt16LE(payload.length);
  return api.Buffer.concat([api.Buffer.from([0x6a, 0x4d]), length, payload]).toString('hex');
}
function verifyArtifacts(api: any, decoder: any) {
  const normalize = (value: any) => JSON.parse(JSON.stringify(value));
  for (const vector of operations) {
    const e = vector.execution;
    const state = fromState(api, e.initialState);
    const context = { expectedNetwork: e.expectedNetwork, activatedVersions: new Set(e.activatedVersions), namePolicy: e.namePolicy };
    const tx = e.transactionContext ? { ...e.transactionContext, outputs: e.transactionContext.outputs.map((o: any) => ({ ...o, valueSats: BigInt(o.valueSats) })) } : null;
    let result;
    if (e.mode === 'CLASSIFY' || e.mode === 'CLASSIFY_TRANSACTION') {
      const c = e.mode === 'CLASSIFY' ? api.classifyProtocolPayload(api.Buffer.from(e.payloadsHex[0], 'hex'), context)
        : api.classifyExtractedAibrcTransaction(api.extractAibrcPayloadsFromOutputs(e.payloadsHex.map((hex: string) => ({ scriptPubKeyHex: script(api, hex) }))), context);
      result = { status: c.status, reason: c.reason };
    } else if (e.mode === 'CLASSIFY_OUTPUTS') {
      const c = api.classifyExtractedAibrcTransaction(api.extractAibrcPayloadsFromOutputs(tx.outputs), context);
      assert.deepEqual(normalize({ status: c.status, reason: c.reason }), e.expectedClassification, vector.id);
      result = c.status === 'VALID' && c.instruction?.kind === 'DEPLOY' ? api.applyDeploy(c.instruction, tx, state, e.namePolicy) : { status: c.status, reason: c.reason };
    } else result = e.mode === 'APPLY_DEPLOY' ? api.applyDeploy(api.decodeDeploy(api.Buffer.from(vector.rawPayloadHex, 'hex'), e.namePolicy), tx, state, e.namePolicy)
      : api.applyTransfer(api.decodeTransfer(api.Buffer.from(vector.rawPayloadHex, 'hex')), tx, state);
    assert.deepEqual(normalize(result), e.expectedResult, vector.id);
    assert.deepEqual(normalize(stateObject(state)), e.expectedState, vector.id);
    const bytes = api.serializeCanonicalState(state);
    assert.equal(api.deriveStateHash(state), createHash('sha256').update(bytes).digest('hex'), vector.id);
  }
  for (const vector of auth) {
    const run = () => api.deriveInputSighashType(vector.witnessHex, vector.prevoutScriptPubKeyHex);
    if (vector.expectedError) assert.throws(run, (e: any) => e.message === vector.expectedError, vector.id);
    else assert.equal(run(), vector.expectedSighashType, vector.id);
  }
  for (const vector of opReturns) {
    const result = api.extractAibrcPayloadFromScript(vector.scriptPubKeyHex);
    assert.equal(result.status, vector.expectedStatus, vector.id);
    assert.equal(result.status === 'MALFORMED_AIBRC_MARKER' ? result.reason : null, vector.expectedReason, vector.id);
    assert.equal(result.status === 'VALID_AIBRC_PAYLOAD' ? result.payload.toString('hex') : null, vector.payloadHex, vector.id);
  }
  for (const vector of chains) {
    const c = vector.expected.canonicalFinalState;
    const state = fromState(api, { assetsById: c.assets.map((asset: any) => [asset.assetId, { ...asset, locator: { blockHeight: asset.locator[0], txIndex: asset.locator[1] } }]), assetIdByName: c.names, assetIdByLocator: c.locators, balances: c.balances });
    assert.equal(api.deriveStateHash(state), vector.expected.stateHash, vector.id);
  }
  for (const fixture of fixtures) {
    const tx = decoder.decodeBitcoinTransaction(fixture.rawTransactionHex, { expectedNetwork: api.NetworkId.SIGNET, namePolicy: api.namePolicyContextForBlock(api.NAME_POLICY_V1_SCHEDULE, 0) });
    assert.equal(tx.totalBytes, fixture.strippedBytes + fixture.witnessBytes, fixture.id);
    assert.equal(tx.vsize, fixture.vsize, fixture.id);
    assert.equal(tx.protocol.status, 'VALID', fixture.id);
  }
}
test('built Node package executes complete public vector bodies and independent SHA-256 checks', async () => {
  const api = await import('../dist/index.js');
  const decoder = await import('../dist/decoder.js');
  verifyArtifacts(api, decoder);
});
test('built standalone browser ESM executes vectors without Node globals or imports', async () => {
  const context = createContext({ TextEncoder, TextDecoder });
  assert.equal('Buffer' in context, false);
  assert.equal('process' in context, false);
  assert.equal('require' in context, false);
  async function load(path: string) {
    const module = new SourceTextModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { context });
    await module.link(() => { throw new Error('BROWSER_ARTIFACT_MUST_NOT_IMPORT_NODE_OR_EXTERNAL_MODULES'); });
    await module.evaluate();
    return module.namespace;
  }
  verifyArtifacts(await load('../dist/browser.js'), await load('../dist/decoder.browser.js'));
});
