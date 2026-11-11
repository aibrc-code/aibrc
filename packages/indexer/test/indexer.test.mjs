import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, mkdirSync, copyFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { chainFixture, serveFixture, aliceKey, bobKey, carolKey } from './fixtures.mjs';
const { openSession, openLocalQuery, OfflineProtocolEngine, SqliteIndexerStorage, IndexerCore, MemoryRollbackJournal, FixtureBlockSource } = await import(process.env.INDEXER_TEST_MODULE ?? '../dist/index.js');
const sdkEntry = import.meta.resolve(process.env.INDEXER_TEST_SDK ?? '@aibrc/protocol');
const sdk = await import(sdkEntry);
const cli = process.env.INDEXER_TEST_CLI ?? fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const configName = 'indexer.json';
function spawnCli(configPath, command, args = [], entry = cli) {
  return spawn(process.execPath, [entry, command, '--config', configPath, ...args], { cwd: tmpdir(), stdio: ['ignore', 'pipe', 'pipe'] });
}
function run(configPath, command, ...args) {
  return readCliResult(spawnCli(configPath, command, args));
}
async function readCliResult(child) {
  let stdout = '', stderr = '';
  child.stdout.on('data', b => stdout += b); child.stderr.on('data', b => stderr += b);
  const timer = setTimeout(() => child.kill('SIGKILL'), 15_000);
  try {
    const code = await new Promise(resolve => child.on('close', resolve));
    const raw = code === 0 ? JSON.parse(stdout) : null;
    return { code, stdout, stderr, raw, json: raw && Object.hasOwn(raw, 'result') ? raw.result : raw };
  }
  finally { clearTimeout(timer); }
}

function cliWithReleaseFixture(directory, genesisHeight) {
  // Run the built or installed CLI bytes beside a fixture manifest. The
  // relative release lookup resolves inside this test's temporary directory.
  const fixture = join(directory, 'release-fixture');
  const dependencyScope = join(fixture, 'node_modules', '@aibrc');
  mkdirSync(dependencyScope, { recursive: true });
  const protocolPackage = fileURLToPath(new URL('../', sdkEntry));
  symlinkSync(protocolPackage, join(dependencyScope, 'protocol'), 'junction');
  const entry = join(fixture, 'cli.mjs');
  copyFileSync(cli, entry);
  const release = JSON.parse(readFileSync(join(dirname(cli), 'release.json'), 'utf8'));
  writeFileSync(join(fixture, 'release.json'), JSON.stringify({ ...release, genesisHeight }));
  return entry;
}
async function setup(t, overrides = {}, fixture = chainFixture()) {
  const directory = mkdtempSync(join(tmpdir(), 'aibrc-indexer-test-'));
  const rpc = await serveFixture(fixture.original);
  const config = { network: 'regtest', databasePath: './state.sqlite', rpc: { url: rpc.url, timeoutMs: 200 },
    pollIntervalMs: 100, rollbackRetentionDepth: 6, testContext: { genesisHeight: 1, namePolicyVersion: 1 }, ...overrides };
  const configPath = join(directory, configName), dbPath = join(directory, 'state.sqlite');
  const save = () => writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n'); save();
  t.after(async () => { await rpc.close(); rmSync(directory, { recursive: true, force: true }); });
  return { directory, fixture, rpc, config, configPath, dbPath, save };
}
function count(path, table) {
  const db = new DatabaseSync(path, { readOnly: true });
  try { return db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n; } finally { db.close(); }
}
async function waitForLine(child, matches = () => true) {
  let output = '';
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); child.stdout.off('data', onData); child.off('exit', onExit); };
    const onExit = code => { cleanup(); reject(new Error(`CHILD_EARLY_EXIT:${code}`)); };
    const onData = chunk => {
      output += chunk;
      const lines = output.split('\n');
      output = lines.pop();
      for (const line of lines) {
        const value = JSON.parse(line);
        if (matches(value)) { cleanup(); resolve(value); return; }
      }
    };
    const timer = setTimeout(() => { cleanup(); child.kill('SIGKILL'); reject(new Error('CHILD_OUTPUT_TIMEOUT')); }, 5000);
    child.stdout.on('data', onData);
    child.on('exit', onExit);
  });
}
async function terminate(child, signal) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const done = new Promise(resolve => child.once('exit', resolve)); child.kill(signal); await done;
}

