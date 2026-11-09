import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as bitcoin from 'bitcoinjs-lib';
import {
  buildBatchPlan, verifySignedPsbt, parsePsbt, serializePsbt, parseTransaction,
  serializeUnsignedTransaction, serializeWitness, serializeTransaction, transactionId,
  bytesToHex, hexToBytes, compactSize, opReturnScript, estimateVsize,
  MAX_PSBT_BYTES, MAX_MONEY,
} from './psbt.js';

// Public generator point/BIP350 fixtures only. All witnesses below are synthetic
// structural doubles: no private scalar, cryptographic signature or broadcast.
const PUB = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const XONLY = PUB.slice(2);
const WPKH = bytesToHex(bitcoin.payments.p2wpkh({ pubkey: hexToBytes(PUB) }).output);
const TR = `5120${XONLY}`;
const sender = 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0';
const hex = n => n.toString(16).padStart(64, '0');
function coin(n, value = 100000, script = TR) {
  return { txid: hex(n), vout: n % 3, value, scriptPubKeyHex: script, inscriptions: [], runes: [], atomicals: [] };
}
function chunk(count = 2, script = TR, payloadBytes = 31) {
  return { sender, senderScript: script, authInputIndex: 0,
    payloadHex: '41'.repeat(payloadBytes), payloadBytes, dustSats: count * 546,
    allocations: Array.from({ length: count }, (_, i) => ({ address: 'synthetic receiver',
      scriptPubKeyHex: i % 2 ? TR : WPKH, receiverOutputIndex: i, amount: '100000000' })) };
}
const request = (script = TR, extra = {}) => ({ sender, senderScript: script,
  publicKey: script === TR ? XONLY : PUB, feeRate: 2, utxos: [coin(1, 100000, script)], chunks: [chunk(2, script)], ...extra });
function oraclePsbt(planned) {
  const oracle = new bitcoin.Psbt(); oracle.setVersion(2); oracle.setLocktime(0);
  for (const input of planned.inputs) oracle.addInput({ hash: input.txid, index: input.vout, sequence: input.sequence,
    witnessUtxo: { script: hexToBytes(input.scriptPubKeyHex), value: BigInt(input.value) },
    ...(input.scriptPubKeyHex === TR ? { tapInternalKey: hexToBytes(input.publicKey.length === 64 ? input.publicKey : input.publicKey.slice(2)) } : { sighashType: 1 }) });
  for (const output of planned.outputs) oracle.addOutput({ script: hexToBytes(output.scriptPubKeyHex), value: BigInt(output.value) });
  return oracle;
}
function oracleTx(tx) {
  const oracle = new bitcoin.Transaction(); oracle.version = tx.version ?? 2; oracle.locktime = tx.locktime ?? 0;
  for (const input of tx.inputs) oracle.addInput(hexToBytes(input.txid).reverse(), input.vout, input.sequence ?? 0xffffffff, hexToBytes(input.scriptSigHex ?? ''));
  for (const output of tx.outputs) oracle.addOutput(hexToBytes(output.scriptPubKeyHex), BigInt(output.value));
  for (let i = 0; i < tx.inputs.length; i++) if (tx.inputs[i].witness) oracle.setWitness(i, tx.inputs[i].witness.map(hexToBytes));
  return oracle;
}
const DER73 = '304602210080' + '11'.repeat(31) + '02210080' + '22'.repeat(31) + '01';
const DER9 = '300602010102010101';
function finalized(planned, { trAll = false, signature = DER73, change } = {}) {
  const parsed = parsePsbt(planned.psbtHex);
  parsed.inputs.forEach((map, i) => {
    // A real finalizer is allowed to remove the original sighash/tap metadata.
    map.delete('03'); map.delete('17');
    const witness = planned.inputs[i].scriptPubKeyHex === TR ? ['00'.repeat(64) + (trAll ? '01' : '')] : [signature, PUB];
    map.set('08', serializeWitness(witness));
  });
  change?.(parsed);
  return serializePsbt(parsed);
}

