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

test('the website quick-start code blocks are the actual runnable source files', () => {
  const markdown = readFileSync(new URL('../docs/quickstart.md', import.meta.url), 'utf8');
  const blocks = [...markdown.matchAll(/<!-- example: (\S+) -->\n```js\n([\s\S]*?)\n```/g)];
  assert.deepEqual(blocks.map(block => block[1]), [
    'deploy.mjs', 'transfer-single.mjs', 'transfer-batch.mjs', 'decode.mjs', 'state-hash.mjs',
  ]);
  for (const [, name, code] of blocks) {
    assert.equal(code, readFileSync(new URL(name, import.meta.url), 'utf8').trimEnd(), name);
  }
});
