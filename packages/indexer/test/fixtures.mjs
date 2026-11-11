// Synthetic Bitcoin wire fixtures. Placeholder witnesses, no proof of work,
// no spendable inputs. Never sign, broadcast or treat these as chain history.
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
const sdk = await import(process.env.INDEXER_TEST_SDK ?? '@aibrc/protocol');
const decoder = await import(process.env.INDEXER_TEST_DECODER ?? '@aibrc/protocol/decoder');
const { NetworkId, encodeDeploy, encodeTransfer, NAME_POLICY_V1_SCHEDULE, namePolicyContextForBlock, deriveAccountKey } = sdk;
const { decodeBitcoinTransaction, addWitnessToUnsignedTransaction } = decoder;
export const alice = '5120' + '11'.repeat(32);
export const bob = '5120' + '22'.repeat(32);
export const carol = '0014' + '33'.repeat(20);
export const aliceKey = deriveAccountKey(alice);
export const bobKey = deriveAccountKey(bob);
export const carolKey = deriveAccountKey(carol);
const sha = bytes => createHash('sha256').update(bytes).digest();
const sha2 = bytes => sha(sha(bytes));
const le32 = number => { const b = Buffer.alloc(4); b.writeUInt32LE(number); return b; };
const le64 = number => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(number)); return b; };
const size = number => {
  if (number < 253) return Buffer.from([number]);
  const b = Buffer.alloc(3); b[0] = 253; b.writeUInt16LE(number, 1); return b;
};
// Bitcoin Script serializer for these small fixtures, not a new SDK export.
const encodeOpReturnScript = payload => Buffer.concat([
  Buffer.from(payload.length <= 75 ? [0x6a, payload.length] : [0x6a, 0x4c, payload.length]), payload,
]);
function tx({ scripts, coinbaseHeight, nonce = 1 }) {
  const coinbase = coinbaseHeight !== undefined;
  const scriptSig = coinbase ? Buffer.from([1, coinbaseHeight]) : Buffer.alloc(0);
  const input = Buffer.concat([coinbase ? Buffer.alloc(32) : Buffer.alloc(32, nonce), le32(coinbase ? 0xffff_ffff : 0), size(scriptSig.length), scriptSig, le32(0xffff_fffd)]);
  const outputs = scripts.map(script => { const b = Buffer.from(script, 'hex'); return Buffer.concat([le64(script.startsWith('6a') ? 0 : 330), size(b.length), b]); });
  const unsigned = Buffer.concat([le32(2), size(1), input, size(outputs.length), ...outputs, le32(0)]).toString('hex');
  const raw = coinbase ? unsigned : addWitnessToUnsignedTransaction(unsigned, [['aa'.repeat(64)]]);
  return { raw, decoded: decodeBitcoinTransaction(raw) };
}
function block(height, parent, transactions, nonce = 1) {
  const all = [tx({ scripts: ['51'], coinbaseHeight: height }), ...transactions];
  let leaves = all.map(t => Buffer.from(t.decoded.txidDisplayBytes, 'hex').reverse());
  while (leaves.length > 1) {
    if (leaves.length % 2) leaves.push(leaves.at(-1));
    leaves = Array.from({ length: leaves.length / 2 }, (_, i) => sha2(Buffer.concat([leaves[2*i], leaves[2*i+1]])));
  }
  const header = Buffer.alloc(80);
  header.writeInt32LE(1); Buffer.from(parent, 'hex').reverse().copy(header, 4); leaves[0].copy(header, 36);
  header.writeUInt32LE(1_700_000_000 + height, 68); header.writeUInt32LE(0x207fffff, 72); header.writeUInt32LE(nonce, 76);
  const hash = Buffer.from(sha2(header)).reverse().toString('hex');
  const verbose = { hash, height, previousblockhash: parent, tx: all.map((t, i) => ({ txid: t.decoded.txidDisplayBytes,
    vin: t.decoded.inputs.map(v => i === 0 ? { coinbase: v.scriptSigHex } : { txid: v.txidDisplayBytes, vout: v.vout, prevout: { scriptPubKey: { hex: alice } } }) })) };
  return { height, hash, parent, all, verbose, raw: Buffer.concat([header, size(all.length), ...all.map(t => Buffer.from(t.raw, 'hex'))]).toString('hex') };
}
export function chainFixture(extraTransfers = 0) {
  const genesis = block(0, '00'.repeat(32), []);
  const deployPayload = encodeDeploy({ network: NetworkId.REGTEST, deployAuthInputIndex: 0, ownerOutputIndex: 1, name: 'DEMO', totalSupply: 1000n }, namePolicyContextForBlock(NAME_POLICY_V1_SCHEDULE, 1));
  const deploy = tx({ scripts: [encodeOpReturnScript(deployPayload).toString('hex'), alice] });
  const first = block(1, genesis.hash, [deploy]);
  const transfer = (a, b, nonce) => tx({ scripts: [bob, carol, encodeOpReturnScript(encodeTransfer({ network: NetworkId.REGTEST,
    authInputIndex: 0, assetLocator: { blockHeight: 1, txIndex: 1 }, allocations: [{ receiverOutputIndex: 0, amount: BigInt(a) }, { receiverOutputIndex: 1, amount: BigInt(b) }] })).toString('hex')], nonce });
  const sent = transfer(100, 200, 2), replacement = transfer(250, 50, 3);
  const extra = Array.from({ length: extraTransfers }, (_, index) => transfer(1, 1, index + 4));
  const second = block(2, first.hash, [sent]), third = block(3, second.hash, extra);
  const altSecond = block(2, first.hash, [replacement], 2), altThird = block(3, altSecond.hash, [], 2);
  return { genesis, first, second, third, altSecond, altThird,
    original: [genesis, first, second, third], alternative: [genesis, first, altSecond, altThird],
    transferTxid: sent.decoded.txidDisplayBytes, replacementTxid: replacement.decoded.txidDisplayBytes,
    extraTransferTxids: extra.map(item => item.decoded.txidDisplayBytes) };
}

