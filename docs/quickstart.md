# Build with the AIBRC SDK

Encode an issuance, send an asset to one or several recipients, read an instruction, and reproduce a state hash. These examples call the existing SDK directly.

## Run from the repository

Use the Node version declared in the [package](../packages/protocol/package.json). From the repository root:

```sh
npm ci --ignore-scripts
npm run build
```

Then choose an example:

| Task | Command |
| --- | --- |
| Deploy a fixed-supply asset | `node examples/deploy.mjs` |
| Transfer to one recipient | `node examples/transfer-single.mjs` |
| Transfer to 1–25 recipients | `node examples/transfer-batch.mjs 25` |
| Decode Deploy or Transfer | `node examples/decode.mjs` |
| Reproduce a state hash | `node examples/state-hash.mjs` |

Each file runs independently and prints JSON. They use offline Signet examples and published test vectors, with no wallet, network requests, signing or broadcasting. Their heights are test data, not Mainnet release settings. Real Mainnet integrations pin the [published release context](../README.md#activation-context), actual transaction outputs, authorization and pre-state.

Amounts use integer base units. With AIBRC's fixed display precision of 8, `100_000_000n` means one token and `10n * 100_000_000n` means ten. The examples preserve those amounts with `bigint`.

```text
Choose asset parameters and receiver outputs
  → Encode the AIBRC instruction
  → Put it in one OP_RETURN in the Bitcoin transaction
  → Review, sign and broadcast with the wallet
  → Bitcoin confirmation and AIBRC rule validation
```

The runnable files below cover the encoding and inspection steps. Receiver indexes refer to actual Bitcoin outputs; encoding a payload does not create those outputs.

## Deploy a fixed-supply asset

This creates a DEMO issuance instruction for 1,000,000 tokens. Authorization is input 0; the initial owner is output 1. It prints the payload hex and byte length. The Bitcoin transaction must supply those actual input and output positions.

```sh
node examples/deploy.mjs
```

[Runnable source](../examples/deploy.mjs)

<!-- example: deploy.mjs -->
```js
import {
  NetworkId, NAME_POLICY_V1_SCHEDULE, namePolicyContextForBlock,
  encodeDeploy,
} from '../packages/protocol/dist/index.js';

// Offline Signet example. These heights do not select a Mainnet release.
const namePolicy = namePolicyContextForBlock(NAME_POLICY_V1_SCHEDULE, 840000);
const payload = encodeDeploy({
  network: NetworkId.SIGNET,
  deployAuthInputIndex: 0,
  ownerOutputIndex: 1,
  name: 'DEMO',
  totalSupply: 1_000_000n * 100_000_000n,
}, namePolicy);

console.log(JSON.stringify({
  name: 'DEMO',
  supplyTokens: '1000000',
  supplyBaseUnits: '100000000000000',
  payloadBytes: payload.length,
  payloadHex: payload.toString('hex'),
}, null, 2));
```

## Transfer to one recipient

This assigns 10 tokens to output 1. The locator 840000:7 is illustrative: use the real deployment block height and original transaction index when building a transaction.

```sh
node examples/transfer-single.mjs
```

[Runnable source](../examples/transfer-single.mjs)

<!-- example: transfer-single.mjs -->
```js
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
```

## Batch transfer: 1–25 recipients

Change 25 to any integer from 1 to 25. This distributes the same asset to that many receiver outputs, 10 tokens each. Omitting the argument selects 25. It is one instruction in one Bitcoin transaction, with all allocations applied together or none applied.

The illustrated layout places OP_RETURN at output 0 and recipients at outputs 1 through the selected count. Match the instruction to the actual outputs your wallet will sign. The 25-recipient example is 168 bytes and reports EXTENDED; its relay must accept that payload profile. Count and byte size are separate limits: the complete payload must also fit 480 bytes. See [broadcast profiles](03-instructions.md#payload-limits-and-broadcast-profiles).

```sh
node examples/transfer-batch.mjs 25
```

[Runnable source](../examples/transfer-batch.mjs)

<!-- example: transfer-batch.mjs -->
```js
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
```

## Decode an instruction

With no argument, this decodes the published six-recipient Signet vector. Amounts 10, 20, 30, 40, 50 and 60 in its output are base units. You can pass a complete Signet Deploy or Transfer payload hex as the first argument.

For example: `node examples/decode.mjs <payload-hex>`. The decoder reads fields under its explicit network and naming context; applying an asset operation also requires the real Bitcoin transaction context and pre-state.

```sh
node examples/decode.mjs
```

[Runnable source](../examples/decode.mjs)

<!-- example: decode.mjs -->
```js
import {
  Buffer, NetworkId, NAME_POLICY_V1_SCHEDULE, namePolicyContextForBlock,
  classifyProtocolPayload,
} from '../packages/protocol/dist/index.js';

// Published six-recipient Signet vector. Pass another payload hex as argument 1.
const hex = process.argv[2] ??
  '414942520102020015000006000cd1400007010a0214031e04280532063c';
if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
  throw new TypeError('Pass a complete hexadecimal AIBRC payload.');
}

const result = classifyProtocolPayload(Buffer.from(hex, 'hex'), {
  expectedNetwork: NetworkId.SIGNET,
  namePolicy: namePolicyContextForBlock(NAME_POLICY_V1_SCHEDULE, 840000),
});
if (result.status !== 'VALID') throw new Error(result.reason);

// JSON cannot represent bigint directly; preserve amounts as decimal strings.
console.log(JSON.stringify(result.instruction,
  (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
```

## Compute a canonical state hash

This loads the non-empty final state of the published chain-shallow-reorg test vector, restores its maps and integer values, then computes its canonical state hash. It checks the result against the existing vector. It does not replay the chain or verify Bitcoin inclusion.

The expected hash is `84a0e47330abb49028c8d0ace5a9f304d483efd25a5000864e13ac1f7e780c87`. The state contains two assets and two balance entries. A matching hash identifies the same canonical state bytes; its network, rules and verified block context still belong with that state.

```sh
node examples/state-hash.mjs
```

[Runnable source](../examples/state-hash.mjs)

<!-- example: state-hash.mjs -->
```js
import { readFileSync } from 'node:fs';
import {
  createProtocolState, serializeCanonicalState, deriveStateHash,
} from '../packages/protocol/dist/index.js';

// Load a non-empty canonical state from the published offline chain vectors.
const { vectors } = JSON.parse(readFileSync(
  new URL('../vectors/chain-vectors.json', import.meta.url), 'utf8'));
const vector = vectors.find(item => item.id === 'chain-shallow-reorg');
const snapshot = vector.expected.canonicalFinalState;
const state = createProtocolState();

for (const asset of snapshot.assets) {
  state.assetsById.set(asset.assetId, {
    ...asset,
    totalSupply: BigInt(asset.totalSupply),
    locator: { blockHeight: asset.locator[0], txIndex: asset.locator[1] },
  });
}
state.assetIdByName = new Map(snapshot.names);
state.assetIdByLocator = new Map(snapshot.locators);
state.balances = new Map(snapshot.balances.map(([key, amount]) => [key, BigInt(amount)]));

const stateHash = deriveStateHash(state);
if (stateHash !== vector.expected.stateHash) throw new Error('State hash mismatch.');
console.log(JSON.stringify({
  vector: vector.id,
  assets: state.assetsById.size,
  balanceEntries: state.balances.size,
  canonicalBytes: serializeCanonicalState(state).length,
  stateHash,
  matchesPublishedVector: true,
}, null, 2));
```

## Check all examples

```sh
npm run examples:check
```

The checks execute the files themselves, cover every batch count from 1 through 25, reject out-of-range counts, decode both instruction types, and compare the state hash to a published vector and standard SHA-256.

For exact fields and validity rules, read [instructions](03-instructions.md) and the [wire specification](../spec/AIBRC_PROTOCOL_V0.25.md). For canonical state construction, read the [indexer guide](06-indexer-guide.md).
