# Build with the AIBRC SDK

Deploy an asset, transfer it to one or several recipients, read an instruction, and compare a state hash. The core calls below use the existing SDK.

These are the same building blocks an Agent can use to prepare a community distribution, explain an asset
operation or check its local ledger. The user reviews the transaction through a wallet; the shared SDK
keeps the instruction fields explicit for both the person and the tool.

These are **short SDK excerpts**. Imports and common values are defined once in the [shared setup](#shared-setup). Each section links to a complete, independently runnable file. Encoding creates instruction bytes; the wallet constructs, signs and broadcasts the Bitcoin transaction containing them.

## Deploy a fixed-supply asset

Give DEMO a fixed supply of 1,000,000 tokens. Input 0 authorizes issuance; output 1 identifies the initial owner.

<!-- snippet: deploy -->
```js
const payload = encodeDeploy({
  network, name: 'DEMO',
  totalSupply: 1_000_000n * UNIT,
  deployAuthInputIndex: 0, ownerOutputIndex: 1,
}, namePolicy);
```

[Complete runnable file](../examples/deploy.mjs) · Run `node examples/deploy.mjs` after the build below.

## Transfer to one recipient

Send 10 tokens of the selected asset to the account identified by output 1.

<!-- snippet: transfer-single -->
```js
const payload = encodeTransfer({
  network, authInputIndex: 0,
  assetLocator,
  allocations: [{ receiverOutputIndex: 1, amount: 10n * UNIT }],
});
```

[Complete runnable file](../examples/transfer-single.mjs) · Run `node examples/transfer-single.mjs`.

## Batch transfer: 1–25 recipients

Set an amount for each receiver output. Here, outputs 1, 2 and 3 receive 10, 20 and 30 tokens of the same asset.

<!-- snippet: transfer-batch -->
```js
const payload = encodeTransfer({
  network, authInputIndex: 0,
  assetLocator,
  allocations: [
    { receiverOutputIndex: 1, amount: 10n * UNIT },
    { receiverOutputIndex: 2, amount: 20n * UNIT },
    { receiverOutputIndex: 3, amount: 30n * UNIT },
  ],
});
```

A Transfer supports 1–25 allocation entries. All must pass validation before any asset balance is changed. Output indexes refer to actual Bitcoin outputs; encoding this list does not create them.

[Complete runnable file](../examples/transfer-batch.mjs) · Run `node examples/transfer-batch.mjs 25`. The CLI example accepts every count from 1 through 25 and assigns 10 tokens to each recipient. Omitting the count selects 25.

That 25-recipient sample is 168 bytes and uses the Extended Profile. The complete payload must fit 480 bytes, and the chosen relay must accept its profile. See [payload and broadcast limits](03-instructions.md#payload-limits-and-broadcast-profiles).

## Decode an instruction

Read `payload`, the Buffer returned by a Deploy or Transfer encoder. The classifier checks its network and format under the supplied context, then returns an instruction or a reason code.

<!-- snippet: decode -->
```js
const result = classifyProtocolPayload(payload, {
  expectedNetwork: network,
  namePolicy,
});
```

[Complete runnable file](../examples/decode.mjs) · Run `node examples/decode.mjs`, or pass a complete Signet payload hex as the first argument. With no argument, it decodes the published six-recipient vector. Parsing fields does not apply an asset operation.

## Compute a canonical state hash

Compute the fingerprint of an existing `ProtocolState`. The input `state` must contain the asset, name, locator and balance maps with integer amounts.

<!-- snippet: state-hash -->
```js
const stateHash = deriveStateHash(state);
```

[Complete runnable file](../examples/state-hash.mjs) · Run `node examples/state-hash.mjs`. It restores the non-empty final state of a published offline vector, then compares the calculated hash to the vector. It does not replay a chain or establish Bitcoin inclusion.

The sample has two assets and two balance entries. Its expected hash is `84a0e47330abb49028c8d0ace5a9f304d483efd25a5000864e13ac1f7e780c87`.

## Shared setup

For the excerpts above, initialize these imports and values once. This is an **offline Signet context** with an illustrative asset locator, not a Mainnet release or a live asset deployment.

<!-- snippet: shared-setup -->
```js
import {
  NetworkId, NAME_POLICY_V1_SCHEDULE, namePolicyContextForBlock,
  encodeDeploy, encodeTransfer, classifyProtocolPayload, deriveStateHash,
} from '@aibrc/protocol';

const network = NetworkId.SIGNET;
const UNIT = 100_000_000n; // One token in integer base units.
const namePolicy = namePolicyContextForBlock(NAME_POLICY_V1_SCHEDULE, 840000);
const assetLocator = { blockHeight: 840000, txIndex: 7 };
```

`UNIT` is the integer display conversion: AIBRC has a fixed precision of 8, so `10n * UNIT` means 10 tokens. Real Mainnet integrations use the [published release context](../README.md#activation-context), the actual asset locator and the actual transaction input/output positions. The hashing excerpt additionally takes a verified `state` from the caller; its full runnable file supplies a published test state.

## Run from the repository

Use the Node version declared in the [package](../packages/protocol/package.json). From the repository root, build once:

```sh
npm ci --ignore-scripts
npm run build
```

| Task | Command |
| --- | --- |
| Deploy a fixed-supply asset | `node examples/deploy.mjs` |
| Transfer to one recipient | `node examples/transfer-single.mjs` |
| Transfer to 1–25 recipients | `node examples/transfer-batch.mjs 25` |
| Decode Deploy or Transfer | `node examples/decode.mjs` |
| Reproduce a state hash | `node examples/state-hash.mjs` |

Each file runs independently and prints JSON. They make no network requests and do not sign or broadcast.

## Check all examples

Run `npm run examples:check` to check the runnable files and these short excerpts against the SDK.

Read the [instructions](03-instructions.md), [wire specification](../spec/AIBRC_PROTOCOL_V0.25.md) and [indexer guide](06-indexer-guide.md) for the corresponding fields, validity rules and state context.