test('compiled CLI syncs raw blocks, Deploy and a two-recipient Transfer into real SQLite', async t => {
  const s = await setup(t);
  const synced = await run(s.configPath, 'sync-once');
  assert.equal(synced.code, 0, synced.stderr); assert.equal(synced.json.status, 'READY');
  assert.deepEqual(synced.json.canonicalTip, { height: 3, hash: s.fixture.third.hash });
  assert.equal(synced.json.liveChainChecked, true);
  const assetResult = await run(s.configPath, 'get-name', 'DEMO');
  assert.equal(assetResult.raw.context.liveChainChecked, false);
  assert.equal(assetResult.raw.context.canonicalTip.hash, s.fixture.third.hash);
  const asset = assetResult.json;
  assert.equal(asset.totalSupply, '1000'); assert.deepEqual(asset.locator, { blockHeight: 1, txIndex: 1 });
  for (const [key, expected] of [[aliceKey, '700'], [bobKey, '100'], [carolKey, '200']]) {
    const result = await run(s.configPath, 'balances', key);
    assert.equal(result.code, 0, result.stderr); assert.equal(result.json[0].balance, expected);
  }
  assert.equal((await run(s.configPath, 'get-asset', asset.assetId)).json.name, 'DEMO');
  assert.equal((await run(s.configPath, 'get-transfer', s.fixture.transferTxid)).json.allocations.length, 2);
  assert.equal((await run(s.configPath, 'get-name', 'ABSENT')).json, null);
  assert.equal((await run(s.configPath, 'verify-state')).json.canonicalStateVerified, true);
  const before = createHash('sha256').update(readFileSync(s.dbPath)).digest('hex');
  const calls = s.rpc.calls.length;
  assert.equal((await run(s.configPath, 'status')).json.liveChainChecked, false);
  assert.equal((await run(s.configPath, 'get-tip')).json.hash, s.fixture.third.hash);
  assert.equal(createHash('sha256').update(readFileSync(s.dbPath)).digest('hex'), before);
  assert.equal(s.rpc.calls.length, calls, 'offline queries do not contact Bitcoin RPC');
  assert.ok(s.rpc.calls.every(c => ['getblockchaininfo', 'getbestblockhash', 'getblockhash', 'getblockheader', 'getblock'].includes(c.method)));
  assert.equal(count(s.dbPath, 'transfers'), 1);
});

test('restart and stable-tip sync neither duplicate transfers nor rewrite state', async t => {
  const s = await setup(t);
  const first = await run(s.configPath, 'sync-once'); assert.equal(first.code, 0, first.stderr);
  const before = readFileSync(s.dbPath), calls = s.rpc.calls.length;
  const second = await run(s.configPath, 'sync-once'); assert.equal(second.code, 0, second.stderr);
  assert.equal(first.json.stateHash, second.json.stateHash);
  assert.deepEqual(readFileSync(s.dbPath), before);
  assert.equal(s.rpc.calls.slice(calls).filter(c => c.method === 'getblock').length, 0);
  assert.equal(count(s.dbPath, 'transfers'), 1);
});

test('two-block reorg, shorter stable tip and replay remove old effects and restore new ones', async t => {
  const s = await setup(t);
  assert.equal((await run(s.configPath, 'sync-once')).code, 0);
  s.rpc.state.chain = s.fixture.alternative;
  const changed = await run(s.configPath, 'sync-once'); assert.equal(changed.code, 0, changed.stderr);
  assert.equal(changed.json.canonicalTip.hash, s.fixture.altThird.hash);
  assert.equal((await run(s.configPath, 'get-transfer', s.fixture.transferTxid)).json, null);
  assert.equal((await run(s.configPath, 'balances', bobKey)).json[0].balance, '250');
  assert.equal((await run(s.configPath, 'balances', carolKey)).json[0].balance, '50');
  s.rpc.state.chain = s.fixture.original.slice(0, 2);
  const shorter = await run(s.configPath, 'sync-once'); assert.equal(shorter.code, 0, shorter.stderr);
  assert.equal(shorter.json.canonicalTip.height, 1);
  assert.equal((await run(s.configPath, 'balances', aliceKey)).json[0].balance, '1000');
  assert.deepEqual((await run(s.configPath, 'balances', bobKey)).json, []);
  s.rpc.state.chain = s.fixture.original;
  const replay = await run(s.configPath, 'sync-once'); assert.equal(replay.code, 0, replay.stderr);
  assert.equal((await run(s.configPath, 'balances', bobKey)).json[0].balance, '100');
  assert.equal(count(s.dbPath, 'transfers'), 1);
});

