import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  Buffer, NetworkId, NAME_POLICY_V1_SCHEDULE, namePolicyContextForBlock,
  decodeDeploy, decodeTransfer,
} from '../packages/protocol/dist/index.js';

function run(name, ...args) {
  return JSON.parse(execFileSync(process.execPath,
    [fileURLToPath(new URL(name, import.meta.url)), ...args], { encoding: 'utf8' }));
}
const namePolicy = namePolicyContextForBlock(NAME_POLICY_V1_SCHEDULE, 840000);

test('the deploy example emits a decodable fixed-supply Signet instruction', () => {
  const output = run('deploy.mjs');
  const decoded = decodeDeploy(Buffer.from(output.payloadHex, 'hex'), namePolicy);
  assert.equal(decoded.network, NetworkId.SIGNET);
  assert.equal(decoded.name, 'DEMO');
  assert.equal(decoded.totalSupply, 100_000_000_000_000n);
  assert.equal(decoded.deployAuthInputIndex, 0);
  assert.equal(decoded.ownerOutputIndex, 1);
});

test('the single-transfer example binds output 1 to exactly 10 tokens', () => {
  const output = run('transfer-single.mjs');
  const decoded = decodeTransfer(Buffer.from(output.payloadHex, 'hex'));
  assert.equal(decoded.network, NetworkId.SIGNET);
  assert.deepEqual(decoded.assetLocator, { blockHeight: 840000, txIndex: 7 });
  assert.deepEqual(decoded.allocations, [{ receiverOutputIndex: 1, amount: 1_000_000_000n }]);
});

// Exhaust the entire recipient-count domain; no random generator or new dependency.
for (let count = 1; count <= 25; count++) {
  test(`the actual batch script round-trips ${count} receiver allocations`, () => {
    const output = run('transfer-batch.mjs', String(count));
    const decoded = decodeTransfer(Buffer.from(output.payloadHex, 'hex'));
    assert.equal(output.recipients, count);
    assert.equal(decoded.allocations.length, count);
    assert.equal(decoded.authInputIndex, 0);
    for (const [i, entry] of decoded.allocations.entries()) {
      assert.equal(entry.receiverOutputIndex, i + 1);
      assert.equal(entry.amount, 1_000_000_000n);
    }
    assert.equal(output.totalBaseUnits, (BigInt(count) * 1_000_000_000n).toString());
  });
}

test('the batch default is 25 and invalid counts emit no payload', () => {
  assert.equal(run('transfer-batch.mjs').recipients, 25);
  for (const count of ['0', '26', '1.5', 'NaN']) {
    const result = spawnSync(process.execPath,
      [fileURLToPath(new URL('transfer-batch.mjs', import.meta.url)), count], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Choose a recipient count from 1 to 25/);
  }
});

test('decode reads the published six-recipient bytes, not another generated fixture', () => {
  const decoded = run('decode.mjs');
  assert.equal(decoded.kind, 'TRANSFER');
  assert.deepEqual(decoded.allocations, [10, 20, 30, 40, 50, 60].map((amount, i) => ({
    receiverOutputIndex: i + 1, amount: String(amount),
  })));
});

test('decode also accepts the actual deploy script output', () => {
  const decoded = run('decode.mjs', run('deploy.mjs').payloadHex);
  assert.equal(decoded.kind, 'DEPLOY');
  assert.equal(decoded.name, 'DEMO');
  assert.equal(decoded.totalSupply, '100000000000000');
});

test('decode rejects malformed hex and a payload from the wrong network', () => {
  const mainnet = run('transfer-single.mjs').payloadHex.replace(/^414942520102/, '414942520100');
  for (const hex of ['not-hex', 'abc', mainnet]) {
    const result = spawnSync(process.execPath,
      [fileURLToPath(new URL('decode.mjs', import.meta.url)), hex], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /complete hexadecimal|UNKNOWN_NETWORK/);
  }
});

test('state hashing uses a non-empty published state and matches independent SHA-256', () => {
  const output = run('state-hash.mjs');
  const { vectors } = JSON.parse(readFileSync(new URL('../vectors/chain-vectors.json', import.meta.url), 'utf8'));
  const vector = vectors.find(item => item.id === output.vector);
  assert.equal(output.assets, 2);
  assert.equal(output.balanceEntries, 2);
  assert.equal(output.stateHash, vector.expected.stateHash);
  assert.equal(output.stateHash, createHash('sha256')
    .update(JSON.stringify(vector.expected.canonicalFinalState)).digest('hex'));
  assert.equal(output.matchesPublishedVector, true);
});

