import { NetworkId, encodeTransfer } from '../packages/protocol/dist/index.js';

// Illustrative locator. Output 1 is the recipient in this example's layout.
const payload = encodeTransfer({
  network: NetworkId.SIGNET,
  authInputIndex: 0,
  assetLocator: { blockHeight: 840000, txIndex: 7 },
  allocations: [{ receiverOutputIndex: 1, amount: 10n * 100_000_000n }],
});

console.log(JSON.stringify({
  amountTokens: '10',
  amountBaseUnits: '1000000000',
  receiverOutputIndex: 1,
  payloadBytes: payload.length,
  payloadHex: payload.toString('hex'),
}, null, 2));