test('both native scripts match independent bitcoinjs PSBT bytes and pre-sign txid', async () => {
  for (const script of [TR, WPKH]) for (const key of script === TR ? [XONLY, PUB] : [PUB]) {
    const plan = await buildBatchPlan(request(script, { publicKey: key })); const tx = plan.transactions[0];
    const oracle = oraclePsbt(tx);
    assert.equal(tx.psbtHex, oracle.toHex());
    assert.equal(tx.unsignedTxHex, bytesToHex(oracle.data.globalMap.unsignedTx.toBuffer()));
    assert.equal(tx.txid, oracleTx(parseTransaction(tx.unsignedTxHex)).getId());
    assert.equal(plan.totals.inputValue, plan.totals.spent + plan.totals.change);
    assert(Object.isFrozen(tx.inputs)); assert.equal(tx.outputs[2].value, 0);
  }
});
test('generated oracle property covers outputs, compact lengths, amounts and multiple chain lengths', async () => {
  let state = 0x29481;
  const next = max => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % max; };
  for (let n = 0; n < 48; n++) {
    const script = n % 2 ? WPKH : TR, count = 1 + next(25), chain = 1 + next(6), feeRate = (1 + next(80)) / 4;
    const payloadBytes = [1, 31, 75, 76, 79, 80][n % 6];
    const plan = await buildBatchPlan(request(script, { feeRate, chunks: Array.from({ length: chain }, () => chunk(count, script, payloadBytes)), utxos: [coin(1, 1000000 + next(1000000), script)] }));
    for (const planned of plan.transactions) {
      assert.equal(planned.psbtHex, oraclePsbt(planned).toHex());
      assert.equal(serializePsbt(parsePsbt(planned.psbtHex)), planned.psbtHex);
      const signed = await verifySignedPsbt(finalized(planned, { trAll: n % 3 === 0 }), planned);
      const independent = bitcoin.Transaction.fromHex(signed.rawTxHex);
      assert.equal(signed.txid, independent.getId()); assert.equal(signed.vsize, independent.virtualSize());
      assert(signed.vsize <= planned.vsize); assert(signed.fee >= Math.ceil(signed.vsize * feeRate));
    }
  }
});
test('transaction codec oracle covers CompactSize 252/253 input and script boundaries', async () => {
  for (const count of [1, 8, 9, 252, 253]) for (const scriptLength of [0, 75, 76, 252, 253]) {
    const tx = { inputs: Array.from({ length: count }, (_, i) => coin(i + 1)), outputs: [{ value: 546, scriptPubKeyHex: '51'.repeat(scriptLength) }], version: 2, locktime: 0 };
    const bytes = serializeUnsignedTransaction(tx); const independent = oracleTx(tx);
    assert.equal(bytesToHex(bytes), independent.toHex());
    assert.equal(await transactionId(tx), independent.getId());
    assert.equal(bytesToHex(serializeUnsignedTransaction(parseTransaction(bytes))), independent.toHex());
  }
  for (const n of [0, 252, 253, 65535, 65536, 0xffffffff, 0x100000000]) assert(compactSize(n).length >= 1);
});
test('76–80-byte payloads use OP_PUSHDATA1 with independent script bytes', () => {
  for (const n of [1, 75, 76, 79, 80]) {
    const bytes = hexToBytes('41'.repeat(n));
    assert.equal(opReturnScript(bytesToHex(bytes)), bytesToHex(bitcoin.script.compile([bitcoin.opcodes.OP_RETURN, bytes])));
  }
  assert.throws(() => opReturnScript('41'.repeat(81)));
});
test('all chain children reference the precomputed previous change output; 24 includes root', async () => {
  const plan = await buildBatchPlan(request(TR, { chunks: Array.from({ length: 24 }, () => chunk(1)), utxos: [coin(1, 1000000)] }));
  assert.equal(plan.transactions.length, 24);
  for (let i = 1; i < 24; i++) {
    const prev = plan.transactions[i - 1], tx = plan.transactions[i];
    assert.equal(tx.inputs.length, 1); assert.equal(tx.inputs[0].txid, prev.txid);
    assert.equal(tx.inputs[0].vout, prev.changeOutputIndex); assert.equal(tx.inputs[0].value, prev.change);
  }
  await assert.rejects(buildBatchPlan(request(TR, { chunks: Array.from({ length: 25 }, () => chunk()) })), /1–24/);
});
test('funding aggregates more than eight safe coins and uses stable largest-first selection', async () => {
  const many = Array.from({ length: 30 }, (_, i) => coin(i + 1, 700, WPKH));
  const p = await buildBatchPlan(request(WPKH, { chunks: [chunk(20, WPKH)], utxos: many, feeRate: 1 }));
  assert(p.transactions[0].inputs.length > 8);
  const large = coin(9999, 1000000), small = Array.from({ length: 3000 }, (_, i) => coin(i + 1, 1));
  const q = await buildBatchPlan(request(TR, { utxos: [...small, large] }));
  assert.equal(q.transactions[0].inputs.length, 1); assert.equal(q.transactions[0].inputs[0].txid, large.txid);
});
test('dust change is omitted and exact input-output difference is the final fee', async () => {
  const base = await buildBatchPlan(request(TR)); const t = base.transactions[0];
  const noChange = t.outputs.slice(0, -1), minimum = Math.ceil(estimateVsize(t.inputs, noChange) * 2);
  const exact = await buildBatchPlan(request(TR, { utxos: [coin(1, 1092 + minimum)] }));
  assert.equal(exact.transactions[0].change, 0); assert.equal(exact.transactions[0].outputs.length, 3);
  assert.equal(exact.transactions[0].fee, minimum);
  const dust = await buildBatchPlan(request(TR, { utxos: [coin(1, 1092 + minimum + 545)] }));
  assert.equal(dust.transactions[0].change, 0); assert.equal(dust.transactions[0].fee, minimum + 545);
  await assert.rejects(buildBatchPlan(request(TR, { utxos: [coin(1, 1092 + minimum - 1)] })), /Insufficient/);
});
test('safe coin validation rejects duplicates, mixed scripts, protected metadata and malformed numbers', async () => {
  for (const utxos of [[coin(1), coin(1)], [coin(1, 10000, WPKH)], [{ ...coin(1), inscriptions: [{}] }], [{ ...coin(1), runes: ['x'] }], [{ ...coin(1), atomicals: [1] }], [{ ...coin(1), isLocked: true }], [{ ...coin(1), privateKey: 'not accepted' }]])
    await assert.rejects(buildBatchPlan(request(TR, { utxos })));
  for (const value of [-1, 0, 1.1, NaN, Infinity, '1000', MAX_MONEY + 1]) await assert.rejects(buildBatchPlan(request(TR, { utxos: [coin(1, value)] })));
  for (const vout of [-1, 1.5, 0x100000000]) await assert.rejects(buildBatchPlan(request(TR, { utxos: [{ ...coin(1), vout }] })));
  await assert.rejects(buildBatchPlan(request(TR, { utxos: [{ ...coin(1), txid: '00' }] })));
  for (const publicKey of ['', '04' + XONLY, XONLY.slice(2), 'zz'.repeat(32), PUB + '00']) await assert.rejects(buildBatchPlan(request(TR, { publicKey })));
  await assert.rejects(buildBatchPlan(request(WPKH, { publicKey: XONLY })));
  await assert.rejects(buildBatchPlan({ ...request(TR), privateKey: undefined }));
});
test('wallet native safe coin aliases are accepted, conflicting aliases are rejected', async () => {
  const { value, scriptPubKeyHex, ...rest } = coin(1);
  const plan = await buildBatchPlan(request(TR, { utxos: [{ ...rest, satoshis: value, scriptPk: scriptPubKeyHex }] }));
  assert.equal(plan.transactions[0].inputs[0].value, value);
  await assert.rejects(buildBatchPlan(request(TR, { utxos: [{ ...coin(1), satoshis: 5 }] })));
});
test('signed synthetic key-path/ALL witnesses extract byte-identically with bitcoinjs', async () => {
  for (const script of [TR, WPKH]) {
    const p = (await buildBatchPlan(request(script))).transactions[0];
    for (const trAll of [false, true]) {
      const encoded = finalized(p, { trAll }), verified = await verifySignedPsbt(encoded, p);
      assert.equal(verified.rawTxHex, bitcoin.Psbt.fromHex(encoded).extractTransaction(true).toHex());
      assert.equal(verified.signatureVerification, 'NOT_RUN');
      const maxSize = bitcoin.Transaction.fromHex(verified.rawTxHex).virtualSize();
      assert.equal(verified.vsize, maxSize); assert(maxSize <= p.vsize);
    }
  }
});
test('signed verification rejects changed unsigned bytes, prevout value/script and internal key', async () => {
  const p = (await buildBatchPlan(request(TR))).transactions[0];
  const tamper = change => finalized(p, { change });
  await assert.rejects(verifySignedPsbt(tamper(x => { x.transaction.outputs[0].value++; x.globals.set('00', serializeUnsignedTransaction(x.transaction)); }), p), /differs/);
  await assert.rejects(verifySignedPsbt(tamper(x => { const b = x.inputs[0].get('01').slice(); b[0]++; x.inputs[0].set('01', b); }), p), /prevout/);
  await assert.rejects(verifySignedPsbt(tamper(x => x.inputs[0].set('17', hexToBytes('11'.repeat(32)))), p), /internal key/);
  await assert.rejects(verifySignedPsbt(tamper(x => x.inputs[0].set('03', Uint8Array.of(3, 0, 0, 0))), p), /sighash/);
  await assert.rejects(verifySignedPsbt(tamper(x => x.inputs[0].delete('01')), p), /witnessUtxo/);
  await assert.rejects(verifySignedPsbt(p.psbtHex, p), /finalized/);
});
test('Taproot SINGLE/NONE/ANYONECANPAY, explicit DEFAULT byte, annex and script path are rejected', async () => {
  const p = (await buildBatchPlan(request(TR))).transactions[0];
  const attempts = [ ['00'.repeat(64) + '00'], ['00'.repeat(64) + '03'], ['00'.repeat(64) + '02'], ['00'.repeat(64) + '81'], ['00'.repeat(64), '50'], ['00'.repeat(64), '51', 'c0' + XONLY] ];
  for (const witness of attempts) await assert.rejects(verifySignedPsbt(finalized(p, { change: x => x.inputs[0].set('08', serializeWitness(witness)) }), p));
  await assert.rejects(verifySignedPsbt(finalized(p, { change: x => x.inputs[0].set('15' + '11'.repeat(33), Uint8Array.of(1)) }), p), /Script-path/);
});
test('P2WPKH only accepts strict DER+ALL and exact wallet public key', async () => {
  const p = (await buildBatchPlan(request(WPKH))).transactions[0];
  for (const signature of [DER73.slice(0, -2) + '03', DER73.slice(0, -2) + '81', '00'.repeat(73)]) {
    await assert.rejects(verifySignedPsbt(finalized(p, { signature }), p));
  }
  const valid = await verifySignedPsbt(finalized(p, { signature: DER9 }), p); assert(valid.rawTxHex);
  await assert.rejects(verifySignedPsbt(finalized(p, { change: x => x.inputs[0].set('08', serializeWitness([DER9, '03' + XONLY])) }), p), /public key/);
});
test('parser rejects duplicate PSBT keys, noncanonical CompactSize, v2, trailing bytes and oversized input', async () => {
  const p = (await buildBatchPlan(request(TR))).transactions[0], bytes = hexToBytes(p.psbtHex), unsigned = hexToBytes(p.unsignedTxHex);
  const entry = Uint8Array.from([1, 0, ...compactSize(unsigned.length), ...unsigned]);
  assert.throws(() => parsePsbt(bytesToHex(Uint8Array.from([...bytes.slice(0, 5), ...entry, ...bytes.slice(5)]))), /Duplicate/);
  assert.throws(() => parsePsbt(bytesToHex(Uint8Array.from([...bytes.slice(0, 5), 253, 1, 0, ...bytes.slice(6)]))), /Noncanonical/);
  const parsed = parsePsbt(p.psbtHex); parsed.globals.set('fb', Uint8Array.of(2, 0, 0, 0)); assert.throws(() => parsePsbt(serializePsbt(parsed)), /version 0/);
  assert.throws(() => parsePsbt(p.psbtHex + '00'), /Trailing/);
  assert.throws(() => parsePsbt('00'.repeat(MAX_PSBT_BYTES + 1)), /oversized/);
  for (let n = 0; n < bytes.length; n++) assert.throws(() => parsePsbt(bytesToHex(bytes.slice(0, n))));
  const badTx = Uint8Array.from([...unsigned.slice(0, 4), 253, 1, 0, ...unsigned.slice(5)]); assert.throws(() => parseTransaction(badTx), /Noncanonical/);
});
test('literal unsigned txid uses double SHA256 in display byte order, never witness txid', async () => {
  const p = (await buildBatchPlan(request(TR))).transactions[0];
  const h = createHash('sha256').update(createHash('sha256').update(hexToBytes(p.unsignedTxHex)).digest()).digest().reverse().toString('hex');
  assert.equal(p.txid, h); const verified = await verifySignedPsbt(finalized(p), p);
  assert.equal(bitcoin.Transaction.fromHex(verified.rawTxHex).getId(), p.txid);
  assert.notEqual(bytesToHex(bitcoin.Transaction.fromHex(verified.rawTxHex).getHash(true).reverse()), p.txid);
});

