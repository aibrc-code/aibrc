import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTokenAmount, formatTokens, decodeAddress, parseLocator, transactionIndex,
  encodeIntent, walletSendRequest, walletTxid, verifyBroadcast, parsePrefill } from './sign.js';

const sender = 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0';
const recipient = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const txid = '12'.repeat(32), locator = { blockHeight: 961555, txIndex: 3 };
const intent = (wallet = 'okx') => encodeIntent({wallet,sender,recipient,amountText:'1000',locator});
const script = hex => `6a${(hex.length / 2).toString(16).padStart(2,'0')}${hex}`;
function receipt(i = intent()) {
  return {txid,vin:[{prevout:{scriptpubkey:i.senderScript}}],vout:[
    {scriptpubkey:i.recipientScript,value:546},{scriptpubkey:script(i.payloadHex),value:0},
    {scriptpubkey:i.senderScript,value:9000}]};
}

for (const [text, atomic] of [['1000',100000000000n],['0.00000001',1n],['1.12345678',112345678n],['0001.5',150000000n]])
  test(`exact token amount ${text}`,()=>assert.equal(parseTokenAmount(text),atomic));
for (const text of ['1.123456789','1e3','-1','0','0.00000000',' 1','1 ','.1','1.','NaN','Infinity'])
  test(`reject invalid token amount ${JSON.stringify(text)}`,()=>assert.throws(()=>parseTokenAmount(text)));
test('u128 maximum round-trips as decimal tokens; one extra base unit is rejected',()=>{
  const max=(1n<<128n)-1n; assert.equal(parseTokenAmount(formatTokens(max)),max);
  assert.throws(()=>parseTokenAmount(formatTokens(max+1n)));
});

test('BIP173 mainnet P2WPKH matches the independent standard script',()=>assert.equal(decodeAddress(recipient).scriptPubKey,'0014751e76e8199196d454941c45d1b3a323f1433bd6'));
test('BIP350 P2TR program and uppercase normalize correctly',()=>{
  assert.equal(decodeAddress(sender).scriptPubKey,'512079be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798');
  assert.deepEqual(decodeAddress(sender.toUpperCase()),decodeAddress(sender));
});
for (const address of [
  'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3',
  '1BoatSLRHtKNngkdXEeobR76b53LETtpyT','3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
  'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',recipient.slice(0,-1)+'q',
  'bC'+recipient.slice(2),sender+'q',
]) test(`reject unsupported or invalid address ${address.slice(0,15)}`,()=>assert.throws(()=>decodeAddress(address)));

test('locator bounds are the existing u32/u16 protocol bounds',()=>{
  assert.deepEqual(parseLocator('961555:3'),locator); assert.deepEqual(parseLocator('4294967295:65535'),{blockHeight:4294967295,txIndex:65535});
  for (const v of ['4294967296:0','1:65536','1:-1','1.1:0','1e3:2']) assert.throws(()=>parseLocator(v));
});
test('transaction index uses the original list including coinbase at zero',()=>{
  const ids=['11'.repeat(32),txid,'33'.repeat(32)]; assert.equal(transactionIndex(ids,ids[0]),0);assert.equal(transactionIndex(ids,txid),1);
  assert.throws(()=>transactionIndex([...ids,txid],txid));assert.throws(()=>transactionIndex(ids,'44'.repeat(32)));
});
test('encoded single allocation has exact base units and immutable intent',()=>{
  const i=intent();assert.equal(i.amount,'100000000000');assert.equal(i.receiverOutputIndex,0);assert(Object.isFrozen(i));assert(Object.isFrozen(i.locator));
});
test('OKX amount is 0.00000546 BTC, never 546 BTC; correct memoPos and return shape',()=>{
  const i=intent(),r=walletSendRequest(i);assert.deepEqual(r,{method:'send',args:[{from:sender,to:recipient,value:'0.00000546',memo:i.payloadHex,memoPos:1}]});
  assert.equal(walletTxid('okx',{txhash:txid}),txid);assert.throws(()=>walletTxid('okx',txid));
});
test('UniSat receives integer satoshis and a single HEX memo',()=>{
  const i=intent('unisat');assert.deepEqual(walletSendRequest(i),{method:'sendBitcoin',args:[recipient,546,{memo:i.payloadHex}]});
  assert.equal(walletTxid('unisat',txid.toUpperCase()),txid);
});
test('broadcast structure positive control calls actual parser',()=>assert.deepEqual(verifyBroadcast(receipt(),intent(),txid),{ok:true,errors:[]}));
test('changed AIBRC payload is rejected',()=>{
  const r=receipt(),other=encodeIntent({wallet:'okx',sender,recipient,amountText:'1001',locator});r.vout[1].scriptpubkey=script(other.payloadHex);
  assert(verifyBroadcast(r,intent(),txid).errors.includes('AIBRC payload mismatch.'));
});
test('changed recipient is rejected, without claiming no asset left the sender',()=>{
  const r=receipt();r.vout[0].scriptpubkey=decodeAddress(sender).scriptPubKey;
  assert(verifyBroadcast(r,intent(),txid).errors.includes('Recipient script mismatch.'));
});
test('input zero must be the intended sender, not just any input in the transaction',()=>{
  const r=receipt();r.vin.unshift({prevout:{scriptpubkey:decodeAddress(recipient).scriptPubKey}});
  assert(verifyBroadcast(r,intent(),txid).errors.includes('Authorization input script mismatch.'));
});
test('multiple OP_RETURNs, wrong txid, missing prevout and wrong BTC amount do not verify',()=>{
  const a=receipt();a.vout.push({scriptpubkey:'6a00',value:0});assert.equal(verifyBroadcast(a,intent(),txid).ok,false);
  assert.equal(verifyBroadcast(receipt(),intent(),'34'.repeat(32)).ok,false);
  const b=receipt();delete b.vin[0].prevout;assert.equal(verifyBroadcast(b,intent(),txid).ok,false);
  const c=receipt();c.vout[0].value=545;assert.equal(verifyBroadcast(c,intent(),txid).ok,false);
});
test('link is data only, v1 and no duplicate or unknown parameters',()=>{
  assert.deepEqual(parsePrefill('?v=1&asset='+txid+'&amount=1000&to='+recipient),{asset:txid,amount:'1000',to:recipient});
  assert.deepEqual(parsePrefill(''),{});
  for(const v of ['?v=2','?v=1&amount=1&amount=2','?v=1&script=https://example.com/a.js'])assert.throws(()=>parsePrefill(v));
});
test('static page version matches package and has no external runtime script/link',()=>{
  const html=readFileSync(new URL('index.html',import.meta.url),'utf8');
  const pkg=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8'));
  assert(html.includes(`Protocol ${pkg.version} ·`));assert(!/<(?:script|link)\b[^>]*(?:src|href)=["']https?:/i.test(html));
  assert(!readFileSync(new URL('sign.js',import.meta.url),'utf8').includes('innerHTML'));
});
