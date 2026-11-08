// Local-only walkthrough. Synthetic blocks and placeholder witnesses;
// no Bitcoin node, real signature, funds or broadcasting.
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openSession, openLocalQuery } from '../packages/indexer/dist/index.js';
import { chainFixture, serveFixture, aliceKey, bobKey, carolKey } from '../packages/indexer/test/fixtures.mjs';

const directory = mkdtempSync(join(tmpdir(), 'aibrc-indexer-demo-'));
const fixture = chainFixture();
const rpc = await serveFixture(fixture.original);
const config = join(directory, 'indexer.json');
writeFileSync(config, JSON.stringify({ network: 'regtest', databasePath: './demo.sqlite',
  rpc: { url: rpc.url }, testContext: { genesisHeight: 1, namePolicyVersion: 1 }, rollbackRetentionDepth: 6 }));
let session;
try {
  session = await openSession(config);
  const synced = await session.sync();
  console.log(JSON.stringify({ step: 'sync', ...synced }));
  session.close(); session = undefined;
  const local = await openLocalQuery(config);
  try {
    console.log(JSON.stringify({ step: 'read-after-restart', asset: local.query.getAssetByName('DEMO'),
      balances: { alice: local.query.listBalancesByAccount(aliceKey), bob: local.query.listBalancesByAccount(bobKey), carol: local.query.listBalancesByAccount(carolKey) } }));
  } finally { local.close(); }
  rpc.state.chain = fixture.alternative;
  session = await openSession(config);
  const changed = await session.sync();
  console.log(JSON.stringify({ step: 'two-block-reorg', ...changed,
    balances: { alice: session.query.listBalancesByAccount(aliceKey), bob: session.query.listBalancesByAccount(bobKey), carol: session.query.listBalancesByAccount(carolKey) },
    oldTransfer: session.query.getTransferByTxid(fixture.transferTxid) }));
} finally {
  session?.close(); await rpc.close(); rmSync(directory, { recursive: true, force: true });
}
