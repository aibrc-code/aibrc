import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Buffer as ProtocolBuffer, NetworkId, MAX_U128, MAX_ALLOCATIONS,
  COMPAT_PAYLOAD_BYTES, encodeTransfer, decodeTransfer,
} from './aibrc-protocol.browser.js';
import { decodeAddress, formatTokens, verifyBroadcast as verifySingleBroadcast } from './sign.js';
import { parseBatchList, splitTransfers, verifyBatchBroadcast, formatSourceLines } from './batch.js';

const sender = 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0';
const recipient = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const locator = { blockHeight: 961555, txIndex: 3 }, txid = '12'.repeat(32);
const rowsFor = (amounts) => amounts.map((amount, index) => ({
  address: index % 2 ? sender : recipient, amount: amount.toString(), lineNumbers: [index + 1],
}));
const split = (amounts) => splitTransfers({ recipients: rowsFor(amounts), sender, locator });
const oneTokens = (N) => Array.from({ length: N }, () => 100000000n);
const opReturn = (hex) => {
  const length = hex.length / 2;
  return `6a${length <= 75 ? '' : '4c'}${length.toString(16).padStart(2, '0')}${hex}`;
};
function receipt(chunk = split(oneTokens(2))[0]) {
  return { txid, vin: [{ prevout: { scriptpubkey: chunk.senderScript } }], vout: [
    ...chunk.allocations.map((row) => ({ scriptpubkey: row.scriptPubKeyHex, value: 546 })),
    { scriptpubkey: opReturn(chunk.payloadHex), value: 0 },
    { scriptpubkey: chunk.senderScript, value: 9000 },
  ] };
}

test('parse spaces, commas, tabs, CRLF, blanks and full-line comments with exact quantities', () => {
  const result = parseBatchList(`# contributors\r\n\r\n  ${recipient} 1\r\n${sender},0.00000001\r\n${recipient}\t2.5`);
  assert.equal(result.ok, true);
  assert.equal(result.validLineCount, 3);
  assert.equal(result.recipientCount, 2);
  assert.equal(result.duplicateLineCount, 1);
  assert.equal(result.totalAmount, '350000001');
  assert.equal(result.totalTokens, '3.50000001');
  assert.equal(result.dustSats, 1092);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.recipients[0], {
    address: recipient, scriptPubKeyHex: decodeAddress(recipient).scriptPubKey,
    amount: '350000000', tokens: '3.5', lineNumbers: [3, 5],
  });
  assert.deepEqual(result.recipients[1].lineNumbers, [4]);
});

test('duplicate merge is selectable, preserves first occurrence and normalizes address case', () => {
  const text = `${sender.toUpperCase()} 1\n${recipient} 2\n${sender} 3`;
  const merged = parseBatchList(text), separate = parseBatchList(text, { mergeDuplicates: false });
  assert.deepEqual(merged.recipients.map((row) => row.address), [sender, recipient]);
  assert.deepEqual(merged.recipients.map((row) => row.amount), ['400000000', '200000000']);
  assert.deepEqual(separate.recipients.map((row) => row.address), [sender, recipient, sender]);
  assert.deepEqual(separate.recipients.map((row) => row.lineNumbers), [[1], [2], [3]]);
  assert.equal(separate.duplicateLineCount, 1);
  assert.equal(separate.totalAmount, merged.totalAmount);
  assert.equal(separate.dustSats, 1638);
});