test('wrong RPC network is refused before a local database is created', async t => {
  const s = await setup(t); s.rpc.state.network = 'signet';
  const result = await run(s.configPath, 'sync-once');
  assert.equal(result.code, 1); assert.match(result.stderr, /INDEXER_NETWORK_IDENTITY_MISMATCH/);
  assert.equal(existsSync(s.dbPath), false);
});

test('Mainnet rejects an unselected fixture before contacting RPC', async t => {
  const s = await setup(t, { network: 'mainnet', testContext: undefined });
  const entry = cliWithReleaseFixture(s.directory, null);
  const result = await readCliResult(spawnCli(s.configPath, 'sync-once', [], entry));
  assertQueryError(result, 'MAINNET_GENESIS_NOT_SELECTED');
  assert.equal(s.rpc.calls.length, 0);
  assert.equal(existsSync(s.dbPath), false);
});

test('Mainnet uses the selected fixture height and rejects a test-context override', async t => {
  const s = await setup(t, { network: 'mainnet' });
  s.rpc.state.network = 'main';
  const startHeight = 2;
  const entry = cliWithReleaseFixture(s.directory, startHeight);
  const sync = () => readCliResult(spawnCli(s.configPath, 'sync-once', [], entry));
  assertQueryError(await sync(), 'MAINNET_CONTEXT_OVERRIDE_REJECTED');
  assert.equal(s.rpc.calls.length, 0);
  assert.equal(existsSync(s.dbPath), false);

  delete s.config.testContext;
  s.save();
  const result = await sync();
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.json.status, 'READY');
  assert.equal(result.json.genesisHeight, startHeight);
  assert.equal(result.json.runtimeIdentity.namePolicyVersion, 2);
  assert.deepEqual(result.json.canonicalTip, { height: 3, hash: s.fixture.third.hash });
  const fetchedBlocks = s.rpc.calls.filter(call => call.method === 'getblock').map(call => call.params[0]);
  assert.deepEqual([...new Set(fetchedBlocks)], [s.fixture.second.hash, s.fixture.third.hash]);
});

test('a stored index cannot be reused with a different name-policy context', async t => {
  const s = await setup(t); assert.equal((await run(s.configPath, 'sync-once')).code, 0);
  s.config.testContext.namePolicyVersion = 2; s.save();
  const result = await run(s.configPath, 'status'); assert.equal(result.code, 1);
  assert.match(result.stderr, /SQLITE_RUNTIME_IDENTITY_MISMATCH/);
});

test('two writers are excluded, a pinned read remains coherent, and an OS-released lease survives a crash', async t => {
  const s = await setup(t);
  const session = await openSession(s.configPath);
  const head = await session.sync();
  await assert.rejects(openSession(s.configPath), /INDEXER_WRITER_ALREADY_RUNNING/);
  const reader = await openLocalQuery(s.configPath);
  try {
    const oldHash = reader.query.getStatus().stateHash;
    s.rpc.state.chain = s.fixture.alternative;
    await session.sync();
    assert.equal(reader.query.getStatus().stateHash, oldHash);
    assert.equal(reader.query.listBalancesByAccount(bobKey)[0].balance, '100');
    assert.notEqual(session.status().stateHash, oldHash);
  } finally { reader.close(); session.close(); }
  const child = spawnCli(s.configPath, 'follow');
  const firstLine = await waitForLine(child); assert.equal(firstLine.status, 'READY');
  await terminate(child, 'SIGKILL');
  const resumed = await run(s.configPath, 'sync-once'); assert.equal(resumed.code, 0, resumed.stderr);
  assert.notEqual(resumed.json.stateHash, head.stateHash);
  assert.equal(count(s.dbPath, 'transfers'), 1);
});

