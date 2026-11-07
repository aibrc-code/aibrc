import {
  NetworkId, MAX_ALLOCATIONS, encodeTransfer, classifyPayloadProfile,
} from '../packages/protocol/dist/index.js';

const count = Number(process.argv[2] ?? MAX_ALLOCATIONS);
if (!Number.isInteger(count) || count < 1 || count > MAX_ALLOCATIONS) {
  throw new RangeError(`Choose a recipient count from 1 to ${MAX_ALLOCATIONS}.`);
}

// Example layout: OP_RETURN at output 0; recipients at outputs 1 through count.
// A real wallet transaction must actually contain those receiver outputs.
const payload = encodeTransfer({
  network: NetworkId.SIGNET,
  authInputIndex: 0,
  assetLocator: { blockHeight: 840000, txIndex: 7 },
  allocations: Array.from({ length: count }, (_, i) => ({
    receiverOutputIndex: i + 1,
    amount: 10n * 100_000_000n,
  })),
});

console.log(JSON.stringify({
  recipients: count,
  tokensPerRecipient: '10',
  totalBaseUnits: (BigInt(count) * 10n * 100_000_000n).toString(),
  payloadBytes: payload.length,
  profile: classifyPayloadProfile(payload),
  payloadHex: payload.toString('hex'),
}, null, 2));