test('invalid rows report their actual line numbers and keep the list invalid', () => {
  const text = [
    '# ignored', `${recipient} 1`, 'bad-address 1', `${recipient} 0`, `${recipient} -1`,
    `${recipient} 1e3`, `${recipient} 1.123456789`, recipient, `${recipient} 1 extra`,
    'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx 1',
  ].join('\n');
  const result = parseBatchList(text);
  assert.equal(result.ok, false);
  assert.equal(result.validLineCount, 1);
  assert.deepEqual(result.errors.map((error) => error.lineNumber), [3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(result.errors[0].input, 'bad-address 1');
  assert(result.errors.every((error) => typeof error.message === 'string' && error.message.length > 0));
  assert.equal(result.totalAmount, '100000000');
});

test('merged u128 overflow is a row error; separate valid rows retain their amounts', () => {
  const text = `${recipient} ${formatTokens(MAX_U128)}\n${recipient} 0.00000001`;
  const merged = parseBatchList(text), separate = parseBatchList(text, { mergeDuplicates: false });
  assert.equal(merged.ok, false);
  assert.equal(merged.errors[0].lineNumber, 2);
  assert.match(merged.errors[0].message, /merged amount exceeds/);
  assert.equal(separate.ok, true);
  assert.deepEqual(separate.recipients.map((row) => row.amount), [MAX_U128.toString(), '1']);
});

test('empty/comment-only input has no plan, and parser result data is immutable', () => {
  assert.equal(parseBatchList(' \n # no recipients\r\n').ok, false);
  assert.equal(parseBatchList('').recipientCount, 0);
  assert.throws(() => parseBatchList(null), TypeError);
  assert.throws(() => parseBatchList('', { mergeDuplicates: 'yes' }), TypeError);
  const parsed = parseBatchList(`${recipient} 1`);
  assert(Object.isFrozen(parsed)); assert(Object.isFrozen(parsed.recipients));
  assert(Object.isFrozen(parsed.recipients[0])); assert(Object.isFrozen(parsed.recipients[0].lineNumbers));
  assert.throws(() => { parsed.recipients[0].amount = '1'; }, TypeError);
});

for (const [N, counts, bytes] of [
  [12, [12], [78]], [13, [12, 1], [78, 23]], [14, [12, 2], [78, 28]],
  [26, [12, 12, 2], [78, 78, 28]], [30, [12, 12, 6], [78, 78, 48]],
  [100, [12, 12, 12, 12, 12, 12, 12, 12, 4], [78, 78, 78, 78, 78, 78, 78, 78, 38]],
]) test(`${N} recipients at one token split by real compatibility bytes`, () => {
  const chunks = split(oneTokens(N));
  assert.deepEqual(chunks.map((chunk) => chunk.allocations.length), counts);
  assert.deepEqual(chunks.map((chunk) => chunk.payloadBytes), bytes);
  assert(chunks.every((chunk) => chunk.dustSats === chunk.allocations.length * 546));
  assert.deepEqual(chunks.flatMap((chunk) => chunk.allocations.flatMap((row) => row.lineNumbers)), Array.from({ length: N }, (_,index) => index + 1));
});

test('small quantities reach 25 allocations while 19-byte amounts fit only three', () => {
  const tiny = split(Array(26).fill(1n));
  assert.deepEqual(tiny.map((chunk) => chunk.allocations.length), [25, 1]);
  assert.deepEqual(tiny.map((chunk) => chunk.payloadBytes), [68, 20]);
  const large = split(Array(4).fill(MAX_U128));
  assert.deepEqual(large.map((chunk) => chunk.allocations.length), [3, 1]);
  assert.deepEqual(large.map((chunk) => chunk.payloadBytes), [78, 38]);
});

test('chunks are deeply immutable and copy the input locator and recipient metadata', () => {
  const rows = rowsFor(oneTokens(2)), position = { ...locator };
  const chunks = splitTransfers({ recipients: rows, sender: sender.toUpperCase(), locator: position, wallet: 'okx' });
  rows[0].amount = '1'; rows[0].lineNumbers[0] = 99; position.blockHeight = 1;
  const chunk = chunks[0];
  assert(Object.isFrozen(chunks)); assert(Object.isFrozen(chunk)); assert(Object.isFrozen(chunk.locator));
  assert(Object.isFrozen(chunk.allocations)); assert(Object.isFrozen(chunk.allocations[0]));
  assert(Object.isFrozen(chunk.allocations[0].lineNumbers));
  assert.equal(chunk.wallet, 'okx'); assert.equal(chunk.sender, sender);
  assert.equal(chunk.allocations[0].amount, '100000000'); assert.deepEqual(chunk.allocations[0].lineNumbers, [1]);
  assert.deepEqual(chunk.locator, locator);
});

test('split rejects invalid source data without amount coercion or script substitution', () => {
  const call = (recipients, extra = {}) => splitTransfers({ recipients, sender, locator, ...extra });
  assert.throws(() => call([])); assert.throws(() => call(null));
  assert.throws(() => call(rowsFor([1n]), { wallet: 'unknown' }));
  assert.throws(() => call(rowsFor([1n]), { sender: 'bad-address' }));
  assert.throws(() => call(rowsFor([1n]), { locator: { blockHeight: -1, txIndex: 0 } }));
  for (const amount of ['0', '-1', '1.0', '1e8', '01', 1, 1n, (MAX_U128 + 1n).toString()]) {
    assert.throws(() => call([{ address: recipient, amount }]));
  }
  assert.throws(() => call([{ address: recipient, amount: '1', scriptPubKeyHex: decodeAddress(sender).scriptPubKey }]));
  assert.throws(() => call([{ address: recipient, amount: '1', lineNumbers: [0] }]));
});

test('fixed-seed input sequence preserves order, sums and greedy maximality across varint boundaries', () => {
  let seed = 0xa1b7cb47n;
  const amounts = [1n, 127n, 128n, 16383n, 16384n, 100000000n, MAX_U128];
  for (let index = 0; index < 64; index++) {
    seed = (seed * 6364136223846793005n + 1442695040888963407n) & MAX_U128;
    amounts.push(seed || 1n);
  }
  const rows = rowsFor(amounts), chunks = splitTransfers({ recipients: rows, sender, locator });
  const flat = chunks.flatMap((chunk) => chunk.allocations);
  assert.deepEqual(flat.map((row) => row.amount), amounts.map(String));
  assert.deepEqual(flat.map((row) => row.address), rows.map((row) => row.address));
  assert.equal(flat.reduce((total, row) => total + BigInt(row.amount), 0n), amounts.reduce((a, b) => a + b, 0n));
  let offset = 0;
  for (const chunk of chunks) {
    const decoded = decodeTransfer(ProtocolBuffer.from(chunk.payloadHex, 'hex'));
    assert.equal(decoded.network, NetworkId.MAINNET); assert.equal(decoded.authInputIndex, 0);
    assert.deepEqual(decoded.assetLocator, locator);
    assert(chunk.payloadBytes <= COMPAT_PAYLOAD_BYTES && decoded.allocations.length <= MAX_ALLOCATIONS);
    assert.deepEqual(decoded.allocations, chunk.allocations.map((row, index) => ({ receiverOutputIndex: index, amount: BigInt(row.amount) })));
    offset += chunk.allocations.length;
    if (offset < rows.length && chunk.allocations.length < MAX_ALLOCATIONS) {
      const probe = [...chunk.allocations, rows[offset]].map((row, index) => ({ receiverOutputIndex: index, amount: BigInt(row.amount) }));
      assert(encodeTransfer({ network: NetworkId.MAINNET, authInputIndex: 0, assetLocator: locator, allocations: probe }).length > COMPAT_PAYLOAD_BYTES);
    }
  }
});

test('multi-recipient readback positive control uses actual parser and OP_PUSHDATA1 for 78 bytes', () => {
  const chunk = split(oneTokens(12))[0], tx = receipt(chunk);
  assert.equal(tx.vout[12].scriptpubkey.slice(0, 6), '6a4c4e');
  assert.deepEqual(verifyBatchBroadcast(tx, chunk, txid), { ok: true, errors: [] });
});

for (const [name, mutate] of [
  ['wrong txid', (tx) => { tx.txid = '34'.repeat(32); }],
  ['extra OP_RETURN', (tx) => { tx.vout.push({ scriptpubkey: '6a00', value: 0 }); }],
  ['missing recipient', (tx) => { tx.vout.splice(1, 1); }],
  ['changed BTC amount', (tx) => { tx.vout[1].value = 545; }],
  ['changed recipient script', (tx) => { tx.vout[1].scriptpubkey = '0014' + '00'.repeat(20); }],
  ['changed payload byte', (tx) => {
    const original = tx.vout[2].scriptpubkey;
    tx.vout[2].scriptpubkey = original.slice(0, -2) + (original.endsWith('01') ? '02' : '01');
  }],
  ['non-sender input zero with sender later', (tx) => { tx.vin.unshift({ prevout: { scriptpubkey: decodeAddress(recipient).scriptPubKey } }); }],
  ['missing input-zero prevout', (tx) => { delete tx.vin[0].prevout; }],
]) test(`multi-recipient readback rejects ${name}`, () => {
  const chunk = split(oneTokens(2))[0], tx = receipt(chunk);
  assert.equal(verifyBatchBroadcast(tx, chunk, txid).ok, true);
  mutate(tx);
  assert.equal(verifyBatchBroadcast(tx, chunk, txid).ok, false);
});

test('readback rejects altered expected allocation amounts and malformed transaction data', () => {
  const chunk = split(oneTokens(2))[0], tx = receipt(chunk);
  const altered = { ...chunk, allocations: chunk.allocations.map((row) => ({ ...row, amount: '1' })) };
  assert.equal(verifyBatchBroadcast(tx, altered, txid).ok, false);
  assert.equal(verifyBatchBroadcast(null, chunk, txid).ok, false);
  assert.equal(verifyBatchBroadcast({ ...tx, txid: 1 }, chunk, txid).ok, false);
  assert.equal(verifyBatchBroadcast(tx, chunk, 'not-a-txid').ok, false);
  assert.equal(verifyBatchBroadcast(tx, null, txid).ok, false);
});

// Mutation/old-implementation control: using the frozen Single verifier in the
// Batch slot misses a changed SECOND recipient. Single semantics are unchanged.
test('replacing multi-allocation readback with frozen Single verification misses a second-recipient mutation', () => {
  const chunk = split(oneTokens(2))[0], tx = receipt(chunk), first = chunk.allocations[0];
  const singleShape = { payloadHex: chunk.payloadHex, receiverOutputIndex: 0,
    recipientScript: first.scriptPubKeyHex, senderScript: chunk.senderScript };
  assert.equal(verifySingleBroadcast(tx, singleShape, txid).ok, true);
  assert.equal(verifyBatchBroadcast(tx, chunk, txid).ok, true);
  tx.vout[1].value = 545;
  assert.equal(verifySingleBroadcast(tx, singleShape, txid).ok, true);
  assert.equal(verifyBatchBroadcast(tx, chunk, txid).ok, false);
});

test('source line labels preserve comments, blanks and non-adjacent duplicate merges', () => {
  const text = `# recipients\n${recipient} 1\n\n${sender} 2\n${recipient} 3`;
  const parsed = parseBatchList(text);
  assert.deepEqual(parsed.recipients[0].lineNumbers, [2, 5]);
  const chunks = splitTransfers({ recipients: parsed.recipients, sender, locator });
  assert.equal(formatSourceLines(chunks[0]), '2, 4–5');
  assert.deepEqual(chunks[0].allocations.map(a => a.lineNumbers), [[2, 5], [4]]);
});
test('each chunk has its own exact source lines after greedy splitting', () => {
  const chunks = split(oneTokens(30));
  assert.deepEqual(chunks.map(formatSourceLines), ['1–12', '13–24', '25–30']);
});
