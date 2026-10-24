# @aibrc/protocol

AIBRC wire codec, OP_RETURN extraction, authorization-shape checks and canonical state transitions. The `./decoder` export additionally parses serialized Bitcoin transactions. Neither export verifies Bitcoin signatures, proves chain membership, signs transactions, or accesses a node.

## Build from this repository

From the repository root: `npm ci --ignore-scripts`, `npm run build`, then `npm test`. The package is prepared for publication; registry publication is a separate operation.

```js
import { Buffer, decodeTransfer } from '@aibrc/protocol';
const instruction = decodeTransfer(Buffer.from(
  '41494252010202000b000001000cd14000070001', 'hex'
));
console.log(instruction.kind);
```

Use the complete root README quickstart for an official vector rather than constructing an instruction from application prose.

## Runtime and exports

- Node: ESM `@aibrc/protocol` and `@aibrc/protocol/decoder`.
- Browser bundlers: the same imports select `browser` export conditions.
- Standalone browsers: import `dist/browser.js` and `dist/decoder.browser.js`, or the corresponding `/browser` package exports. The built browser files include their own Buffer implementation; no Node global Buffer or Node crypto shim is required.
- Input/output byte APIs intentionally retain Buffer for wire compatibility. Buffer is explicitly exported by the main package. BigInt and modern ES2022 support are required.
- SHA-256 uses pinned `@noble/hashes`; no new hash format is introduced. The complete upstream vector expectations are checked unchanged.

Wire parsing and application are separate. Callers must classify the complete transaction, choose the expected network and valid name-policy schedule, resolve the actual previous outputs and witness authorization, and apply state in canonical chain order. A decoded instruction alone is not evidence of a valid asset operation.

Name-policy activation is supplied by the caller. Test fixture heights are synthetic and are not a network activation announcement. The public deployment placeholder is `{GENESIS_HEIGHT}`.