test('transient RPC loss persists non-ready status, then resumes without replaying the same payment', async t => {
  const s = await setup(t), session = await openSession(s.configPath);
  try {
    const first = await session.sync();
    s.rpc.state.failure = true;
    await assert.rejects(session.sync(), /INDEXER_RPC_ERROR:503/);
    const local = await openLocalQuery(s.configPath);
    try { assert.equal(local.status().status, 'SYNCING'); } finally { local.close(); }
    s.rpc.state.failure = null;
    const recovered = await session.sync(); assert.equal(recovered.status, 'READY'); assert.equal(recovered.stateHash, first.stateHash);
    assert.equal(count(s.dbPath, 'transfers'), 1);
  } finally { session.close(); }
});

test('raw/verbose mismatch stops before the affected block commits and survives restart as HALTED', async t => {
  const s = await setup(t); s.rpc.state.chain = s.fixture.original.slice(0, 2);
  assert.equal((await run(s.configPath, 'sync-once')).code, 0);
  s.rpc.state.chain = s.fixture.original;
  s.rpc.state.mutateVerbose = b => { if (b.height === 2) b.tx[1].txid = 'ff'.repeat(32); };
  const broken = await run(s.configPath, 'sync-once'); assert.equal(broken.code, 1);
  assert.match(broken.stderr, /RPC_TRANSACTION_ORDER_MISMATCH/);
  const local = await openLocalQuery(s.configPath);
  try { assert.equal(local.status().status, 'HALTED'); assert.equal(local.query.getStatus().canonicalTip.height, 1); assert.equal(local.query.listBalancesByAccount(aliceKey)[0].balance, '1000'); }
  finally { local.close(); }
  s.rpc.state.mutateVerbose = null;
  const restarted = await run(s.configPath, 'sync-once'); assert.equal(restarted.code, 1);
  assert.match(restarted.stderr, /INDEXER_HALTED/);
  assert.equal(count(s.dbPath, 'transfers'), 0);
});

test('changing config during a session requires restart before more block reads', async t => {
  const s = await setup(t), session = await openSession(s.configPath);
  try {
    await session.sync(); const calls = s.rpc.calls.length;
    s.config.pollIntervalMs = 200; s.save();
    await assert.rejects(session.sync(), /CONFIG_CHANGED_RESTART_REQUIRED/);
    assert.equal(s.rpc.calls.length, calls);
  } finally { session.close(); }
});

test('follow stops cleanly on SIGTERM and leaves a queryable committed checkpoint', async t => {
  const s = await setup(t), child = spawnCli(s.configPath, 'follow');
  assert.equal((await waitForLine(child)).status, 'READY');
  await terminate(child, 'SIGTERM');
  const status = await run(s.configPath, 'status'); assert.equal(status.code, 0, status.stderr);
  assert.equal(status.json.status, 'READY'); assert.equal(status.json.liveChainChecked, false);
});

test('reorg beyond retained undo fails closed rather than inventing an ancestor', async t => {
  const s = await setup(t, { rollbackRetentionDepth: 1 });
  const before = await run(s.configPath, 'sync-once'); assert.equal(before.code, 0, before.stderr);
  s.rpc.state.chain = s.fixture.alternative;
  const result = await run(s.configPath, 'sync-once'); assert.equal(result.code, 1);
  assert.match(result.stderr, /REORG_BEYOND_RETENTION/);
  const local = await run(s.configPath, 'status'); assert.equal(local.code, 0, local.stderr);
  assert.equal(local.json.status, 'HALTED'); assert.equal(local.json.stateHash, before.json.stateHash);
});

test('malformed CLI requests are rejected, with no file or RPC activity', async t => {
  const s = await setup(t);
  for (const [command, args, code] of [['broadcast', [], 'UNKNOWN_COMMAND'], ['balances', ['not-an-id'], 'INVALID_QUERY_ID'], ['status', ['--force'], 'INVALID_ARGUMENTS']]) {
    const result = await run(s.configPath, command, ...args); assert.equal(result.code, 1);
    assert.match(result.stderr, new RegExp(code));
  }
  assert.equal(existsSync(s.dbPath), false); assert.equal(s.rpc.calls.length, 0);
});

function positionOf(item) {
  return [item.blockHeight, item.blockHash, item.txIndex, item.allocationIndex].join(':');
}

function assertQueryError(output, code) {
  assert.equal(output.code, 1, output.stderr);
  assert.equal(output.stdout, '');
  assert.ok(output.stderr.split('\n').includes(JSON.stringify({ error: code })), output.stderr);
}