test('short documentation excerpts execute with the declared shared setup and inputs', () => {
  const quickstart = readFileSync(new URL('../docs/quickstart.md', import.meta.url), 'utf8');
  const excerpt = (text, name) => {
    const match = new RegExp('<!-- snippet: ' + name + ' -->\\n```js\\n([\\s\\S]*?)\\n```').exec(text);
    assert(match, 'Missing excerpt ' + name);
    return match[1];
  };
  const setup = excerpt(quickstart, 'shared-setup');
  const execute = (code, expression, prefix = '') => JSON.parse(execFileSync(process.execPath,
    ['--input-type=module', '-e', setup + '\n' + prefix + '\n' + code +
      '\nconsole.log(JSON.stringify(' + expression +
      ", (_, value) => typeof value === 'bigint' ? value.toString() : value));"],
    { encoding: 'utf8', cwd: fileURLToPath(new URL('../', import.meta.url)) }));

  const pages = [quickstart,
    readFileSync(new URL('../README.md', import.meta.url), 'utf8'),
    readFileSync(new URL('../packages/protocol/README.md', import.meta.url), 'utf8'),
    readFileSync(new URL('../docs/03-instructions.md', import.meta.url), 'utf8')];
  const required = [
    ['deploy', 'transfer-single', 'transfer-batch'],
    ['deploy', 'transfer-single'],
    ['deploy', 'transfer-single'],
    ['deploy', 'transfer-batch'],
  ];
  for (const [pageIndex, page] of pages.entries()) {
    for (const name of required[pageIndex]) {
      const output = execute(excerpt(page, name), "{hex: payload.toString('hex')}");
      if (name === 'deploy') {
        const decoded = decodeDeploy(Buffer.from(output.hex, 'hex'), namePolicy);
        assert.equal(decoded.name, 'DEMO');
        assert.equal(decoded.network, NetworkId.SIGNET);
        assert.equal(decoded.totalSupply, 100_000_000_000_000n);
        assert.equal(decoded.deployAuthInputIndex, 0);
        assert.equal(decoded.ownerOutputIndex, 1);
      } else {
        const decoded = decodeTransfer(Buffer.from(output.hex, 'hex'));
        const amounts = name === 'transfer-single' ? [1_000_000_000n] : [1_000_000_000n, 2_000_000_000n, 3_000_000_000n];
        assert.equal(decoded.network, NetworkId.SIGNET);
        assert.equal(decoded.authInputIndex, 0);
        assert.deepEqual(decoded.assetLocator, { blockHeight: 840000, txIndex: 7 });
        assert.deepEqual(decoded.allocations, amounts.map((amount, i) => ({ receiverOutputIndex: i + 1, amount })));
      }
    }
  }
  for (const name of ['deploy', 'transfer-batch']) {
    const result = execute(excerpt(quickstart, name) + '\n' + excerpt(quickstart, 'decode'), 'result');
    assert.equal(result.status, 'VALID');
    assert.equal(result.instruction.kind, name === 'deploy' ? 'DEPLOY' : 'TRANSFER');
  }
  const { vectors } = JSON.parse(readFileSync(new URL('../vectors/chain-vectors.json', import.meta.url), 'utf8'));
  const vector = vectors.find(item => item.id === 'chain-shallow-reorg');
  const prefix = `import { createProtocolState } from '@aibrc/protocol';
    const snapshot = ${JSON.stringify(vector.expected.canonicalFinalState)};
    const state = createProtocolState();
    for (const asset of snapshot.assets) state.assetsById.set(asset.assetId, {
      ...asset, totalSupply: BigInt(asset.totalSupply),
      locator: { blockHeight: asset.locator[0], txIndex: asset.locator[1] },
    });
    state.assetIdByName = new Map(snapshot.names);
    state.assetIdByLocator = new Map(snapshot.locators);
    state.balances = new Map(snapshot.balances.map(([key, value]) => [key, BigInt(value)]));`;
  assert.equal(execute(excerpt(quickstart, 'state-hash'), 'stateHash', prefix), vector.expected.stateHash);
  const indexer = readFileSync(new URL('../docs/06-indexer-guide.md', import.meta.url), 'utf8');
  assert.equal(execute(excerpt(indexer, 'state-hash'), 'stateHash', prefix), vector.expected.stateHash);
});
