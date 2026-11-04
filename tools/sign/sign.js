import {
  NetworkId, MAX_U128, encodeTransfer, decodeTransfer,
  classifyScriptPubKey, extractAibrcPayloadFromScript,
} from './aibrc-protocol.browser.js';

// Edit together with the /sign/* connect-src response header when self-hosting.
export const MEMPOOL_API_BASE = 'https://mempool.space/api';
export const BTC_TO_RECIPIENT_SATS = 546;
export const OKX_BTC_VALUE = '0.00000546'; // OKX send.value is BTC, not satoshis.
// Pending a real UniSat wallet test. This is not a verified layout guarantee.
export const UNISAT_RECEIVER_OUTPUT_INDEX = 0;
const HEX64 = /^[0-9a-f]{64}$/i;
const alphabet = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

export function parseTokenAmount(value) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,8})?$/.test(value) || value.length > 48)
    throw new Error('Enter a token amount with up to 8 decimal places, without spaces or exponents.');
  const [whole, fraction = ''] = value.split('.');
  const amount = BigInt(whole) * 100000000n + BigInt(fraction.padEnd(8, '0'));
  if (amount < 1n || amount > MAX_U128) throw new Error('Amount is outside the protocol range.');
  return amount;
}

export function formatTokens(amount) {
  const fraction = (amount % 100000000n).toString().padStart(8, '0').replace(/0+$/, '');
  return `${amount / 100000000n}${fraction ? `.${fraction}` : ''}`;
}

// BIP173/BIP350: validate the full address, then apply AIBRC's supported scripts.
export function decodeAddress(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 90 ||
      value !== value.toLowerCase() && value !== value.toUpperCase())
    throw new Error('Invalid Bitcoin address length or mixed case.');
  const text = value.toLowerCase(), split = text.lastIndexOf('1');
  if (split < 1 || split + 7 > text.length || text.slice(0, split) !== 'bc')
    throw new Error('Use a Bitcoin mainnet P2WPKH (bc1q) or Taproot (bc1p) address.');
  const data = [...text.slice(split + 1)].map(c => alphabet.indexOf(c));
  if (data.some(n => n < 0)) throw new Error('Invalid Bitcoin address characters.');
  const hrp = text.slice(0, split);
  const expanded = [...hrp].map(c => c.charCodeAt(0) >> 5)
    .concat([0], [...hrp].map(c => c.charCodeAt(0) & 31));
  let check = 1;
  const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  for (const n of [...expanded, ...data]) {
    const top = check >>> 25;
    check = (check & 0x1ffffff) << 5 ^ n;
    for (let i = 0; i < 5; i++) if (top >>> i & 1) check ^= generators[i];
  }
  const version = data[0];
  if (version > 16 || (check >>> 0) !== (version === 0 ? 1 : 0x2bc830a3))
    throw new Error('Invalid Bitcoin address checksum or witness encoding.');
  const bytes = []; let accumulator = 0, bits = 0;
  for (const n of data.slice(1, -6)) {
    accumulator = (accumulator << 5 | n) & 4095; bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push(accumulator >>> bits & 255); }
  }
  if (bits >= 5 || (accumulator << (8 - bits) & 255) !== 0)
    throw new Error('Invalid Bitcoin address padding.');
  if (!(version === 0 && bytes.length === 20 || version === 1 && bytes.length === 32))
    throw new Error('This tool supports P2WPKH and P2TR only; P2WSH and other scripts are unsupported.');
  const scriptPubKey = `${version === 0 ? '0014' : '5120'}${bytes.map(b => b.toString(16).padStart(2, '0')).join('')}`;
  if (classifyScriptPubKey(scriptPubKey) === 'UNSUPPORTED') throw new Error('Unsupported account script.');
  return { address: text, scriptPubKey };
}

export function parseLocator(value) {
  if (!/^\d{1,10}:\d{1,5}$/.test(value)) throw new Error('Use height:txIndex, for example 961555:3.');
  const [blockHeight, txIndex] = value.split(':').map(Number);
  if (blockHeight > 0xffffffff || txIndex > 0xffff) throw new Error('Asset locator is outside the protocol range.');
  return { blockHeight, txIndex };
}

export function transactionIndex(txids, txid) {
  if (!Array.isArray(txids) || !HEX64.test(txid)) throw new Error('Invalid block transaction list or txid.');
  const index = txids.findIndex(id => typeof id === 'string' && id.toLowerCase() === txid.toLowerCase());
  if (index < 0 || index > 0xffff || txids.filter(id => typeof id === 'string' && id.toLowerCase() === txid.toLowerCase()).length !== 1)
    throw new Error('The deploy transaction has no unique supported position in this block.');
  return index;
}

