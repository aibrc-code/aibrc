// Browser contract tests: injected mock providers only. NO real wallet/signature/broadcast.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { Psbt, Transaction, address as bitcoinAddress } from 'bitcoinjs-lib';

const root = dirname(fileURLToPath(import.meta.url));
const evidence = process.env.BATCH_BROWSER_EVIDENCE_DIR;
const siteRoot = resolve(process.env.BATCH_SITE_DIR ?? new URL('../../site-build/', import.meta.url).pathname);
const headers = await readFile(resolve(siteRoot, '_headers'), 'utf8');
const csp = headers.split('\n').find(line => line.trimStart().startsWith('Content-Security-Policy:'))?.trim().slice('Content-Security-Policy:'.length).trim();
assert(csp?.includes("script-src 'self'"), 'Build the documentation site before running the integration browser suite.');
const sender = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const senderScript = '0014751e76e8199196d454941c45d1b3a323f1433bd6';
const publicKey = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const parentId = 'ab'.repeat(32), deployId = 'cd'.repeat(32), blockHash = 'ef'.repeat(32);
const recipients = Array.from({ length: 30 }, (_, i) => bitcoinAddress.toBech32(Buffer.alloc(20, i + 1), 0, 'bc'));
const rows = recipients.map(a => `${a} 1`).join('\n');
const signed = new Map();
function mockFinalized(hex) {
  const p = Psbt.fromHex(hex);
  // Structurally DER-encoded dummy witness; intentionally NOT a valid signature.
  const sig = Buffer.from('30440220' + '11'.repeat(32) + '0220' + '22'.repeat(32) + '01', 'hex');
  const key = Buffer.from(publicKey, 'hex');
  const witness = Buffer.concat([Buffer.from([2, sig.length]), sig, Buffer.from([key.length]), key]);
  p.data.inputs.forEach((input, i) => { if (!input.finalScriptWitness) p.updateInput(i, { finalScriptWitness: witness }); });
  const tx = p.extractTransaction(true), txid = tx.getId();
  const receipt = { txid, version: tx.version, locktime: tx.locktime, status: { confirmed: false },
    vin: tx.ins.map(input => ({ txid: Buffer.from(input.hash).reverse().toString('hex'), vout: input.index,
      sequence: input.sequence, prevout: { scriptpubkey: senderScript, value: 1000000 } })),
    vout: tx.outs.map(o => ({ scriptpubkey: Buffer.from(o.script).toString('hex'), value: Number(o.value) })) };
  signed.set(txid, receipt); return { hex: p.toHex(), txid };
}
const server = createServer(async (request, response) => {
  try {
    const requested = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const name = requested.endsWith('/') ? requested.slice(1) + 'index.html' : requested.slice(1);
    if (!name || name.includes('..') || name.includes('\\')) throw new Error('invalid path');
    const content = await readFile(resolve(siteRoot, name));
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' })[extname(name)] ?? 'application/octet-stream');
    if (requested.startsWith('/sign/')) response.setHeader('Content-Security-Policy', csp);
    response.end(content);
  } catch { response.statusCode = 404; response.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });

async function fixture({ wallet = 'unisat', fallback = false, failPush = 0, tamper = false, missingSafe = false, network = 'livenet', unknownRead = false, accountChangeOnSign = false, accountChangeOnPush = false, lateReview = false, wrongTxid = false, fundingConfirmed = true, pushRaw = false, mobile = false } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.exposeBinding('mockFinalize', (_, hexes) => hexes.map(mockFinalized).map(v => v.hex));
  await page.exposeBinding('mockPush', (_, hex) => mockFinalized(hex).txid);
  await page.exposeBinding('mockRawPush', (_, hex) => Transaction.fromHex(hex).getId());
  await page.exposeBinding('mockMemo', (_, to, sats, options) => {
    const txid = '98'.repeat(32), payload = options.memo;
    signed.set(txid, { txid, vin: [{ prevout: { scriptpubkey: senderScript } }], vout: [
      { scriptpubkey: Buffer.from(bitcoinAddress.toOutputScript(to)).toString('hex'), value: sats },
      { scriptpubkey: '6a' + (payload.length / 2).toString(16).padStart(2, '0') + payload, value: 0 },
      { scriptpubkey: senderScript, value: 10000 }] });
    return txid;
  });
  await context.route('https://mempool.space/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    let value;
    if (pathname === '/api/v1/fees/recommended') value = { halfHourFee: 2 };
    else if (pathname === '/api/block-height/961555') value = blockHash;
    else if (pathname === `/api/block/${blockHash}/txid/3`) value = deployId;
    else if (pathname === `/api/tx/${parentId}`) value = { txid: parentId, status: { confirmed: fundingConfirmed }, vout: [{ scriptpubkey: senderScript, value: 1000000 }] };
    else if (pathname === '/api/blocks/tip/height') value = '961560';
    else if (pathname.startsWith('/api/tx/')) {
      if (unknownRead) { await route.fulfill({ status: 503, body: 'mock read unavailable' }); return; }
      value = signed.get(pathname.split('/').pop());
    }
    if (value === undefined) throw new Error(`Unexpected mock endpoint ${pathname}`);
    await route.fulfill({ status: 200, contentType: typeof value === 'string' ? 'text/plain' : 'application/json', body: typeof value === 'string' ? value : JSON.stringify(value) });
  });
  await context.route('**/*', async route => {
    if (route.request().url().startsWith(url)) return route.continue();
    if (route.request().url().startsWith('https://mempool.space/')) return route.fallback();
    return route.abort();
  });
  await page.addInitScript(({ sender, senderScript, publicKey, parentId, fallback, failPush, tamper, missingSafe, network, accountChangeOnSign, accountChangeOnPush, pushRaw, lateReview, wrongTxid }) => {
    window.mockCalls = { signs: [], pushes: [], utxos: 0, memo: [] };
    const listeners = {};
    const provider = { requestAccounts: async () => [sender], getAccounts: async () => [sender], connect: async () => ({ address: sender, publicKey }),
      getNetwork: async () => network, getPublicKey: async () => publicKey,
      getBitcoinUtxos: async () => { window.mockCalls.utxos++; if (lateReview) await new Promise(resolve => { window.releaseBatchUtxos = resolve; }); return [{ txid: parentId, vout: 0, satoshis: 1000000, scriptPk: senderScript, inscriptions: [], atomicals: [] }]; },
      on: (name, callback) => { (listeners[name] ||= []).push(callback); }, removeListener() {},
      sendBitcoin: async (...args) => { window.mockCalls.memo.push(args); return window.mockMemo(...args); }, send: async () => { throw new Error('Single must not be called in Batch'); },
      signPsbts: async (hexes, options) => { window.mockCalls.signs.push({ method: 'signPsbts', hexes, options });
        if (accountChangeOnSign) for (const listener of listeners.accountsChanged || []) listener();
        if (tamper) { const changed = [...hexes]; changed[changed.length - 1] = changed[0]; return window.mockFinalize(changed); }
        return window.mockFinalize(hexes);
      },
      signPsbt: async (hex, options) => { window.mockCalls.signs.push({ method: 'signPsbt', hexes: [hex], options }); return (await window.mockFinalize([hex]))[0]; },
      pushPsbt: async hex => { window.mockCalls.pushes.push(hex); if (window.mockCalls.pushes.length === failPush) throw new Error('mock push response lost'); if (accountChangeOnPush) for (const listener of listeners.accountsChanged || []) listener(); const txid = await window.mockPush(hex); return wrongTxid ? 'ff'.repeat(32) : txid; },
      pushTx: async hex => { window.mockCalls.pushes.push(hex); return window.mockRawPush(hex); },
    };
    if (fallback) delete provider.signPsbts;
    if (pushRaw) delete provider.pushPsbt;
    if (missingSafe) delete provider.getBitcoinUtxos;
    window.fireBatchWalletChange = () => { for (const listener of listeners.accountsChanged || []) listener(); };
    window.unisat = provider; window.okxwallet = { bitcoin: provider };
  }, { sender, senderScript, publicKey, parentId, fallback, failPush, tamper, missingSafe, network, accountChangeOnSign, accountChangeOnPush, pushRaw, lateReview, wrongTxid });
  await page.goto(`${url}sign/`);
  assert.match(await page.title(), /Transfer.*AIBRC/);
  assert(await page.locator('.md-header').isVisible());
  assert(await page.locator('#single-mode').isVisible());
  await page.locator('#mode-batch').click();
  if (wallet === 'okx') await page.locator('#batch-wallet-okx').click();
  return { page, context, errors };
}
async function untilEnabled(locator) {
  const deadline = Date.now() + 15000;
  while (!(await locator.isEnabled())) {
    if (Date.now() > deadline) throw new Error(`Control did not become enabled: ${await locator.getAttribute('id')}`);
    await new Promise(resolve => setTimeout(resolve, 15));
  }
}
async function prepare(page) {
  await page.locator('#batch-connect').click();
  await untilEnabled(page.locator('#batch-connect'));
  await page.locator('#batch-asset').fill('961555:3'); await page.locator('#batch-list').fill(rows);
  await page.locator('#batch-fee').fill('2'); await page.locator('#batch-review').click();
  await untilEnabled(page.locator('#batch-review'));
  assert.match(await page.locator('#batch-summary').innerText(), /3 transactions · 30 recipients/);
}
async function send(page) { await page.locator('#batch-send').click(); await untilEnabled(page.locator('#batch-reset')); }
try {
  await test('UniSat: 30 recipients -> 3 prebuilt PSBTs, one signPsbts call, sequential push and verification', async () => {
    const f = await fixture(); try { await prepare(f.page); const reviewed = await f.page.locator('#batch-summary').innerText(); await send(f.page);
      const calls = await f.page.evaluate(() => window.mockCalls);
      assert.equal(calls.signs.length, 1); assert.equal(calls.signs[0].hexes.length, 3); assert.equal(calls.signs[0].options.length, 3);
      assert(calls.signs[0].options.every(o => o.autoFinalized === true && o.toSignInputs[0].publicKey === publicKey));
      assert.equal(calls.pushes.length, 3); assert.equal(calls.utxos, 1);
      let recipientIndex = 0;
      for (let i = 0; i < 3; i++) {
        const prepared = Psbt.fromHex(calls.signs[0].hexes[i]);
        const sent = Psbt.fromHex(calls.pushes[i]);
        assert.equal(Buffer.from(prepared.data.globalMap.unsignedTx.toBuffer()).toString('hex'), Buffer.from(sent.data.globalMap.unsignedTx.toBuffer()).toString('hex'));
        const tx = sent.extractTransaction(true); assert(reviewed.includes(tx.getId()));
        const recipientCount = [12, 12, 6][i];
        for (let n = 0; n < recipientCount; n++) {
          assert.equal(Buffer.from(tx.outs[n].script).toString('hex'), Buffer.from(bitcoinAddress.toOutputScript(recipients[recipientIndex++])).toString('hex'));
          assert.equal(tx.outs[n].value, 546n);
        }
      }
      assert.equal(recipientIndex, 30);
      if (evidence) await writeFile(`${evidence}/browser-mock-provider-calls.json`, JSON.stringify(calls, null, 2) + '\n');
      assert.match(await f.page.locator('#batch-status').innerText(), /All transaction structures verified/);
      assert.deepEqual(f.errors, []);
      if (evidence) {
        await f.page.screenshot({ path: `${evidence}/batch-desktop.png`, fullPage: true });
        await f.page.evaluate(() => window.scrollTo(0, 0));
        await f.page.waitForTimeout(250); // Let the existing Material header transition settle for the screenshot.
        await f.page.screenshot({ path: `${evidence}/batch-desktop-viewport.png` });
      }
    } finally { await f.context.close(); }
  });
  await test('OKX: unsupported safe UTXO contract disables Batch; no signing or push', async () => {
    const f = await fixture({ wallet: 'okx' }); try {
      assert(await f.page.locator('#batch-connect').isDisabled()); assert.match(await f.page.locator('#batch-status').innerText(), /no documented safe BTC UTXO/);
      assert.deepEqual(await f.page.evaluate(() => window.mockCalls.signs), []);
    } finally { await f.context.close(); }
  });
  await test('UniSat missing safe UTXO API disables Batch without public-address coin fallback', async () => {
    const f = await fixture({ missingSafe: true }); try { assert(await f.page.locator('#batch-connect').isDisabled()); } finally { await f.context.close(); }
  });
  await test('second push failure stops third; verification/new-draft does not resend', async () => {
    const f = await fixture({ failPush: 2 }); try {
      await prepare(f.page); await send(f.page);
      assert.equal((await f.page.evaluate(() => window.mockCalls.pushes)).length, 2);
      assert.match(await f.page.locator('#batch-results').innerText(), /1\. broadcast/);
      assert.match(await f.page.locator('#batch-results').innerText(), /2\. broadcast result unknown/);
      assert.match(await f.page.locator('#batch-results').innerText(), /3\. not broadcast/);
      assert(await f.page.locator('#batch-send').isDisabled());
      assert.match(await f.page.locator('#batch-status').innerText(), /No automatic rebuild or resend/);
      await f.page.locator('#batch-retry').click(); await untilEnabled(f.page.locator('#batch-reset'));
      assert.equal((await f.page.evaluate(() => window.mockCalls.pushes)).length, 2);
      assert.match(await f.page.locator('#batch-results').innerText(), /3\. not broadcast/);
      await f.page.locator('#batch-reset').click(); assert.equal((await f.page.evaluate(() => window.mockCalls.pushes)).length, 2);
    } finally { await f.context.close(); }
  });
  await test('signPsbt fallback preserves one signed PSBT per prepared transaction', async () => {
    const f = await fixture({ fallback: true }); try { await prepare(f.page); await send(f.page);
      const calls = await f.page.evaluate(() => window.mockCalls); assert.equal(calls.signs.length, 3); assert(calls.signs.every(s => s.method === 'signPsbt')); assert.equal(calls.pushes.length, 3);
    } finally { await f.context.close(); }
  });
  await test('changed last signed PSBT rejects the whole batch before first push', async () => {
    const f = await fixture({ tamper: true }); try { await prepare(f.page); await send(f.page);
      assert.equal((await f.page.evaluate(() => window.mockCalls.pushes)).length, 0);
      assert.match(await f.page.locator('#batch-status').innerText(), /Batch stopped/);
    } finally { await f.context.close(); }
  });
  await test('wallet account-change event during sign invalidates callback before push', async () => {
    const f = await fixture({ accountChangeOnSign: true }); try { await prepare(f.page); await send(f.page);
      assert.equal((await f.page.evaluate(() => window.mockCalls.pushes)).length, 0);
      assert.match(await f.page.locator('#batch-status').innerText(), /Wallet or form changed/);
    } finally { await f.context.close(); }
  });
  await test('Bitcoin read unavailable: retry verification reads only original txids', async () => {
    const f = await fixture({ unknownRead: true }); try { await prepare(f.page); await send(f.page);
      assert.equal((await f.page.evaluate(() => window.mockCalls.pushes)).length, 3);
      await f.page.locator('#batch-retry').click(); await untilEnabled(f.page.locator('#batch-reset'));
      assert.equal((await f.page.evaluate(() => window.mockCalls.pushes)).length, 3);
      assert.match(await f.page.locator('#batch-status').innerText(), /pending/);
    } finally { await f.context.close(); }
  });
  await test('wrong Bitcoin network cannot prepare Batch', async () => {
    const f = await fixture({ network: 'testnet' }); try {
      await f.page.locator('#batch-connect').click(); await untilEnabled(f.page.locator('#batch-connect'));
      assert(await f.page.locator('#batch-review').isDisabled()); assert.match(await f.page.locator('#batch-status').innerText(), /Bitcoin mainnet/);
    } finally { await f.context.close(); }
  });
  await test('account change after first push retains original read-only verification and stops further pushes', async () => {
    const f = await fixture({ accountChangeOnPush: true, unknownRead: true }); try {
      await prepare(f.page); await send(f.page);
      assert.equal((await f.page.evaluate(() => window.mockCalls.pushes)).length, 1);
      assert.match(await f.page.locator('#batch-results').innerText(), /1\. broadcast/);
      await f.page.locator('#batch-retry').click(); await untilEnabled(f.page.locator('#batch-reset'));
      assert.equal((await f.page.evaluate(() => window.mockCalls.pushes)).length, 1);
      assert.match(await f.page.locator('#batch-status').innerText(), /pending/);
    } finally { await f.context.close(); }
  });
  await test('pushTx fallback sends only the already checked raw transaction bytes', async () => {
    const f = await fixture({ pushRaw: true }); try { await prepare(f.page); await send(f.page);
      const calls = await f.page.evaluate(() => window.mockCalls);
      assert.equal(calls.pushes.length, 3); assert(calls.pushes.every(hex => !hex.startsWith('70736274ff')));
      assert.match(await f.page.locator('#batch-status').innerText(), /All transaction structures verified/);
    } finally { await f.context.close(); }
  });
  await test('unconfirmed funding does not create a chain with hidden existing ancestors', async () => {
    const f = await fixture({ fundingConfirmed: false }); try {
      await f.page.locator('#batch-connect').click(); await untilEnabled(f.page.locator('#batch-connect'));
      await f.page.locator('#batch-asset').fill('961555:3'); await f.page.locator('#batch-list').fill(rows);
      await f.page.locator('#batch-fee').fill('2'); await f.page.locator('#batch-review').click(); await untilEnabled(f.page.locator('#batch-review'));
      assert(await f.page.locator('#batch-send').isDisabled()); assert.match(await f.page.locator('#batch-status').innerText(), /No confirmed safe BTC/);
      assert.equal((await f.page.evaluate(() => window.mockCalls.signs)).length, 0);
    } finally { await f.context.close(); }
  });
  await test('Single default UI retains original wallet memo request and readback', async () => {
    const f = await fixture(); try {
      await f.page.locator('#mode-single').click(); await f.page.locator('#sign-connect').click(); await untilEnabled(f.page.locator('#sign-connect'));
      await f.page.locator('#sign-asset').fill('961555:3'); await f.page.locator('#sign-manual').check();
      await f.page.locator('#sign-amount').fill('1'); await f.page.locator('#sign-recipient').fill(recipients[0]);
      await f.page.locator('#sign-review').click(); await untilEnabled(f.page.locator('#sign-review'));
      await f.page.locator('#sign-send').click(); await untilEnabled(f.page.locator('#sign-reset'));
      const calls = await f.page.evaluate(() => window.mockCalls);
      assert.equal(calls.memo.length, 1); assert.equal(calls.memo[0][0], recipients[0]); assert.equal(calls.memo[0][1], 546);
      assert.equal(calls.signs.length, 0); assert.equal(calls.pushes.length, 0);
      assert.match(await f.page.locator('#sign-status').innerText(), /Waiting for Bitcoin confirmation/);
      assert.equal(await f.page.locator('#sign-retry').innerText(), 'Refresh confirmation');
      signed.get('98'.repeat(32)).status = { confirmed: true };
      await f.page.locator('#sign-retry').click(); await untilEnabled(f.page.locator('#sign-reset'));
      assert.match(await f.page.locator('#sign-status').innerText(), /Confirmed on Bitcoin/);
      assert(await f.page.locator('#sign-retry').isHidden()); assert.deepEqual(f.errors, []);
    } finally { await f.context.close(); }
  });
  await test('late review response after account change cannot create a stale plan', async () => {
    const f = await fixture({ lateReview: true }); try {
      await f.page.locator('#batch-connect').click(); await untilEnabled(f.page.locator('#batch-connect'));
      await f.page.locator('#batch-asset').fill('961555:3'); await f.page.locator('#batch-list').fill(rows); await f.page.locator('#batch-fee').fill('2');
      await f.page.locator('#batch-review').click();
      const deadline = Date.now() + 15000;
      while ((await f.page.evaluate(() => window.mockCalls.utxos)) !== 1) {
        if (Date.now() > deadline) throw new Error('Mock safe-UTXO read did not start');
        await new Promise(resolve => setTimeout(resolve, 15));
      }
      await f.page.evaluate(() => { window.fireBatchWalletChange(); window.releaseBatchUtxos(); });
      await untilEnabled(f.page.locator('#batch-reset'));
      assert(await f.page.locator('#batch-confirmation').isHidden()); assert(await f.page.locator('#batch-send').isDisabled());
      assert.equal((await f.page.evaluate(() => window.mockCalls.signs)).length, 0);
    } finally { await f.context.close(); }
  });
  await test('wrong push txid stops after the first push; verification does not resume the batch', async () => {
    const f = await fixture({ wrongTxid: true }); try {
      await prepare(f.page); await send(f.page);
      assert.equal((await f.page.evaluate(() => window.mockCalls.pushes)).length, 1);
      assert.match(await f.page.locator('#batch-results').innerText(), /1\. broadcast result unknown/);
      await f.page.locator('#batch-retry').click(); await untilEnabled(f.page.locator('#batch-reset'));
      assert.equal((await f.page.evaluate(() => window.mockCalls.pushes)).length, 1);
      assert.match(await f.page.locator('#batch-results').innerText(), /2\. not broadcast/);
    } finally { await f.context.close(); }
  });
  await test('source lines and the previous result survive a new draft without resending', async () => {
    const f = await fixture({ failPush: 2 }); try {
      await prepare(f.page);
      const summary = await f.page.locator('#batch-summary').innerText();
      for (const lines of ['1–12', '13–24', '25–30']) assert(summary.includes(`Source lines: ${lines}`));
      await send(f.page);
      const previous = await f.page.locator('#batch-results').innerText();
      await f.page.locator('#batch-reset').click();
      assert.equal(await f.page.locator('#batch-previous-results').textContent(), previous);
      assert(await f.page.locator('#batch-previous').isVisible());
      assert.equal((await f.page.evaluate(() => window.mockCalls.pushes)).length, 2);
      assert.equal(await f.page.locator('#batch-list').inputValue(), rows);
      assert.match(await f.page.locator('#batch-status').innerText(), /recipient list is unchanged/);
    } finally { await f.context.close(); }
  });
  await test('documentation sidebar and search coexist with an unchanged reviewed Batch plan', async () => {
    const f = await fixture(); try {
      await prepare(f.page);
      assert(await f.page.locator('.md-sidebar--primary').isVisible());
      assert.equal(f.page.url(), `${url}sign/`); assert.equal(f.context.pages().length, 1);
      const search = f.page.locator('[data-md-component="search-query"]');
      if (!(await search.isVisible())) await f.page.locator('label.md-header__button[for="__search"]').click();
      await search.fill('Transfer');
      const deadline = Date.now() + 15000;
      while (!/Transfer/.test(await f.page.locator('[data-md-component="search-result"]').innerText())) {
        if (Date.now() > deadline) throw new Error('Documentation search did not produce results');
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      await f.page.keyboard.press('Escape');
      assert(await f.page.locator('#batch-mode').isVisible()); assert(await f.page.locator('#batch-send').isEnabled());
      assert.equal((await f.page.evaluate(() => window.mockCalls.signs)).length, 0); assert.deepEqual(f.errors, []);
    } finally { await f.context.close(); }
  });
  await test('mobile layout and row errors: invalid rows block signing, no horizontal page overflow', async () => {
    const f = await fixture({ mobile: true }); try {
      await prepare(f.page); await f.page.locator('#batch-list').fill(`${recipients[0]} 1\nbad-address 2`);
      assert.match(await f.page.locator('#batch-list-summary').innerText(), /Line 2/); assert(await f.page.locator('#batch-send').isDisabled());
      assert(await f.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)); assert.deepEqual(f.errors, []);
      if (evidence) {
        await f.page.screenshot({ path: `${evidence}/batch-mobile.png`, fullPage: true });
        await f.page.evaluate(() => window.scrollTo(0, 0));
        await f.page.waitForTimeout(250); // Let the existing Material header transition settle for the screenshot.
        await f.page.screenshot({ path: `${evidence}/batch-mobile-viewport.png` });
      }
    } finally { await f.context.close(); }
  });
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