async function demoAssetId(configPath) {
  const asset = await run(configPath, 'get-name', 'DEMO');
  assert.equal(asset.code, 0, asset.stderr);
  return asset.json.assetId;
}

test('incoming keeps the recipient contract, exact allocations, page cap and UNKNOWN coverage', async t => {
  const s = await setup(t, {}, chainFixture(100));
  const synced = await run(s.configPath, 'sync-once');
  assert.equal(synced.code, 0, synced.stderr);
  const assetId = await demoAssetId(s.configPath);
  const scope = [assetId, bobKey, '0', '3'];
  const first = await run(s.configPath, 'incoming', ...scope, '--limit', '100');
  assert.equal(first.code, 0, first.stderr);
  assert.deepEqual(Object.keys(first.json), ['snapshot', 'scope', 'coverage', 'items', 'nextCursor']);
  assert.deepEqual(first.json.scope, { assetId, recipientAccount: bobKey, fromHeight: 0, toHeight: 3 });
  assert.deepEqual(first.json.snapshot.canonicalTip, first.raw.context.canonicalTip);
  assert.equal(first.json.snapshot.stateHash, first.raw.context.stateHash);
  assert.deepEqual(first.json.coverage[0], {
    blockHeight: 0, blockHash: null, coverage: 'UNKNOWN', transactionCount: null, markedTransactionCount: null,
  });
  assert.deepEqual(first.json.coverage.slice(1).map(row => row.coverage), ['COMPLETE', 'COMPLETE', 'COMPLETE']);
  assert.equal(first.json.items.length, 100);
  assert.deepEqual(first.json.items.map(row => row.txidDisplayBytes), [s.fixture.transferTxid, ...s.fixture.extraTransferTxids.slice(0, 99)]);
  assert.equal(first.json.items[0].amount, '100');
  assert.ok(first.json.items.every(row => row.recipientAccount === bobKey && row.identityEvidence === 'COMPLETE' && row.inputEvidence === 'COMPLETE'));
  assert.equal(typeof first.json.nextCursor, 'string');
  const second = await run(s.configPath, 'incoming', ...scope, '--cursor', first.json.nextCursor);
  assert.equal(second.code, 0, second.stderr);
  assert.deepEqual(second.json.items.map(row => row.txidDisplayBytes), [s.fixture.extraTransferTxids.at(-1)]);
  assert.equal(second.json.nextCursor, null);
  const after = await run(s.configPath, 'incoming', ...scope, '--after', positionOf(first.json.items.at(-1)));
  assert.equal(after.code, 0, after.stderr);
  assert.deepEqual(after.json.items, second.json.items);
  const carol = await run(s.configPath, 'incoming', assetId, carolKey, '2', '2');
  assert.equal(carol.code, 0, carol.stderr);
  assert.deepEqual(carol.json.items.map(row => [row.recipientAccount, row.amount, row.allocationIndex]), [[carolKey, '200', 1]]);
  const balance = await run(s.configPath, 'balance', assetId, bobKey);
  assert.equal(balance.code, 0, balance.stderr);
  assert.deepEqual(balance.json, { assetId, accountKey: bobKey, balance: '200' });
  for (const [args, code] of [
    [[...scope, '--limit', '101'], 'INVALID_QUERY_LIMIT'],
    [[...scope, '--limit', '0'], 'INVALID_QUERY_LIMIT'],
    [[assetId, bobKey, '3', '2'], 'INVALID_QUERY_RANGE'],
    [[assetId, bobKey, '1', '4'], 'INVALID_QUERY_RANGE'],
    [[assetId, bobKey, '0', '1000'], 'INVALID_QUERY_RANGE'],
    [[assetId, bobKey, '0.5', '3'], 'INVALID_QUERY_RANGE'],
    [[assetId, carolKey, '0', '3', '--cursor', first.json.nextCursor], 'INVALID_QUERY_CURSOR'],
    [[...scope, '--after', '2:bad'], 'INVALID_QUERY_POSITION'],
    [[...scope, '--limit', '2', '--limit', '3'], 'INVALID_ARGUMENTS'],
  ]) assertQueryError(await run(s.configPath, 'incoming', ...args), code);
});

