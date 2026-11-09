// Local-only BIP174 v0/SegWit builder. No wallet, network, key generation or signing.
// The caller supplies wallet-filtered coins and confirms selected parent prevouts
// before signing. A <=24-transaction new chain assumes those parents are confirmed.
export const DUST_SATS = 546;
export const MAX_CHAIN_LENGTH = 24;
export const MAX_STANDARD_WEIGHT = 400000;
export const MAX_PSBT_BYTES = 2 * 1024 * 1024;
export const MAX_MONEY = 21000000 * 100000000;
const EMPTY = new Uint8Array();
const MAGIC = Uint8Array.of(0x70, 0x73, 0x62, 0x74, 0xff);
const error = message => { throw new Error(`PSBT: ${message}`); };
const integer = (value, max, label) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) error(`Invalid ${label}.`);
  return value;
};
const money = value => integer(value, MAX_MONEY, 'satoshi value');
export function hexToBytes(hex, maxBytes = MAX_PSBT_BYTES) {
  if (typeof hex !== 'string' || hex.length % 2 || hex.length / 2 > maxBytes || !/^[0-9a-f]*$/i.test(hex)) error('Invalid or oversized hex.');
  return Uint8Array.from(hex.match(/../g) ?? [], h => parseInt(h, 16));
}
export const bytesToHex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const concat = (...parts) => {
  const result = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0; for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
};
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const le = (n, length) => {
  integer(n, Number.MAX_SAFE_INTEGER, 'integer'); let value = BigInt(n);
  const result = new Uint8Array(length);
  for (let i = 0; i < length; i++) { result[i] = Number(value & 255n); value >>= 8n; }
  if (value) error('Integer does not fit.'); return result;
};
export function compactSize(n) {
  integer(n, Number.MAX_SAFE_INTEGER, 'CompactSize');
  return n < 253 ? Uint8Array.of(n) : n <= 0xffff ? concat(Uint8Array.of(253), le(n, 2))
    : n <= 0xffffffff ? concat(Uint8Array.of(254), le(n, 4)) : concat(Uint8Array.of(255), le(n, 8));
}
const sized = bytes => concat(compactSize(bytes.length), bytes);
class Reader {
  constructor(bytes) { this.bytes = bytes; this.offset = 0; }
  get remaining() { return this.bytes.length - this.offset; }
  take(n) { integer(n, this.remaining, 'field length'); const out = this.bytes.slice(this.offset, this.offset + n); this.offset += n; return out; }
  number(n) {
    const data = this.take(n); let value = 0n;
    for (let i = data.length - 1; i >= 0; i--) value = value * 256n + BigInt(data[i]);
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) error('Integer exceeds safe range.'); return Number(value);
  }
  compact(max = MAX_PSBT_BYTES) {
    const first = this.number(1); const value = first < 253 ? first : this.number(first === 253 ? 2 : first === 254 ? 4 : 8);
    if (first === 253 && value < 253 || first === 254 && value <= 0xffff || first === 255 && value <= 0xffffffff) error('Noncanonical CompactSize.');
    return integer(value, max, 'CompactSize bound');
  }
  variable(max = MAX_PSBT_BYTES) { return this.take(this.compact(Math.min(max, this.remaining))); }
  done() { if (this.remaining) error('Trailing bytes.'); }
}
const scriptType = script => /^5120[0-9a-f]{64}$/.test(script) ? 'P2TR'
  : /^0014[0-9a-f]{40}$/.test(script) ? 'P2WPKH' : error('Unsupported native SegWit script.');
