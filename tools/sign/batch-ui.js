import { decodeAddress, parseLocator, transactionIndex, formatTokens, MEMPOOL_API_BASE } from './sign.js';
import { parseBatchList, splitTransfers, verifyBatchBroadcast, formatSourceLines } from './batch.js';
import { buildBatchPlan, verifySignedPsbt } from './psbt.js';

const HEX64 = /^[0-9a-f]{64}$/i;

// Wallet adapters use one documented safe-UTXO / PSBT flow. Single stays separate.
export function batchWallets(browser) {
  return [
    { id: 'unisat', name: 'UniSat', provider: browser.unisat, safeUtxos: true },
    { id: 'okx', name: 'OKX Wallet', provider: browser.okxwallet?.bitcoin, safeUtxos: false },
  ];
}
export function batchCapability(wallet) {
  if (!wallet?.provider) return { enabled: false, reason: 'Wallet extension not detected.' };
  if (!wallet.safeUtxos || typeof wallet.provider.getBitcoinUtxos !== 'function')
    return { enabled: false, reason: 'Batch unavailable: no documented safe BTC UTXO interface. Single is unchanged.' };
  if (typeof wallet.provider.getPublicKey !== 'function' ||
      !(typeof wallet.provider.signPsbts === 'function' || typeof wallet.provider.signPsbt === 'function') ||
      !(typeof wallet.provider.pushPsbt === 'function' || typeof wallet.provider.pushTx === 'function'))
    return { enabled: false, reason: 'Batch needs safe UTXOs, a public key, PSBT signing and broadcasting.' };
  return { enabled: true, reason: '' };
}