export function encodeIntent({ wallet, sender, recipient, amountText, locator }) {
  if (!['okx', 'unisat'].includes(wallet)) throw new Error('Select UniSat or OKX Wallet.');
  const from = decodeAddress(sender), to = decodeAddress(recipient), amount = parseTokenAmount(amountText);
  const receiverOutputIndex = wallet === 'okx' ? 0 : UNISAT_RECEIVER_OUTPUT_INDEX;
  const payload = encodeTransfer({ network: NetworkId.MAINNET, authInputIndex: 0,
    assetLocator: locator, allocations: [{ receiverOutputIndex, amount }] });
  const decoded = decodeTransfer(payload);
  if (decoded.network !== NetworkId.MAINNET || decoded.authInputIndex !== 0 ||
      decoded.allocations[0].amount !== amount || decoded.allocations[0].receiverOutputIndex !== receiverOutputIndex)
    throw new Error('Transfer payload did not round-trip.');
  return Object.freeze({ wallet, sender: from.address, senderScript: from.scriptPubKey,
    recipient: to.address, recipientScript: to.scriptPubKey, amount: amount.toString(),
    tokens: formatTokens(amount), locator: Object.freeze({ ...locator }), receiverOutputIndex,
    payloadHex: payload.toString('hex') });
}

export function walletSendRequest(intent) {
  if (intent.wallet === 'okx') return { method: 'send', args: [{ from: intent.sender,
    to: intent.recipient, value: OKX_BTC_VALUE, memo: intent.payloadHex, memoPos: 1 }] };
  if (intent.wallet === 'unisat') return { method: 'sendBitcoin',
    args: [intent.recipient, BTC_TO_RECIPIENT_SATS, { memo: intent.payloadHex }] };
  throw new Error('Unsupported wallet.');
}

export function walletTxid(wallet, result) {
  const value = wallet === 'okx' ? result?.txhash : result;
  if (typeof value !== 'string' || !HEX64.test(value)) throw new Error('Wallet did not return a valid transaction ID.');
  return value.toLowerCase();
}

export function verifyBroadcast(tx, intent, txid) {
  const errors = [];
  if (!tx || tx.txid?.toLowerCase() !== txid) errors.push('Transaction ID mismatch.');
  const outputs = Array.isArray(tx?.vout) ? tx.vout : [];
  const markers = outputs.filter(o => typeof o.scriptpubkey === 'string' && /^6a/i.test(o.scriptpubkey));
  if (markers.length !== 1) errors.push('Expected exactly one OP_RETURN output.');
  else {
    const extracted = extractAibrcPayloadFromScript(markers[0].scriptpubkey);
    if (extracted.status !== 'VALID_AIBRC_PAYLOAD' || extracted.payload.toString('hex') !== intent.payloadHex)
      errors.push('AIBRC payload mismatch.');
    else {
      try { decodeTransfer(extracted.payload); } catch { errors.push('AIBRC Transfer could not be decoded.'); }
    }
  }
  const receiver = outputs[intent.receiverOutputIndex];
  if (receiver?.scriptpubkey?.toLowerCase() !== intent.recipientScript) errors.push('Recipient script mismatch.');
  if (receiver?.value !== BTC_TO_RECIPIENT_SATS) errors.push('Recipient BTC amount mismatch.');
  if (tx?.vin?.[0]?.prevout?.scriptpubkey?.toLowerCase() !== intent.senderScript) errors.push('Authorization input script mismatch.');
  return { ok: errors.length === 0, errors };
}

export function parsePrefill(search) {
  const params = new URLSearchParams(search);
  if (![...params.keys()].length) return {};
  const allowed = new Set(['v', 'asset', 'amount', 'to']);
  if (params.get('v') !== '1' || [...params.keys()].some(key => !allowed.has(key) || params.getAll(key).length !== 1))
    throw new Error('Unsupported or duplicate link parameters. Use v=1, asset, amount and to.');
  return { asset: params.get('asset') ?? '', amount: params.get('amount') ?? '', to: params.get('to') ?? '' };
}

