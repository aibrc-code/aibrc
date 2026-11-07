# @aibrc/protocol

AIBRC wire codec, OP_RETURN extraction, authorization-shape checks and canonical state transitions. The `./decoder` export additionally parses serialized Bitcoin transactions. Neither export verifies Bitcoin signatures, proves chain membership, signs transactions, or accesses a node.

## Build from this repository

From the repository root: `npm ci --ignore-scripts`, `npm run build`, then `npm test`. The package is prepared for publication; registry publication is a separate operation.

## Core calls

These are SDK excerpts using the [shared setup](../../docs/quickstart.md#shared-setup).

<!-- snippet: deploy -->
```js
const payload = encodeDeploy({
  network, name: 'DEMO',
  totalSupply: 1_000_000n * UNIT,
  deployAuthInputIndex: 0, ownerOutputIndex: 1,
}, namePolicy);
```

<!-- snippet: transfer-single -->
```js
const payload = encodeTransfer({
  network, authInputIndex: 0,
  assetLocator,
  allocations: [{ receiverOutputIndex: 1, amount: 10n * UNIT }],
});
```

A receiver index refers to the actual Bitcoin transaction output. The full
examples below include imports, explicit network context and printed results.

## Runnable examples

The [SDK quick start](../../docs/quickstart.md) contains complete source and commands for [deployment](../../examples/deploy.mjs), [single-recipient transfer](../../examples/transfer-single.mjs), [1–25 recipient batch transfer](../../examples/transfer-batch.mjs), [decoding](../../examples/decode.mjs) and [canonical state hashing](../../examples/state-hash.mjs). Run them from the source repository after the build above. `npm run examples:check` executes and checks the actual files, including every batch count from 1 through 25.

All examples are offline Signet demonstrations. Amounts are integer base units with a fixed display precision of 8. A receiver index must match an actual Bitcoin output in a transaction; a successful encoding does not establish authorization, balance or chain confirmation. The 25-recipient sample is 168 bytes and needs the Extended Profile.

## Runtime and exports

- Node: ESM `@aibrc/protocol` and `@aibrc/protocol/decoder`.
- Browser bundlers: the same imports select `browser` export conditions.
- Standalone browsers: import `dist/browser.js` and `dist/decoder.browser.js`, or the corresponding `/browser` package exports. The built browser files include their own Buffer implementation; no Node global Buffer or Node crypto shim is required.
- Input/output byte APIs intentionally retain Buffer for wire compatibility. Buffer is explicitly exported by the main package. BigInt and modern ES2022 support are required.
- SHA-256 uses pinned `@noble/hashes`; no new hash format is introduced. The complete upstream vector expectations are checked unchanged.

Wire parsing and application are separate. Callers must classify the complete transaction, choose the expected network and valid name-policy schedule, resolve the actual previous outputs and witness authorization, and apply state in canonical chain order. A decoded instruction alone is not evidence of a valid asset operation.

Name-policy activation is supplied by the caller. Read and pin the published context from [config/release.json](../../config/release.json); its `genesisHeight` is the single maintained starting height, and current Name Policy V2 activation uses the same value. `null` means no release height is selected. The SDK does not automatically load or fetch that file. Test heights remain synthetic and are not an activation announcement.