test('incoming rejects replaced positions and state-at follows durable history through restart and reorg', async t => {
  const s = await setup(t, { rollbackRetentionDepth: 2 }, chainFixture(1));
  s.rpc.state.chain = s.fixture.original.slice(0, 2);
  const firstBlock = await run(s.configPath, 'sync-once');
  assert.equal(firstBlock.code, 0, firstBlock.stderr);
  s.rpc.state.chain = s.fixture.original;
  const original = await run(s.configPath, 'sync-once');
  assert.equal(original.code, 0, original.stderr);
  assert.equal(count(s.dbPath, 'canonical_blocks'), 2);
  assert.equal(count(s.dbPath, 'block_state_hashes'), 3);
  const assetId = await demoAssetId(s.configPath);
  const args = [assetId, bobKey, '1', '3'];
  const oldPage = await run(s.configPath, 'incoming', ...args, '--limit', '1');
  assert.equal(oldPage.code, 0, oldPage.stderr);
  assert.equal(oldPage.json.items[0].txidDisplayBytes, s.fixture.transferTxid);
  const oldHead = await run(s.configPath, 'state-at', '3');
  assert.deepEqual(oldHead.json, { height: 3, blockHash: s.fixture.third.hash, stateHash: original.json.stateHash });
  const heightOne = await run(s.configPath, 'state-at', '1');
  assert.deepEqual(heightOne.json, { height: 1, blockHash: s.fixture.first.hash, stateHash: firstBlock.json.stateHash });
  assert.equal((await run(s.configPath, 'state-at', '4')).json, null);
  assert.equal((await run(s.configPath, 'state-at', '0')).json, null);
  assertQueryError(await run(s.configPath, 'state-at', '-1'), 'INVALID_QUERY_HEIGHT');
  const pinned = await openLocalQuery(s.configPath);
  try {
    s.rpc.state.chain = s.fixture.alternative;
    const replaced = await run(s.configPath, 'sync-once');
    assert.equal(replaced.code, 0, replaced.stderr);
    assert.equal(pinned.stateAt(2).blockHash, s.fixture.second.hash);
    assert.deepEqual(JSON.parse(JSON.stringify(pinned.stateAt(3))), oldHead.json);
    const newHeightTwo = await run(s.configPath, 'state-at', '2');
    assert.equal(newHeightTwo.json.blockHash, s.fixture.altSecond.hash);
    const newHead = await run(s.configPath, 'state-at', '3');
    assert.deepEqual(newHead.json, { height: 3, blockHash: s.fixture.altThird.hash, stateHash: replaced.json.stateHash });
    assert.notEqual(newHead.json.stateHash, oldHead.json.stateHash);
    const newPage = await run(s.configPath, 'incoming', ...args);
    assert.equal(newPage.code, 0, newPage.stderr);
    assert.deepEqual(newPage.json.items.map(row => [row.txidDisplayBytes, row.amount]), [[s.fixture.replacementTxid, '250']]);
    assertQueryError(await run(s.configPath, 'incoming', ...args, '--after', positionOf(oldPage.json.items[0])), 'STALE_QUERY_POSITION');
    assertQueryError(await run(s.configPath, 'incoming', ...args, '--cursor', oldPage.json.nextCursor), 'INVALID_QUERY_CURSOR');
  } finally { pinned.close(); }
  const resumed = await run(s.configPath, 'sync-once');
  assert.equal(resumed.code, 0, resumed.stderr);
  assert.deepEqual((await run(s.configPath, 'state-at', '1')).json, heightOne.json);
  s.rpc.state.chain = s.fixture.original.slice(0, 2);
  const shortened = await run(s.configPath, 'sync-once');
  assert.equal(shortened.code, 0, shortened.stderr);
  assert.equal((await run(s.configPath, 'state-at', '2')).json, null);
  assert.equal((await run(s.configPath, 'state-at', '3')).json, null);
});