export function startPage({ doc = document, browser = window, fetcher = fetch, apiBase = MEMPOOL_API_BASE } = {}) {
  const $ = id => doc.getElementById(id);
  let connected = null, review = null, pending = null, busy = false, attempted = false, revision = 0;
  const providers = () => ({ unisat: browser.unisat, okx: browser.okxwallet?.bitcoin });
  const status = (text, error = false) => { $('status').textContent = text; $('status').dataset.error = String(error); };
  const controls = () => {
    for (const el of doc.querySelectorAll('input,select')) el.disabled = busy || attempted;
    $('connect').disabled = busy || attempted || !$('wallet').value;
    $('review').disabled = busy || attempted || !connected;
    $('send').disabled = busy || attempted || !review;
    $('retry').hidden = !pending; $('retry').disabled = busy;
    $('reset').disabled = busy;
  };
  const invalidate = () => { revision++; review = null; $('confirmation').hidden = true; controls(); };
  async function read(path, json = true) {
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 15000);
    try {
      const response = await fetcher(`${apiBase}${path}`, { signal: abort.signal,
        credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error(`Bitcoin data unavailable (HTTP ${response.status}). Retry the read; do not send again.`);
      const text = await response.text();
      if (text.length > 8 * 1024 * 1024) throw new Error('Bitcoin response is too large.');
      return json ? JSON.parse(text) : text.trim();
    } finally { clearTimeout(timer); }
  }
  async function addressOf(provider, wallet) {
    let address;
    if (typeof provider.getAccounts === 'function') {
      const accounts = await provider.getAccounts(); address = Array.isArray(accounts) ? accounts[0] : accounts;
    }
    if (!address) address = wallet === 'okx' ? (await provider.connect()).address : (await provider.requestAccounts())[0];
    if (typeof provider.getNetwork === 'function') {
      const network = await provider.getNetwork();
      if (!['livenet', 'mainnet'].includes(network)) throw new Error('Switch your wallet to Bitcoin mainnet.');
    }
    return decodeAddress(address).address;
  }
  const notifyChange = () => {
    invalidate(); connected = null;
    $('connected').textContent = 'Wallet changed. Connect again and review the original transaction if one is pending.';
    if (!pending) status('Wallet account or network changed. The previous review is no longer valid.', true);
    controls();
  };
  const registrations = [];
  for (const [wallet, provider] of Object.entries(providers())) {
    const available = wallet === 'okx' ? typeof provider?.connect === 'function' && typeof provider?.send === 'function'
      : typeof provider?.requestAccounts === 'function' && typeof provider?.sendBitcoin === 'function';
    if (!available) continue;
    const option = doc.createElement('option'); option.value = wallet; option.textContent = wallet === 'okx' ? 'OKX Wallet' : 'UniSat'; $('wallet').append(option);
    const events = wallet === 'okx' ? ['accountsChanged', 'accountChanged', 'networkChanged'] : ['accountsChanged', 'networkChanged'];
    for (const event of events) {
      provider.on?.(event, notifyChange); registrations.push([provider, event]);
    }
  }
  if (!$('wallet').options.length) {
    const option = doc.createElement('option'); option.value = ''; option.textContent = 'No supported wallet detected'; $('wallet').append(option);
    status('Open this page in UniSat or OKX Wallet, or install their browser extension.');
  }
  try {
    const values = parsePrefill(browser.location.search);
    $('asset').value = values.asset ?? ''; $('amount').value = values.amount ?? ''; $('recipient').value = values.to ?? '';
    $('manual').checked = /^\d+:\d+$/.test($('asset').value);
  } catch (error) { status(error.message, true); }
  for (const el of doc.querySelectorAll('input,select')) el.addEventListener('input', () => {
    invalidate(); if (el.id === 'wallet') { connected = null; $('connected').textContent = ''; controls(); }
  });
  $('connect').addEventListener('click', async () => {
    if (busy || attempted) return; busy = true; controls(); status('Waiting for wallet connection…');
    const wallet = $('wallet').value, provider = providers()[wallet];
    try {
      if (wallet === 'okx') await provider.connect(); else await provider.requestAccounts();
      const address = await addressOf(provider, wallet);
      if (wallet !== $('wallet').value || provider !== providers()[wallet]) throw new Error('Wallet changed. Connect again.');
      connected = { wallet, provider, address }; $('connected').textContent = address; status('Connected. Enter the transfer and choose Review.');
    } catch (error) { connected = null; status(error.message, true); }
    finally { busy = false; controls(); }
  });
  $('review').addEventListener('click', async () => {
    if (busy || attempted || !connected) return; invalidate(); busy = true; controls(); status('Reading public Bitcoin data…');
    const version = revision, account = connected;
    try {
      let locator, txid, blockHash;
      if ($('manual').checked) {
        locator = parseLocator($('asset').value); blockHash = await read(`/block-height/${locator.blockHeight}`, false);
        if (!HEX64.test(blockHash)) throw new Error('Bitcoin service returned an invalid block hash.');
        txid = await read(`/block/${blockHash}/txid/${locator.txIndex}`, false);
        if (!HEX64.test(txid)) throw new Error('No transaction found at that locator.');
      } else {
        txid = $('asset').value.toLowerCase(); if (!HEX64.test(txid)) throw new Error('Enter a 64-character deploy transaction ID.');
        const tx = await read(`/tx/${txid}`);
        if (tx.txid !== txid || tx.status?.confirmed !== true || !Number.isInteger(tx.status.block_height) || !HEX64.test(tx.status.block_hash))
          throw new Error('Deploy transaction is not confirmed or its Bitcoin context is unavailable.');
        blockHash = tx.status.block_hash;
        locator = { blockHeight: tx.status.block_height, txIndex: transactionIndex(await read(`/block/${blockHash}/txids`), txid) };
      }
      const tipText = await read('/blocks/tip/height', false);
      if (!/^\d+$/.test(tipText)) throw new Error('Bitcoin service returned an invalid tip height.');
      const confirmations = Number(tipText) - locator.blockHeight + 1;
      if (!Number.isSafeInteger(confirmations) || confirmations < 1) throw new Error('Block is not on the reported confirmed chain.');
      const intent = encodeIntent({ wallet: account.wallet, sender: account.address,
        recipient: $('recipient').value, amountText: $('amount').value, locator });
      if (version !== revision || connected !== account) throw new Error('Wallet or form changed. Review again.');
      review = { intent, blockHash: blockHash.toLowerCase(), txid: txid.toLowerCase(), version, account };
      $('summary').textContent = `Asset locator ${locator.blockHeight}:${locator.txIndex} (${confirmations} confirmations)\n`+
        `${intent.tokens} tokens = ${intent.amount} base units\nRecipient: ${intent.recipient}\nReceiver output index: ${intent.receiverOutputIndex}\n`+
        'BTC to recipient: 546 sats + network fee set by your wallet\n'+
        `Payload: ${intent.payloadHex}\n`+(confirmations < 6 ? 'Fewer than 6 confirmations: the deployment position can change in a reorganization.\n' : '');
      $('confirmation').hidden = false; status('Review the decoded transfer and the wallet payment before approving.');
    } catch (error) { review = null; status(error.message, true); }
    finally { busy = false; controls(); }
  });
  async function inspectPending() {
    if (!pending) return;
    const current = pending;
    status('Broadcast returned a transaction ID. Reading its structure…');
    try {
      const result = verifyBroadcast(await read(`/tx/${current.txid}`), current.intent, current.txid);
      if (pending !== current) return;
      status(result.ok ? 'Broadcast. Structure verified. After 1 confirmation, check the recipient balance on the platform or any AIBRC indexer.'
        : `${result.errors.join(' ')} The asset result is not verified. Do not send again; inspect the original transaction in your wallet or explorer.`, !result.ok);
    } catch (error) { if (pending === current) status(`Pending verification. ${error.message}`, true); }
  }
  $('send').addEventListener('click', async () => {
    if (busy || attempted || !review) return;
    const original = review; busy = true; controls(); status('Rechecking the Bitcoin block and wallet…');
    try {
      const hash = await read(`/block-height/${original.intent.locator.blockHeight}`, false);
      if (!HEX64.test(hash)) throw new Error('Bitcoin service returned an invalid block hash.');
      const position = await read(`/block/${hash}/txid/${original.intent.locator.txIndex}`, false);
      if (hash.toLowerCase() !== original.blockHash || position.toLowerCase() !== original.txid) {
        invalidate(); throw new Error('The deployment block or transaction position changed. Review this transfer again.');
      }
      const { wallet, provider, address } = original.account;
      const currentAddress = await addressOf(provider, wallet);
      if (original !== review || original.version !== revision || provider !== providers()[wallet] || currentAddress !== address)
        throw new Error('Wallet or form changed. Review again.');
      const request = walletSendRequest(original.intent); attempted = true; controls(); status('Waiting for your wallet. It builds, signs and broadcasts the transaction.');
      const returned = await provider[request.method](...request.args);
      pending = { txid: walletTxid(wallet, returned), intent: original.intent };
      $('transaction').textContent = pending.txid;
      $('explorer').href = `https://mempool.space/tx/${pending.txid}`; $('explorer').hidden = false;
      await inspectPending();
    } catch (error) {
      status(attempted ? `No verified transaction result was received. ${error.message} Check your wallet history before starting a new transfer; do not automatically send again.` : error.message, true);
      if (!attempted) invalidate();
    } finally { busy = false; controls(); }
  });
  $('retry').addEventListener('click', async () => { if (busy || !pending) return; busy = true; controls(); try { await inspectPending(); } finally { busy = false; controls(); } });
  $('reset').addEventListener('click', () => {
    if (busy) return; attempted = false; pending = null; invalidate(); $('transaction').textContent = ''; $('explorer').hidden = true;
    status('Ready for a new draft. Check your wallet history first if a previous result was unknown.'); controls();
  });
  controls();
  return { destroy() { for (const [provider, event] of registrations) provider.removeListener?.(event, notifyChange); } };
}

if (typeof document !== 'undefined') startPage();