const scriptHex = script => { const hex = bytesToHex(hexToBytes(script, 10000)); scriptType(hex); return hex; };
const reverseHex = hex => hexToBytes(hex).reverse();
function outputBytes(output) {
  const script = hexToBytes(output.scriptPubKeyHex ?? output.scriptPubKey, 10000);
  return concat(le(money(output.value), 8), sized(script));
}
function inputBytes(input) {
  if (!/^[0-9a-f]{64}$/i.test(input.txid)) error('Invalid txid.');
  return concat(reverseHex(input.txid), le(integer(input.vout, 0xffffffff, 'vout'), 4),
    sized(hexToBytes(input.scriptSigHex ?? '', 10000)), le(input.sequence ?? 0xffffffff, 4));
}
export function serializeTransaction(tx, includeWitness = true) {
  const hasWitness = includeWitness && tx.inputs.some(i => i.witness?.length);
  const parts = [le(tx.version ?? 2, 4), ...(hasWitness ? [Uint8Array.of(0, 1)] : []),
    compactSize(tx.inputs.length), ...tx.inputs.map(inputBytes), compactSize(tx.outputs.length), ...tx.outputs.map(outputBytes)];
  if (hasWitness) for (const input of tx.inputs) parts.push(serializeWitness(input.witness ?? []));
  parts.push(le(tx.locktime ?? 0, 4)); return concat(...parts);
}
export const serializeUnsignedTransaction = tx => serializeTransaction(tx, false);
export function serializeWitness(items) { return concat(compactSize(items.length), ...items.map(h => sized(hexToBytes(h)))); }
function readWitness(reader) {
  const count = reader.compact(reader.remaining); const result = [];
  for (let i = 0; i < count; i++) result.push(bytesToHex(reader.variable())); return result;
}
export function parseTransaction(input) {
  const bytes = typeof input === 'string' ? hexToBytes(input) : input;
  if (!(bytes instanceof Uint8Array) || bytes.length > MAX_PSBT_BYTES) error('Invalid transaction bytes.');
  const r = new Reader(bytes), version = r.number(4); let witness = false;
  if (r.bytes[r.offset] === 0) { r.take(1); if (r.number(1) !== 1) error('Invalid SegWit flag.'); witness = true; }
  const inputCount = r.compact(Math.floor(r.remaining / 41)); if (!inputCount) error('Empty inputs.');
  const inputs = [];
  for (let i = 0; i < inputCount; i++) inputs.push({ txid: bytesToHex(r.take(32).reverse()), vout: r.number(4), scriptSigHex: bytesToHex(r.variable(10000)), sequence: r.number(4) });
  const outputCount = r.compact(Math.floor(r.remaining / 9)); if (!outputCount) error('Empty outputs.');
  const outputs = []; let total = 0;
  for (let i = 0; i < outputCount; i++) {
    const value = money(r.number(8)), scriptPubKeyHex = bytesToHex(r.variable(10000)); total = money(total + value);
    outputs.push({ value, scriptPubKeyHex, scriptPubKey: scriptPubKeyHex });
  }
  if (witness) {
    for (const input of inputs) input.witness = readWitness(r);
    if (!inputs.some(i => i.witness.length)) error('Superfluous SegWit serialization.');
  }
  const locktime = r.number(4); r.done(); return { version, inputs, outputs, locktime, hasWitness: witness };
}
export async function transactionId(tx) {
  const bytes = typeof tx === 'string' ? serializeUnsignedTransaction(parseTransaction(tx)) : serializeUnsignedTransaction(tx);
  const hash = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
  return bytesToHex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', hash)).reverse());
}
function readMap(r) {
  const map = new Map();
  while (true) {
    const length = r.compact(Math.min(10000, r.remaining)); if (!length) return map;
    const key = bytesToHex(r.take(length)); if (map.has(key)) error('Duplicate PSBT key.');
    map.set(key, r.variable());
  }
}
const mapBytes = map => concat(...Array.from(map, ([key, value]) => concat(sized(hexToBytes(key)), sized(value))), Uint8Array.of(0));
export function serializePsbt({ globals, inputs, outputs }) { return bytesToHex(concat(MAGIC, mapBytes(globals), ...inputs.map(mapBytes), ...outputs.map(mapBytes))); }
function checkSingleton(map, types) {
  for (const key of map.keys()) if (types.has(key.slice(0, 2)) && key.length !== 2) error('Unexpected PSBT key data.');
}
export function parsePsbt(hex) {
  const r = new Reader(hexToBytes(hex)); if (!same(r.take(5), MAGIC)) error('Invalid PSBT magic.');
  const globals = readMap(r); checkSingleton(globals, new Set(['00', 'fb']));
  const unsigned = globals.get('00'); if (!unsigned) error('Missing unsigned transaction.');
  if (globals.has('fb') && (globals.get('fb').length !== 4 || new Reader(globals.get('fb')).number(4) !== 0)) error('Only PSBT version 0 is supported.');
  const transaction = parseTransaction(unsigned);
  if (transaction.hasWitness || transaction.inputs.some(i => i.scriptSigHex)) error('Unsigned PSBT must have empty scripts and no witness.');
  const inputs = transaction.inputs.map(() => readMap(r));
  const outputs = transaction.outputs.map(() => readMap(r)); r.done();
  for (const map of inputs) checkSingleton(map, new Set(['00', '01', '03', '04', '05', '07', '08', '13', '17', '18']));
  return { globals, inputs, outputs, transaction, unsignedTxHex: bytesToHex(unsigned) };
}
function readWitnessUtxo(value) {
  if (!value) error('Missing witnessUtxo.'); const r = new Reader(value);
  const amount = money(r.number(8)), script = bytesToHex(r.variable(10000)); r.done(); return { value: amount, scriptPubKeyHex: script };
}
export function opReturnScript(payloadHex) {
  const bytes = hexToBytes(payloadHex, 80); if (!bytes.length) error('Empty payload.');
  return bytesToHex(concat(Uint8Array.of(0x6a), bytes.length <= 75 ? Uint8Array.of(bytes.length) : Uint8Array.of(0x4c, bytes.length), bytes));
}
function noSecrets(object) { if (['privateKey', 'privateKeys', 'mnemonic', 'seed'].some(k => Object.hasOwn(object, k))) error('Private signing material is not accepted.'); }
function alias(object, names, label) {
  const values = names.filter(n => object[n] !== undefined).map(n => object[n]);
  if (!values.length || values.some(v => v !== values[0])) error(`Missing or conflicting ${label}.`); return values[0];
}
function normalizeCoin(coin, senderScript, sender) {
  if (!coin || typeof coin !== 'object') error('Invalid wallet coin.'); noSecrets(coin);
  for (const key of ['inscriptions', 'atomicals', 'runes', 'assets', 'tokens', 'brc20', 'brc20s', 'assetMetadata']) {
    if (coin[key] !== undefined && !(Array.isArray(coin[key]) && coin[key].length === 0 || coin[key] && Object.getPrototypeOf(coin[key]) === Object.prototype && Object.keys(coin[key]).length === 0)) error('Wallet coin contains asset metadata.');
  }
  if (['isLocked', 'isInscription', 'hasInscription', 'hasRunes', 'hasAtomicals'].some(k => coin[k] === true)) error('Wallet coin is marked protected.');
  const txid = alias(coin, ['txid', 'txId'], 'txid'); if (typeof txid !== 'string' || !/^[0-9a-f]{64}$/i.test(txid)) error('Invalid wallet coin txid.');
  const vout = integer(alias(coin, ['vout', 'vOut'], 'vout'), 0xffffffff, 'vout');
  const value = money(alias(coin, ['value', 'satoshis'], 'coin amount')); if (!value) error('Zero wallet coin.');
  const script = scriptHex(alias(coin, ['scriptPubKeyHex', 'scriptPubKey', 'scriptPk'], 'coin script'));
  if (script !== senderScript || coin.address !== undefined && coin.address.toLowerCase() !== sender.toLowerCase()) error('Coin is not from the sender account.');
  return { txid: txid.toLowerCase(), vout, value, scriptPubKeyHex: script, scriptPubKey: script, sequence: 0xffffffff };
}
export function estimateVsize(inputs, outputs) {
  const base = serializeUnsignedTransaction({ version: 2, locktime: 0, inputs, outputs }).length;
  // P2WPKH: DER signature including ALL byte <=73. P2TR: 64 DEFAULT or 65 ALL.
  const witness = 2 + inputs.reduce((n, input) => n + (scriptType(input.scriptPubKeyHex ?? input.scriptPubKey) === 'P2TR' ? 67 : 109), 0);
  const weight = base * 4 + witness; if (weight > MAX_STANDARD_WEIGHT) error('Transaction exceeds standard weight.');
  return Math.ceil(weight / 4);
}
const frozen = value => { if (value && typeof value === 'object') { for (const v of Object.values(value)) frozen(v); Object.freeze(value); } return value; };
export async function buildBatchPlan(options) {
  if (!options || typeof options !== 'object') error('Invalid plan.'); noSecrets(options);
  const { chunks, sender, publicKey, utxos, feeRate } = options;
  if (!Array.isArray(chunks) || !chunks.length || chunks.length > MAX_CHAIN_LENGTH) error('The new chain must contain 1–24 transactions.');
  if (typeof sender !== 'string' || !sender) error('Missing sender.');
  const senderScript = scriptHex(options.senderScript), type = scriptType(senderScript);
  if (typeof publicKey !== 'string' || !/^(?:[0-9a-f]{64}|0[23][0-9a-f]{64})$/i.test(publicKey) || type === 'P2WPKH' && publicKey.length !== 66) error('Invalid wallet public key.');
  if (typeof feeRate !== 'number' || !Number.isFinite(feeRate) || feeRate <= 0) error('Invalid fee rate.');
  if (!Array.isArray(utxos) || !utxos.length) error('No safe wallet coins.');
  const coins = utxos.map(u => normalizeCoin(u, senderScript, sender)), seen = new Set();
  for (const coin of coins) { const id = `${coin.txid}:${coin.vout}`; if (seen.has(id)) error('Duplicate wallet outpoint.'); seen.add(id); }
  // Stable largest-first selection avoids exhausting standard weight on tiny coins.
  coins.sort((a, b) => b.value - a.value);
  const templates = chunks.map(chunk => {
    if (!chunk || !Array.isArray(chunk.allocations) || !chunk.allocations.length || chunk.allocations.length > 25 || chunk.authInputIndex !== 0 || chunk.senderScript !== senderScript || chunk.sender !== sender) error('Invalid transfer chunk.');
    const outputs = chunk.allocations.map((a, i) => {
      if (a.receiverOutputIndex !== i) error('Receiver indexes must be consecutive.');
      const script = scriptHex(a.scriptPubKeyHex); return { value: DUST_SATS, scriptPubKeyHex: script, scriptPubKey: script, address: a.address };
    });
    const script = opReturnScript(chunk.payloadHex); outputs.push({ value: 0, scriptPubKeyHex: script, scriptPubKey: script }); return outputs;
  });
  const changeOutput = { value: DUST_SATS, scriptPubKeyHex: senderScript, scriptPubKey: senderScript, address: sender };
  const totalDust = templates.reduce((n, t) => money(n + (t.length - 1) * DUST_SATS), 0);
  const charge = vsize => money(Math.ceil(vsize * feeRate));
  const selected = []; let selectedValue = 0, required = Infinity;
  for (const coin of coins) {
    selected.push(coin); selectedValue = money(selectedValue + coin.value);
    required = totalDust + templates.reduce((n, outputs, i) => n + charge(estimateVsize(i === 0 ? selected : [coins[0]], i < chunks.length - 1 ? [...outputs, changeOutput] : outputs)), 0);
    money(required); if (selectedValue >= required) break;
  }
  if (selectedValue < required) error('Insufficient safe wallet BTC for all recipients and fees.');
  const transactions = []; let inputs = selected, totalFees = 0, totalVsize = 0;
  for (let i = 0; i < chunks.length; i++) {
    const inputTotal = inputs.reduce((n, c) => money(n + c.value), 0), outputs = templates[i].map(o => ({ ...o }));
    const dust = (outputs.length - 1) * DUST_SATS;
    let vsize = estimateVsize(inputs, [...outputs, changeOutput]), fee = charge(vsize), change = inputTotal - dust - fee;
    if (change >= DUST_SATS) outputs.push({ ...changeOutput, value: change });
    else {
      if (i < chunks.length - 1) error('Insufficient change for the next prebuilt transaction.');
      vsize = estimateVsize(inputs, outputs); fee = money(inputTotal - dust); change = 0;
      if (fee < charge(vsize)) error('Insufficient fee.');
    }
    const unsigned = { version: 2, locktime: 0, inputs, outputs }, unsignedTxHex = bytesToHex(serializeUnsignedTransaction(unsigned));
    const maps = inputs.map(c => {
      const map = new Map([['01', outputBytes(c)]]);
      if (type === 'P2TR') map.set('17', hexToBytes(publicKey.length === 64 ? publicKey : publicKey.slice(2)));
      else map.set('03', le(1, 4)); return map;
    });
    const psbtHex = serializePsbt({ globals: new Map([['00', hexToBytes(unsignedTxHex)]]), inputs: maps, outputs: outputs.map(() => new Map()) });
    if (psbtHex.length / 2 > MAX_PSBT_BYTES) error('PSBT exceeds size bound.');
    const txid = await transactionId(unsigned);
    const planned = { psbtHex, txid, unsignedTxHex, inputs: inputs.map(c => ({ ...c, publicKey })), outputs,
      chunk: chunks[i], vsize, estimatedUpperVsize: vsize, fee, feeRate, change, changeOutputIndex: change ? outputs.length - 1 : null, publicKey, sender, senderScript };
    transactions.push(planned); totalFees = money(totalFees + fee); totalVsize += vsize;
    if (i < chunks.length - 1) inputs = [{ txid, vout: planned.changeOutputIndex, value: change, scriptPubKeyHex: senderScript, scriptPubKey: senderScript, sequence: 0xffffffff }];
  }
  return frozen({ transactions, totals: { inputValue: selectedValue, dust: totalDust, dustSats: totalDust, fee: totalFees, fees: totalFees, vsize: totalVsize, change: transactions.at(-1).change, spent: totalDust + totalFees }, feeRate });
}
function checkDerAll(bytes) {
  if (bytes.length < 9 || bytes.length > 73 || bytes.at(-1) !== 1 || bytes[0] !== 0x30 || bytes[1] !== bytes.length - 3 || bytes[2] !== 2) error('Expected strict DER SIGHASH_ALL.');
  const r = bytes[3], sAt = 4 + r;
  if (!r || sAt + 2 >= bytes.length || bytes[sAt] !== 2) error('Invalid DER R.');
  const s = bytes[sAt + 1];
  if (!s || r + s + 7 !== bytes.length || bytes[4] & 0x80 || r > 1 && bytes[4] === 0 && !(bytes[5] & 0x80) || bytes[sAt + 2] & 0x80 || s > 1 && bytes[sAt + 2] === 0 && !(bytes[sAt + 3] & 0x80)) error('Invalid DER integers.');
}
export async function verifySignedPsbt(signedHex, planned) {
  const parsed = parsePsbt(signedHex);
  if (!planned || parsed.unsignedTxHex !== planned.unsignedTxHex || planned.inputs.length !== parsed.inputs.length) error('Signed unsigned transaction differs from the plan.');
  const tx = parsed.transaction;
  for (let i = 0; i < parsed.inputs.length; i++) {
    const map = parsed.inputs[i], expected = planned.inputs[i], utxo = readWitnessUtxo(map.get('01'));
    if (utxo.value !== expected.value || utxo.scriptPubKeyHex !== expected.scriptPubKeyHex) error('Signed prevout data differs from the plan.');
    if (map.has('07') && map.get('07').length) error('Native SegWit scriptSig must be empty.');
    if (Array.from(map.keys()).some(k => ['04', '05', '14', '15'].includes(k.slice(0, 2)))) error('Script-path or redeem-script material is unsupported.');
    if (!map.has('08')) error('Wallet must return a finalized PSBT.');
    const r = new Reader(map.get('08')), witness = readWitness(r); r.done();
    const type = scriptType(expected.scriptPubKeyHex); let sighash;
    if (type === 'P2TR') {
      if (witness.length !== 1) error('Only Taproot key-path witnesses without annex are supported.');
      const signature = hexToBytes(witness[0]);
      if (signature.length === 64) sighash = 0;
      else if (signature.length === 65 && signature[64] === 1) sighash = 1;
      else error('Taproot signature must use DEFAULT or ALL.');
      const internal = map.get('17'), expectedInternal = hexToBytes(expected.publicKey.length === 64 ? expected.publicKey : expected.publicKey.slice(2));
      if (internal && !same(internal, expectedInternal)) error('Taproot internal key differs from the plan.');
    } else {
      if (witness.length !== 2 || witness[1] !== expected.publicKey.toLowerCase()) error('P2WPKH witness/public key mismatch.');
      checkDerAll(hexToBytes(witness[0])); sighash = 1;
    }
    if (map.has('03')) { const bytes = map.get('03'); if (bytes.length !== 4 || new Reader(bytes).number(4) !== sighash) error('PSBT sighash metadata disagrees with the final witness.'); }
    if (map.has('00')) {
      const parent = parseTransaction(map.get('00'));
      if (await transactionId(parent) !== expected.txid || parent.outputs[expected.vout]?.value !== expected.value || parent.outputs[expected.vout]?.scriptPubKeyHex !== expected.scriptPubKeyHex) error('nonWitnessUtxo differs from the referenced prevout.');
    }
    tx.inputs[i].witness = witness;
  }
  const raw = serializeTransaction(tx), stripped = serializeUnsignedTransaction(tx), weight = stripped.length * 4 + raw.length - stripped.length;
  const vsize = Math.ceil(weight / 4), txid = await transactionId(tx);
  if (txid !== planned.txid || weight > MAX_STANDARD_WEIGHT || vsize > planned.vsize) error('Signed transaction identity or size differs from the plan.');
  const fee = planned.inputs.reduce((n, x) => money(n + x.value), 0) - tx.outputs.reduce((n, x) => money(n + x.value), 0);
  if (fee !== planned.fee || fee < Math.ceil(vsize * planned.feeRate)) error('Signed transaction fee differs from the plan.');
  return Object.freeze({ rawTxHex: bytesToHex(raw), txid, vsize, fee, weight, signatureVerification: 'NOT_RUN' });
}