export function startBatchPage({ doc = document, browser = window, fetcher = fetch, apiBase = MEMPOOL_API_BASE } = {}) {
  const root = doc.querySelector('[data-aibrc-sign-tool]');
  if (!root) return { destroy() {} };
  const $ = id => root.querySelector(`#${id}`);
  if (!$('batch-mode')) return { destroy() {} };
  let connected = null, plan = null, assetContext = null, busy = false, attempted = false, revision = 0;
  let mergeDuplicates = true, results = [], selectedWallet = 'unisat';
  const registrations = [], wallets = batchWallets(browser);
  const status = (text, error = false) => { $('batch-status').textContent = text; $('batch-status').dataset.error = String(error); };
  const selected = () => wallets.find(w => w.id === selectedWallet);
  const controls = () => {
    for (const id of ['batch-list', 'batch-asset', 'batch-fee']) $(id).disabled = busy || attempted;
    $('batch-merge').disabled = busy || attempted;
    for (const wallet of wallets) $(`batch-wallet-${wallet.id}`).disabled = busy || attempted;
    $('batch-connect').disabled = busy || attempted || !batchCapability(selected()).enabled;
    $('batch-review').disabled = busy || attempted || !connected;
    $('batch-send').disabled = busy || attempted || !plan;
    $('batch-reset').disabled = busy;
    $('mode-single').disabled = busy;
    $('mode-batch').disabled = busy || (!$('single-mode').hidden && !!$('single-mode').querySelector('select')?.value && $('single-mode').querySelector('select').disabled);
    $('batch-retry').hidden = !results.some(r => ['broadcast', 'broadcast result unknown'].includes(r.state) && !r.verified);
    $('batch-retry').disabled = busy;
  };
  const resultText = () => results.map((r, i) => `${i + 1}. ${r.state}${r.verified ? ' · structure verified' : ''}\nSource lines: ${r.sourceLines}\n${r.txid}${r.detail ? `\n${r.detail}` : ''}`).join('\n\n');
  const renderResults = () => { $('batch-results').textContent = resultText(); };
  const invalidate = () => {
    revision++;
    if (!attempted) { plan = null; assetContext = null; results = []; renderResults(); }
    $('batch-confirmation').hidden = true; controls();
  };
  const chooseWallet = id => {
    selectedWallet = id; connected = null; $('batch-connected').textContent = '';
    for (const wallet of wallets) $(`batch-wallet-${wallet.id}`).setAttribute('aria-pressed', String(wallet.id === id));
    invalidate(); status(batchCapability(selected()).reason || 'Connect your wallet to prepare a batch.');
  };
  async function read(path, json = true) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetcher(`${apiBase}${path}`, { signal: controller.signal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error(`Public Bitcoin data unavailable (HTTP ${response.status}).`);
      const text = await response.text();
      if (text.length > 8 * 1024 * 1024) throw new Error('Bitcoin response is too large.');
      return json ? JSON.parse(text) : text.trim();
    } finally { clearTimeout(timer); }
  }
  async function addressOf(wallet) {
    const provider = wallet.provider;
    let address;
    if (typeof provider.getAccounts === 'function') {
      const accounts = await provider.getAccounts(); address = Array.isArray(accounts) ? accounts[0] : accounts;
    }
    if (!address) {
      if (typeof provider.requestAccounts === 'function') address = (await provider.requestAccounts())[0];
      else address = (await provider.connect()).address;
    }
    if (typeof provider.getNetwork !== 'function') throw new Error('This Batch wallet must expose its Bitcoin network.');
    const network = await provider.getNetwork();
    if (!['livenet', 'mainnet'].includes(network)) throw new Error('Switch your wallet to Bitcoin mainnet.');
    return decodeAddress(address).address;
  }
  async function resolveAsset(value) {
    let locator, txid, blockHash;
    if (/^\d+:\d+$/.test(value)) {
      locator = parseLocator(value); blockHash = await read(`/block-height/${locator.blockHeight}`, false);
      if (!HEX64.test(blockHash)) throw new Error('Invalid deployment block hash.');
      txid = await read(`/block/${blockHash}/txid/${locator.txIndex}`, false);
    } else {
      txid = value.toLowerCase(); if (!HEX64.test(txid)) throw new Error('Enter a deploy txid or height:txIndex.');
      const tx = await read(`/tx/${txid}`);
      if (tx.txid?.toLowerCase() !== txid || tx.status?.confirmed !== true || !Number.isInteger(tx.status.block_height) || !HEX64.test(tx.status.block_hash))
        throw new Error('Deploy transaction is not confirmed or its Bitcoin context is unavailable.');
      blockHash = tx.status.block_hash;
      locator = { blockHeight: tx.status.block_height, txIndex: transactionIndex(await read(`/block/${blockHash}/txids`), txid) };
    }
    if (!HEX64.test(txid)) throw new Error('No deployment transaction at this position.');
    const currentHash = await read(`/block-height/${locator.blockHeight}`, false);
    if (currentHash.toLowerCase() !== blockHash.toLowerCase()) throw new Error('Deployment block changed. Review again.');
    return { locator, txid: txid.toLowerCase(), blockHash: blockHash.toLowerCase() };
  }
  async function verifyFunding(transaction, parents = new Map(), allowUnconfirmed = false) {
    const unconfirmed = new Set();
    for (const input of transaction.inputs) {
      if (!parents.has(input.txid)) parents.set(input.txid, await read(`/tx/${input.txid}`));
      const tx = parents.get(input.txid), output = tx.vout?.[input.vout];
      if (tx.txid?.toLowerCase() !== input.txid) throw new Error('Funding transaction ID mismatch.');
      if (tx.status?.confirmed !== true) {
        if (allowUnconfirmed) { unconfirmed.add(`${input.txid}:${input.vout}`); continue; }
        throw new Error('Batch funding must be confirmed first. Wait for your wallet BTC transaction to confirm, then review again.');
      }
      if (output?.scriptpubkey?.toLowerCase() !== input.scriptPubKey || output?.value !== input.value)
        throw new Error('Wallet funding data does not match the confirmed Bitcoin output. Nothing was sent.');
    }
    return unconfirmed;
  }
  const unchanged = (version, account) => {
    if (version !== revision || connected !== account || account.wallet !== selected() || account.wallet.provider !== selected().provider)
      throw new Error('Wallet or form changed. Review again.');
  };
  const showList = () => {
    const parsed = parseBatchList($('batch-list').value, { mergeDuplicates });
    $('batch-list-summary').textContent = `${parsed.recipients.length} ${parsed.recipients.length === 1 ? 'recipient' : 'recipients'} · ${formatTokens(BigInt(parsed.totalAmount))} tokens\n`+
      `BTC to recipients: ${parsed.recipients.length * 546} sats\n`+
      (parsed.errors.length ? parsed.errors.map(e => `Line ${e.lineNumber}: ${e.message}`).join('\n') : 'All rows valid.');
    return parsed;
  };
  for (const id of ['batch-list', 'batch-asset', 'batch-fee']) $(id).addEventListener('input', () => {
    invalidate(); status('Draft changed. Review the updated plan before signing.');
    try { showList(); } catch (error) { $('batch-list-summary').textContent = error.message; }
  });
  $('batch-merge').addEventListener('click', () => {
    mergeDuplicates = !mergeDuplicates; $('batch-merge').setAttribute('aria-pressed', String(mergeDuplicates));
    $('batch-merge').textContent = `Merge duplicate addresses: ${mergeDuplicates ? 'on' : 'off'}`;
    invalidate(); try { showList(); } catch (error) { status(error.message, true); }
  });
  for (const wallet of wallets) {
    $(`batch-wallet-${wallet.id}`).addEventListener('click', () => chooseWallet(wallet.id));
    const notifyChange = () => {
      connected = null; invalidate(); $('batch-connected').textContent = 'Wallet changed. Connect again.';
      status(attempted ? 'Wallet changed. Batch stopped; inspect the original transaction IDs below. Do not resend.' : 'Wallet changed. Connect and review again.', true);
    };
    for (const event of ['accountsChanged', 'accountChanged', 'networkChanged']) {
      wallet.provider?.on?.(event, notifyChange); registrations.push([wallet.provider, event, notifyChange]);
    }
  }
  $('batch-connect').addEventListener('click', async () => {
    if (busy || attempted) return;
    busy = true; controls(); const version = revision, wallet = selected(); status('Waiting for wallet connection…');
    try {
      if (!batchCapability(wallet).enabled) throw new Error(batchCapability(wallet).reason);
      if (typeof wallet.provider.requestAccounts === 'function') await wallet.provider.requestAccounts(); else await wallet.provider.connect();
      const address = await addressOf(wallet), publicKey = await wallet.provider.getPublicKey();
      if (typeof publicKey !== 'string' || !/^(?:[0-9a-f]{64}|0[23][0-9a-f]{64})$/i.test(publicKey))
        throw new Error('Wallet returned an unsupported public key.');
      if (revision !== version || selected() !== wallet) throw new Error('Wallet changed. Connect again.');
      connected = { wallet, address, publicKey }; $('batch-connected').textContent = address;
      status('Connected. Paste recipients, set a fee rate, then review the complete plan.');
      if (!$('batch-fee').value) {
        try { const fees = await read('/v1/fees/recommended');
          if (revision === version && connected?.wallet === wallet && !$('batch-fee').value && Number.isFinite(fees.halfHourFee) && fees.halfHourFee > 0)
            $('batch-fee').value = String(fees.halfHourFee);
        } catch { /* The user can enter a rate; no alternate service or UTXO lookup. */ }
      }
    } catch (error) { if (version === revision) { connected = null; status(error.message, true); } }
    finally { busy = false; controls(); }
  });
  $('batch-review').addEventListener('click', async () => {
    if (busy || attempted || !connected) return;
    invalidate(); busy = true; controls(); const version = revision, account = connected;
    status('Preparing the complete plan from wallet-safe BTC UTXOs…');
    try {
      const parsed = showList();
      if (parsed.errors.length || !parsed.recipients.length) throw new Error('Fix the marked rows before preparing a batch.');
      const context = await resolveAsset($('batch-asset').value.trim());
      const senderScript = decodeAddress(account.address).scriptPubKey;
      const chunks = splitTransfers({ recipients: parsed.recipients, sender: account.address, locator: context.locator, wallet: account.wallet.id });
      // UniSat's current implementation returns the safe set once. Do not page repeatedly.
      let utxos = await account.wallet.provider.getBitcoinUtxos(), prepared;
      const fundingReads = new Map();
      for (;;) {
        prepared = await buildBatchPlan({ chunks, sender: account.address, senderScript, publicKey: account.publicKey, utxos, feeRate: Number($('batch-fee').value) });
        unchanged(version, account);
        const unconfirmed = await verifyFunding(prepared.transactions[0], fundingReads, true);
        if (!unconfirmed.size) break;
        // Exclude only wallet-supplied unconfirmed coins before presenting a plan.
        utxos = utxos.filter(u => !unconfirmed.has(`${String(u.txid ?? u.txId).toLowerCase()}:${u.vout ?? u.vOut}`));
        if (!utxos.length) throw new Error('No confirmed safe BTC funding is available. Wait for confirmation, then review again.');
      }
      unchanged(version, account);
      plan = { ...prepared, account, version }; assetContext = context;
      results = prepared.transactions.map(t => ({ txid: t.txid, state: 'not broadcast', verified: false, sourceLines: formatSourceLines(t.chunk) })); renderResults();
      $('batch-summary').textContent = `${prepared.transactions.length} transactions · ${parsed.recipients.length} recipients\n`+
        prepared.transactions.map((t, i) => `${i + 1}. ${t.chunk.allocations.length} recipients · ${t.chunk.payloadHex.length / 2} bytes · ≤ ${t.vsize} vB · fee ${t.fee} sats\n   Source lines: ${formatSourceLines(t.chunk)}\n   ${t.txid}`).join('\n')+
        `\nFee rate: ${$('batch-fee').value} sat/vB\nBTC to recipients: ${parsed.recipients.length * 546} sats\n`+
        `Total network fees: ${prepared.transactions.reduce((s, t) => s + t.fee, 0)} sats\nTotal BTC spent: ${parsed.recipients.length * 546 + prepared.transactions.reduce((s, t) => s + t.fee, 0)} sats\n`+
        'Wallet reviews may be per transaction, even with the batch-signing API. The displayed plan fixes the outputs and fees before wallet approval.';
      $('batch-confirmation').hidden = false; status('Review every recipient and the complete BTC cost, then approve in your wallet.');
    } catch (error) { if (version === revision) { plan = null; status(error.message, true); } }
    finally { busy = false; controls(); }
  });
  async function verifyOne(index) {
    const entry = results[index], transaction = plan.transactions[index];
    try {
      const tx = await read(`/tx/${entry.txid}`);
      const result = verifyBatchBroadcast(tx, transaction.chunk, entry.txid);
      if (!result.ok) { entry.detail = result.errors.join(' '); renderResults(); return false; }
      entry.state = 'broadcast'; entry.verified = true; entry.detail = tx.status?.confirmed ? 'Bitcoin confirmed; check AIBRC state with your indexer.' : 'Bitcoin unconfirmed; structure matches the plan.';
    } catch (error) { entry.detail = `Verification pending: ${error.message} Retry verification only.`; }
    renderResults(); return true;
  }
  $('batch-send').addEventListener('click', async () => {
    if (busy || attempted || !plan) return;
    busy = true; controls(); const original = plan, account = original.account, context = assetContext;
    const provider = account.wallet.provider;
    try {
      status('Rechecking deployment position and wallet before signing…');
      unchanged(original.version, account);
      const hash = await read(`/block-height/${context.locator.blockHeight}`, false);
      const position = await read(`/block/${hash}/txid/${context.locator.txIndex}`, false);
      if (hash.toLowerCase() !== context.blockHash || position.toLowerCase() !== context.txid)
        throw new Error('Deployment position changed. Review a new plan.');
      if (await addressOf(account.wallet) !== account.address || await provider.getPublicKey() !== account.publicKey)
        throw new Error('Wallet changed. Connect and review again.');
      unchanged(original.version, account);
      await verifyFunding(original.transactions[0]);
      unchanged(original.version, account);
      const hexes = original.transactions.map(t => t.psbtHex);
      const options = original.transactions.map(t => ({ autoFinalized: true, toSignInputs: t.inputs.map((_, index) => ({ index, publicKey: account.publicKey, sighashTypes: [t.inputs[0].scriptPubKey.startsWith('5120') ? 0 : 1] })) }));
      attempted = true; controls(); status('Waiting for wallet signature review. The wallet may ask you to review each transaction.');
      let signed;
      if (typeof provider.signPsbts === 'function') signed = await provider.signPsbts(hexes, options);
      else { signed = []; for (let i = 0; i < hexes.length; i++) {
        unchanged(original.version, account); signed.push(await provider.signPsbt(hexes[i], options[i]));
      } }
      unchanged(original.version, account);
      if (!Array.isArray(signed) || signed.length !== hexes.length) throw new Error('Wallet returned an incomplete signed batch. Nothing was broadcast by this page.');
      // Validate the WHOLE signed batch before sending its first transaction.
      const checked = [];
      for (let i = 0; i < signed.length; i++) checked.push(await verifySignedPsbt(signed[i], original.transactions[i]));
      unchanged(original.version, account);
      for (let i = 0; i < signed.length; i++) {
        unchanged(original.version, account);
        if (await addressOf(account.wallet) !== account.address) throw new Error('Wallet account changed. Remaining transactions were not broadcast.');
        unchanged(original.version, account);
        const entry = results[i]; entry.state = 'broadcast result unknown'; renderResults();
        let returned;
        try { returned = typeof provider.pushPsbt === 'function' ? await provider.pushPsbt(signed[i]) : await provider.pushTx(checked[i].rawTxHex); }
        catch (error) { entry.detail = `Stopped: ${error.message}. Inspect this expected txid in your wallet before doing anything else.`; renderResults(); throw error; }
        if (typeof returned !== 'string' || returned.toLowerCase() !== entry.txid) {
          entry.detail = 'Wallet returned a different or invalid txid. Inspect the original transaction; do not resend.'; renderResults(); throw new Error(entry.detail);
        }
        entry.state = 'broadcast'; renderResults();
        if (!(await verifyOne(i))) throw new Error('Broadcast structure did not match. Remaining transactions were not broadcast.');
      }
      status(results.every(r => r.verified) ? 'Batch broadcast. All transaction structures verified. Bitcoin confirmation and the AIBRC result can be checked separately.' : 'Batch broadcast. Some reads are pending; retry verification only.');
    } catch (error) {
      status(attempted ? `Batch stopped. ${error.message} No automatic rebuild or resend. Inspect the listed original txids in your wallet.` : error.message, true);
      if (!attempted) invalidate();
    } finally { busy = false; controls(); }
  });
  $('batch-retry').addEventListener('click', async () => {
    if (busy || !plan) return; busy = true; controls();
    try { for (let i = 0; i < results.length; i++) if (['broadcast', 'broadcast result unknown'].includes(results[i].state) && !results[i].verified) await verifyOne(i);
      status(results.filter(r => ['broadcast', 'broadcast result unknown'].includes(r.state)).every(r => r.verified) ? 'Broadcast transactions verified. This read did not resend anything.' : 'Some verification reads are still pending. No transaction was resent.');
    } finally { busy = false; controls(); }
  });
  $('batch-reset').addEventListener('click', () => {
    if (busy) return;
    if (attempted && results.length) {
      $('batch-previous-results').textContent = resultText(); $('batch-previous').hidden = false;
    }
    attempted = false; results = []; invalidate(); renderResults();
    status('New draft. The recipient list is unchanged. Compare source lines with the previous results before sending; do not resend an unknown result.');
  });
  for (const [name, panel] of [['single', 'single-mode'], ['batch', 'batch-mode']]) $( `mode-${name}`).addEventListener('click', () => {
    $('single-mode').hidden = name !== 'single'; $('batch-mode').hidden = name !== 'batch';
    $('mode-single').setAttribute('aria-selected', String(name === 'single')); $('mode-batch').setAttribute('aria-selected', String(name === 'batch'));
  });
  const singleControlsObserver = new MutationObserver(() => controls());
  singleControlsObserver.observe($('single-mode'), { subtree: true, attributes: true, attributeFilter: ['disabled'] });
  chooseWallet('unisat');
  return { destroy() { singleControlsObserver.disconnect(); for (const [provider, event, listener] of registrations) provider?.removeListener?.(event, listener); } };
}

if (typeof document !== 'undefined') startBatchPage();
