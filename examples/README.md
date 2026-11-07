# Runnable AIBRC examples

Start at the [SDK quick start](../docs/quickstart.md). Build once from the repository root:

```sh
npm ci --ignore-scripts
npm run build
```

| File | Run | Purpose |
| --- | --- | --- |
| [deploy.mjs](deploy.mjs) | `node examples/deploy.mjs` | Encode a fixed-supply deployment |
| [transfer-single.mjs](transfer-single.mjs) | `node examples/transfer-single.mjs` | Encode one recipient allocation |
| [transfer-batch.mjs](transfer-batch.mjs) | `node examples/transfer-batch.mjs 25` | Encode 1–25 recipient allocations of one asset |
| [decode.mjs](decode.mjs) | `node examples/decode.mjs` | Decode Signet Deploy or Transfer payload hex |
| [state-hash.mjs](state-hash.mjs) | `node examples/state-hash.mjs` | Recompute a published non-empty state hash |

These offline Signet examples make no network requests and do not sign or broadcast. Output indexes and heights are illustrative. Amounts are integer base units with the protocol's fixed display precision of 8. The batch default is 25; the 25-recipient sample is 168 bytes and uses the Extended Profile.

Run `npm run examples:check` to execute and check the examples, including every recipient count from 1 through 25. The complete source blocks in the quick start are checked against these files.