test('serve binds loopback, rejects invalid requests and returns byte-identical CLI results', async t => {
  const s = await setup(t, { http: { port: 0 } }, chainFixture(1));
  const synced = await run(s.configPath, 'sync-once');
  assert.equal(synced.code, 0, synced.stderr);
  const assetId = await demoAssetId(s.configPath);
  const scope = [assetId, bobKey, '1', '3'];
  const first = await run(s.configPath, 'incoming', ...scope, '--limit', '1');
  assert.equal(first.code, 0, first.stderr);
  const after = positionOf(first.json.items[0]);
  // Queries have a usable checkpoint even when the configured RPC cookie is absent.
  s.config.rpc.cookieFile = './missing-cookie';
  s.save();
  const calls = s.rpc.calls.length;
  const child = spawnCli(s.configPath, 'serve');
  try {
    const address = await waitForLine(child);
    assert.equal(address.address, '127.0.0.1');
    const url = `http://127.0.0.1:${address.port}`;
    for (const [command, args, suffix = ''] of [
      ['status', []], ['get-tip', []], ['get-name', ['DEMO']], ['get-asset', [assetId]],
      ['balances', [bobKey]], ['get-transfer', [s.fixture.transferTxid]], ['verify-state', []],
      ['balance', [assetId, bobKey]], ['state-at', ['3']], ['state-at', ['4']],
      ['incoming', [...scope, '--limit', '1'], '?limit=1'],
      ['incoming', [...scope, '--cursor', first.json.nextCursor], `?cursor=${first.json.nextCursor}`],
      ['incoming', [...scope, '--after', after], `?after=${encodeURIComponent(after)}`],
    ]) {
      const positional = suffix ? scope : args;
      const path = [command, ...positional.map(encodeURIComponent)].join('/');
      const cliResult = await run(s.configPath, command, ...args);
      assert.equal(cliResult.code, 0, cliResult.stderr);
      const response = await fetch(`${url}/${path}${suffix}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(cliResult.stdout));
    }
    for (const [path, method, status, code] of [
      ['/status', 'POST', 405, 'METHOD_NOT_ALLOWED'],
      ['/follow', 'GET', 404, 'UNKNOWN_QUERY_PATH'],
      ['/missing', 'GET', 404, 'UNKNOWN_QUERY_PATH'],
      ['/get-asset/bad', 'GET', 400, 'INVALID_QUERY_ID'],
      ['/get-name/%XX', 'GET', 400, 'INVALID_ARGUMENTS'],
      ['/state-at/9007199254740992', 'GET', 400, 'INVALID_QUERY_HEIGHT'],
      [`/incoming/${scope.join('/')}?limit=1&limit=2`, 'GET', 400, 'INVALID_ARGUMENTS'],
    ]) {
      const response = await fetch(url + path, { method });
      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), { error: code });
    }
    assert.equal(s.rpc.calls.length, calls);
  } finally { await terminate(child, 'SIGTERM'); }
});

test('concurrent HTTP reads retain one checkpoint while follow writes a replacement branch', async t => {
  const s = await setup(t, { http: { port: 0 } });
  s.config.rpc.timeoutMs = 5_000;
  s.save();
  const writer = spawnCli(s.configPath, 'follow');
  const reader = spawnCli(s.configPath, 'serve');
  const entered = Promise.withResolvers();
  const resume = Promise.withResolvers();
  try {
    const [head, address] = await Promise.all([waitForLine(writer), waitForLine(reader)]);
    assert.equal(head.status, 'READY');
    const url = `http://127.0.0.1:${address.port}/state-at/3`;
    const read = async () => {
      const response = await fetch(url);
      assert.equal(response.status, 200);
      const body = await response.json();
      if (body.context.canonicalTip.height < 3) assert.equal(body.result, null);
      else assert.deepEqual(body.result, { height: 3, blockHash: body.context.canonicalTip.hash, stateHash: body.context.stateHash });
      return body;
    };
    s.rpc.state.beforeResponse = async (method, params) => {
      if (method === 'getblock' && params[0] === s.fixture.altSecond.hash) {
        entered.resolve();
        await resume.promise;
      }
    };
    const committed = waitForLine(writer, value => value.status === 'READY' && value.canonicalTip.hash === s.fixture.altThird.hash);
    // Attach the failure handler immediately while waiting on the RPC barrier.
    void committed.catch(() => {});
    s.rpc.state.chain = s.fixture.alternative;
    await Promise.race([entered.promise, delay(4_000, undefined, { ref: false }).then(() => { throw new Error('REORG_FIXTURE_NOT_REACHED'); })]);
    await Promise.all(Array.from({ length: 8 }, read));
    const concurrent = Promise.all(Array.from({ length: 8 }, read));
    resume.resolve();
    await Promise.all([committed, concurrent]);
    assert.equal((await read()).result.blockHash, s.fixture.altThird.hash);
  } finally {
    resume.resolve();
    await terminate(reader, 'SIGTERM');
    await terminate(writer, 'SIGTERM');
  }
});

test('exported engine and SQLite replay all eight frozen chain vectors to their published hashes and states', async t => {
  const vectors = JSON.parse(readFileSync(new URL('../../../vectors/chain-vectors.json', import.meta.url))).vectors;
  const directory = mkdtempSync(join(tmpdir(), 'aibrc-indexer-vectors-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  // Abstract vectors use null for the first parent. Bitcoin's serialized
  // genesis header uses a zero hash; make that storage-only boundary explicit.
  const adapt = phase => phase.blocks.map(b => ({ height: b.height, hash: b.hash, previousHash: b.parentHash ?? '0'.repeat(64),
    transactions: b.transactions.map(tx => {
      const payload = Buffer.from(tx.rawProtocolPayloadHex, 'hex');
      const script = Buffer.concat([Buffer.from(payload.length <= 75 ? [0x6a, payload.length] : [0x6a, 0x4c, payload.length]), payload]).toString('hex');
      return { txid: tx.txid, metadata: { inputAuthorizationRuleId: sdk.INPUT_AUTHORIZATION_RULE_ID,
        txIndex: tx.txIndex, txidDisplayBytes: tx.txidDisplayBytes, payloadSource: { kind: 'CANONICAL_OUTPUT_EXTRACTION' },
        bitcoinTransactionContext: { inputs: tx.inputs, outputs: [...tx.outputs, { scriptPubKeyHex: script, valueSats: '0' }] } } };
    }) }));
  for (const vector of vectors) {
    assert.deepEqual(vector.initialState, { assets: [], names: [], locators: [], balances: [] });
    const storage = new SqliteIndexerStorage({ path: join(directory, vector.id + '.sqlite'), network: 'signet', activationHeight: 0, rollbackRetentionDepth: 6 });
    const engine = new OfflineProtocolEngine({ expectedNetwork: sdk.NetworkId.SIGNET, namePolicy: sdk.NAME_POLICY_V1_SCHEDULE });
    const source = new FixtureBlockSource(adapt(vector.phases[0]));
    const core = new IndexerCore({ startHeight: 0, anchorHash: '0'.repeat(64), protocolEngine: engine, blockSource: source,
      storage, rollbackJournal: new MemoryRollbackJournal(), rollbackRetentionDepth: 6 });
    try {
      for (const phase of vector.phases) { source.replaceAll(adapt(phase)); await core.syncToTip(); }
      assert.equal(core.status, 'READY', vector.id);
      assert.equal(engine.state.stateHash, vector.expected.stateHash, vector.id);
      assert.deepEqual(JSON.parse(sdk.serializeCanonicalState(engine.state.protocolState).toString('utf8')), vector.expected.canonicalFinalState, vector.id);
      assert.equal((await storage.loadSnapshot()).engineState.stateHash, vector.expected.stateHash, vector.id);
    } finally { storage.close(); }
  }
});

test('explicit Name Policy V2 test context is passed to the unchanged engine', async t => {
  const s = await setup(t, { testContext: { genesisHeight: 1, namePolicyVersion: 2 } });
  const result = await run(s.configPath, 'sync-once'); assert.equal(result.code, 0, result.stderr);
  assert.equal(result.json.runtimeIdentity.namePolicyVersion, 2);
  assert.equal((await run(s.configPath, 'get-name', 'DEMO')).json.totalSupply, '1000');
  assert.equal((await run(s.configPath, 'balances', bobKey)).json[0].balance, '100');
});

test('a test context beginning at Bitcoin height zero uses the serialized zero parent hash', async t => {
  const s = await setup(t, { testContext: { genesisHeight: 0, namePolicyVersion: 1 } });
  const result = await run(s.configPath, 'sync-once'); assert.equal(result.code, 0, result.stderr);
  assert.equal(result.json.genesisHeight, 0); assert.equal(result.json.canonicalTip.height, 3);
  assert.equal((await run(s.configPath, 'balances', bobKey)).json[0].balance, '100');
  assert.equal((await run(s.configPath, 'sync-once')).code, 0);
});