export async function serveFixture(chain, options = {}) {
  const calls = [];
  const state = { chain, network: 'regtest', failure: null, mutateVerbose: null, ...options };
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const b of request) chunks.push(b);
    const { method, params, id } = JSON.parse(Buffer.concat(chunks));
    calls.push({ method, params });
    const tip = state.chain.at(-1);
    try {
      await state.beforeResponse?.(method, params);
      if (state.failure) { response.writeHead(503); response.end('node unavailable'); return; }
      let result;
      if (method === 'getblockchaininfo') result = { chain: state.network, blocks: tip.height, headers: tip.height, bestblockhash: tip.hash, initialblockdownload: false };
      else if (method === 'getbestblockhash') result = tip.hash;
      else if (method === 'getblockcount') result = tip.height;
      else if (method === 'getblockhash') {
        const b = state.chain.find(b => b.height === params[0]);
        if (!b) throw { code: -8, message: 'Block height out of range' }; result = b.hash;
      } else if (method === 'getblockheader') {
        const b = state.chain.find(b => b.hash === params[0]);
        if (!b) throw { code: -5, message: 'Block not found' };
        result = { hash: b.hash, height: b.height, previousblockhash: b.parent, confirmations: tip.height - b.height + 1 };
      } else if (method === 'getblock') {
        const b = state.chain.find(b => b.hash === params[0]);
        if (!b) throw { code: -5, message: 'Block not found' };
        result = params[1] === 0 ? b.raw : structuredClone(b.verbose);
        if (params[1] === 3) state.mutateVerbose?.(result);
      } else throw { code: -32601, message: 'Read-only fixture method not available' };
      response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ result, error: null, id }));
    } catch (error) { response.writeHead(500); response.end(JSON.stringify({ result: null, error: { code: error.code ?? -32603, message: error.message }, id })); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, state, calls,
    close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }) };
}
