import {
  NetworkId, MAX_U128, MAX_ALLOCATIONS, COMPAT_PAYLOAD_BYTES,
  encodeTransfer, decodeTransfer, extractAibrcPayloadFromScript,
} from './aibrc-protocol.browser.js';
import { parseTokenAmount, formatTokens, decodeAddress, BTC_TO_RECIPIENT_SATS } from './sign.js';

const HEX64 = /^[0-9a-f]{64}$/i;

function freezeRecipient(row) {
  return Object.freeze({
    address: row.address,
    scriptPubKeyHex: row.scriptPubKeyHex,
    amount: row.amount.toString(),
    tokens: formatTokens(row.amount),
    lineNumbers: Object.freeze([...row.lineNumbers]),
  });
}

/** Rows with errors remain visible in errors; plan a payment only when ok is true. */
export function parseBatchList(text, { mergeDuplicates = true } = {}) {
  if (typeof text !== 'string') throw new TypeError('The recipient list must be text.');
  if (typeof mergeDuplicates !== 'boolean') throw new TypeError('mergeDuplicates must be a boolean.');
  const rows = [], errors = [], seen = new Map();
  let validLineCount = 0, duplicateLineCount = 0;
  for (const [index, input] of text.split(/\r\n|\n|\r/).entries()) {
    const line = input.trim(), lineNumber = index + 1;
    if (!line || line.startsWith('#')) continue;
    try {
      const fields = line.split(/[ ,\t]+/);
      if (fields.length !== 2) throw new Error('Use one address and one token amount on this line.');
      const decoded = decodeAddress(fields[0]);
      const amount = parseTokenAmount(fields[1]);
      const prior = seen.get(decoded.scriptPubKey);
      if (mergeDuplicates && prior !== undefined) {
        const sum = rows[prior].amount + amount;
        if (sum > MAX_U128) throw new Error('The merged amount exceeds the protocol range.');
        rows[prior].amount = sum;
        rows[prior].lineNumbers.push(lineNumber);
      } else {
        rows.push({ address: decoded.address, scriptPubKeyHex: decoded.scriptPubKey, amount, lineNumbers: [lineNumber] });
      }
      if (prior !== undefined) duplicateLineCount++;
      else seen.set(decoded.scriptPubKey, rows.length - 1);
      validLineCount++;
    } catch (error) {
      errors.push(Object.freeze({ lineNumber, input, message: error.message }));
    }
  }
  const recipients = Object.freeze(rows.map(freezeRecipient));
  const total = rows.reduce((sum, row) => sum + row.amount, 0n);
  return Object.freeze({
    recipients, errors: Object.freeze(errors), validLineCount,
    recipientCount: recipients.length, duplicateLineCount,
    totalAmount: total.toString(), totalTokens: formatTokens(total),
    dustSats: recipients.length * BTC_TO_RECIPIENT_SATS,
    ok: errors.length === 0 && recipients.length > 0,
  });
}

function normalizeRecipient(row, index) {
  if (!row || typeof row !== 'object') throw new Error(`Invalid recipient ${index + 1}.`);
  const decoded = decodeAddress(row.address);
  if (row.scriptPubKeyHex !== undefined &&
      (typeof row.scriptPubKeyHex !== 'string' || row.scriptPubKeyHex.toLowerCase() !== decoded.scriptPubKey)) {
    throw new Error(`Recipient ${index + 1} script does not match its address.`);
  }
  if (typeof row.amount !== 'string' || !/^[1-9][0-9]*$/.test(row.amount)) {
    throw new Error(`Recipient ${index + 1} needs a positive base-unit amount string.`);
  }
  const amount = BigInt(row.amount);
  if (amount > MAX_U128) throw new Error(`Recipient ${index + 1} amount exceeds the protocol range.`);
  const lineNumbers = row.lineNumbers === undefined ? [index + 1] : row.lineNumbers;
  if (!Array.isArray(lineNumbers) || lineNumbers.length === 0 ||
      lineNumbers.some((line) => !Number.isSafeInteger(line) || line < 1)) {
    throw new Error(`Recipient ${index + 1} has invalid source line numbers.`);
  }
  return freezeRecipient({ address: decoded.address, scriptPubKeyHex: decoded.scriptPubKey, amount, lineNumbers });
}

function encodeChunk(rows, from, locator, wallet) {
  const allocations = Object.freeze(rows.map((row, receiverOutputIndex) => Object.freeze({ ...row, receiverOutputIndex })));
  const payload = encodeTransfer({
    network: NetworkId.MAINNET, authInputIndex: 0, assetLocator: locator,
    allocations: allocations.map(({ receiverOutputIndex, amount }) => ({ receiverOutputIndex, amount: BigInt(amount) })),
  });
  const decoded = decodeTransfer(payload);
  if (decoded.network !== NetworkId.MAINNET || decoded.authInputIndex !== 0 ||
      decoded.assetLocator.blockHeight !== locator.blockHeight || decoded.assetLocator.txIndex !== locator.txIndex ||
      decoded.allocations.length !== allocations.length || decoded.allocations.some((row, index) =>
        row.receiverOutputIndex !== index || row.amount !== BigInt(allocations[index].amount))) {
    throw new Error('Batch Transfer payload did not round-trip.');
  }
  return Object.freeze({
    wallet, sender: from.address, senderScript: from.scriptPubKey,
    locator: Object.freeze({ blockHeight: locator.blockHeight, txIndex: locator.txIndex }),
    authInputIndex: 0, payloadHex: payload.toString('hex'), payloadBytes: payload.length,
    allocations, dustSats: allocations.length * BTC_TO_RECIPIENT_SATS,
  });
}