test('real batch.js chunks keep their SDK payload and allocation layout in every PSBT', async () => {
  const { parseBatchList, splitTransfers } = await import('./batch.js');
  const recipient = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
  const parsed = parseBatchList(Array.from({ length: 30 }, () => `${recipient} 1`).join('\n'), { mergeDuplicates: false });
  assert.equal(parsed.ok, true); assert.equal(parsed.recipients.length, 30);
  const chunks = splitTransfers({ recipients: parsed.recipients, sender, locator: { blockHeight: 973588, txIndex: 2537 }, wallet: 'unisat' });
  const plan = await buildBatchPlan(request(TR, { chunks }));
  assert.equal(plan.transactions.length, chunks.length);
  for (const tx of plan.transactions) {
    assert.equal(tx.chunk, chunks[plan.transactions.indexOf(tx)]);
    assert.equal(tx.outputs[tx.chunk.allocations.length].scriptPubKeyHex, opReturnScript(tx.chunk.payloadHex));
    assert.equal(tx.psbtHex, oraclePsbt(tx).toHex());
  }
});
test('REUSED historical 7defa37c…a296a structure: 189 vB DEFAULT; 190 vB ALL upper bound <5%', async () => {
  // Source: Fable crosscheck §7 at 778219829e04e995961ae3599248c8af59c31152.
  // Reuse is limited to 1 P2TR input, two P2TR outputs and the decoded payload.
  // These are new synthetic bytes, not the real transaction or a fresh broadcast.
  const { encodeTransfer, NetworkId } = await import('./aibrc-protocol.browser.js');
  const payloadHex = encodeTransfer({ network: NetworkId.MAINNET, authInputIndex: 0,
    assetLocator: { blockHeight: 973588, txIndex: 2537 }, allocations: [{ receiverOutputIndex: 0, amount: 1000000000n }] }).toString('hex');
  const c = chunk(1); c.allocations[0].scriptPubKeyHex = TR; c.payloadHex = payloadHex; c.payloadBytes = payloadHex.length / 2;
  const t = (await buildBatchPlan(request(TR, { chunks: [c], feeRate: 1 }))).transactions[0];
  assert.equal(t.vsize, 190); assert(Math.abs(t.vsize - 189) / 189 <= 0.05);
  const d = await verifySignedPsbt(finalized(t), t), all = await verifySignedPsbt(finalized(t, { trAll: true }), t);
  assert.equal(d.vsize, 189); assert.equal(all.vsize, 190);
});

// N6 regression: preserve total fee while changing where money goes. Removing
// BOTH unsigned-byte and txid guards must make this control fail.
test('equal-fee recipient substitution is rejected even when input-output totals still match', async () => {
  const p = (await buildBatchPlan(request(TR))).transactions[0];
  await verifySignedPsbt(finalized(p), p);
  for (const change of [
    x => { x.transaction.outputs[1].value--; x.transaction.outputs.at(-1).value++; },
    x => { x.transaction.outputs[1].scriptPubKeyHex = '0014' + '99'.repeat(20); },
  ]) {
    const changed = finalized(p, { change: x => { change(x); x.globals.set('00', serializeUnsignedTransaction(x.transaction)); } });
    await assert.rejects(verifySignedPsbt(changed, p), /differs from the plan/);
  }
});