/** Greedy, in-order chunks; each candidate is measured using the real encoder. */
export function splitTransfers({ recipients, sender, locator, wallet = 'unisat' }) {
  if (!Array.isArray(recipients) || recipients.length === 0) throw new Error('Add at least one valid recipient.');
  if (!['unisat', 'okx'].includes(wallet)) throw new Error('Select UniSat or OKX Wallet.');
  const from = decodeAddress(sender);
  const normalized = recipients.map(normalizeRecipient), chunks = [];
  let current = null, rows = [];
  for (const row of normalized) {
    if (rows.length === MAX_ALLOCATIONS) {
      chunks.push(current); current = null; rows = [];
    }
    const candidate = encodeChunk([...rows, row], from, locator, wallet);
    if (candidate.payloadBytes <= COMPAT_PAYLOAD_BYTES) {
      rows.push(row); current = candidate;
    } else {
      if (!current) throw new Error('One allocation exceeds the compatibility payload limit.');
      chunks.push(current);
      rows = [row]; current = encodeChunk(rows, from, locator, wallet);
      if (current.payloadBytes > COMPAT_PAYLOAD_BYTES) throw new Error('One allocation exceeds the compatibility payload limit.');
    }
  }
  if (current) chunks.push(current);
  return Object.freeze(chunks);
}

/** Structural readback only; this does not establish an applied asset transfer. */
export function verifyBatchBroadcast(tx, chunk, txid) {
  const errors = [];
  if (!HEX64.test(typeof txid === 'string' ? txid : '') ||
      typeof tx?.txid !== 'string' || tx.txid.toLowerCase() !== txid.toLowerCase()) {
    errors.push('Transaction ID mismatch.');
  }
  if (!chunk || typeof chunk.payloadHex !== 'string' || !Array.isArray(chunk.allocations) ||
      chunk.allocations.length < 1 || chunk.allocations.length > MAX_ALLOCATIONS || typeof chunk.senderScript !== 'string') {
    return { ok: false, errors: [...errors, 'Invalid batch intent.'] };
  }
  const outputs = Array.isArray(tx?.vout) ? tx.vout : [];
  const markers = outputs.filter((row) => typeof row?.scriptpubkey === 'string' && /^6a/i.test(row.scriptpubkey));
  if (markers.length !== 1) errors.push('Expected exactly one OP_RETURN output.');
  else {
    const extracted = extractAibrcPayloadFromScript(markers[0].scriptpubkey);
    if (extracted.status !== 'VALID_AIBRC_PAYLOAD' || extracted.payload.toString('hex') !== chunk.payloadHex) {
      errors.push('AIBRC payload mismatch.');
    } else {
      try {
        const decoded = decodeTransfer(extracted.payload);
        if (extracted.payload.length > COMPAT_PAYLOAD_BYTES || decoded.network !== NetworkId.MAINNET ||
            decoded.authInputIndex !== 0 || decoded.assetLocator.blockHeight !== chunk.locator?.blockHeight ||
            decoded.assetLocator.txIndex !== chunk.locator?.txIndex || decoded.allocations.length !== chunk.allocations.length ||
            decoded.allocations.some((row, index) => row.receiverOutputIndex !== index ||
              row.receiverOutputIndex !== chunk.allocations[index].receiverOutputIndex ||
              row.amount !== BigInt(chunk.allocations[index].amount))) {
          errors.push('AIBRC batch allocations mismatch.');
        }
      } catch { errors.push('AIBRC Transfer could not be decoded.'); }
    }
  }
  for (const [index, allocation] of chunk.allocations.entries()) {
    const receiver = outputs[allocation.receiverOutputIndex];
    if (allocation.receiverOutputIndex !== index || typeof allocation.scriptPubKeyHex !== 'string' ||
        typeof receiver?.scriptpubkey !== 'string' || receiver.scriptpubkey.toLowerCase() !== allocation.scriptPubKeyHex) {
      errors.push(`Recipient ${index + 1} script mismatch.`);
    }
    if (receiver?.value !== BTC_TO_RECIPIENT_SATS) errors.push(`Recipient ${index + 1} BTC amount mismatch.`);
  }
  if (typeof tx?.vin?.[0]?.prevout?.scriptpubkey !== 'string' ||
      tx.vin[0].prevout.scriptpubkey.toLowerCase() !== chunk.senderScript) {
    errors.push('Authorization input script mismatch.');
  }
  return { ok: errors.length === 0, errors };
}

/** Exact source lines, including non-adjacent rows merged to one recipient. */
export function formatSourceLines(chunk) {
  const lines = [...new Set(chunk.allocations.flatMap(row => row.lineNumbers))].sort((a, b) => a - b);
  const ranges = [];
  for (let i = 0; i < lines.length; i++) {
    const start = lines[i]; let end = start;
    while (i + 1 < lines.length && lines[i + 1] === end + 1) end = lines[++i];
    ranges.push(start === end ? String(start) : `${start}–${end}`);
  }
  return ranges.join(', ');
}
