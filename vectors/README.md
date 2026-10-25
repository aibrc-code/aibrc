# Public conformance vectors

These are executable reference cases for the current Deploy/Transfer rules. They are synthetic fixtures, not transactions broadcast to Bitcoin and not a network activation announcement.

| File | Cases | What is compared |
| --- | ---: | --- |
| `operation-vectors.json` | 139 | Payload, complete execution context, pre-state, result/reason and post-state |
| `op-return-vectors.json` | 15 | Canonical extraction, malformed marker classification and payload bytes |
| `chain-vectors.json` | 8 | Canonical order, name winners, locator invalidation, branch replacement and final state hash |
| `authorization-vectors.json` | 19 | Witness-shape interpretation, supported sighash flags and malformed context rejection |
| `bitcoin-transaction-fixtures.json` | 6 | Serialized transaction bytes, witness/stripped size, weight and fee arithmetic |

From the repository root:

```sh
npm ci --ignore-scripts
npm run build
npm run vectors:check
npm test
```

`vectors:check` replays the fixed JSON expectations. `npm test` additionally exercises the deterministic raw-transaction decoder and the built Node/browser artifacts. It does not rewrite expected results. Counts above describe different fixtures and must not be added together as independent proof of security.

The operation vectors preserve the upstream execution bodies. The chain and extraction vectors preserve every upstream vector body. Repository-generation paths and platform-only descriptive metadata are omitted. Authorization JSON makes the existing witness-interpretation test cases reusable outside TypeScript.

The pure chain harness stores in-memory state snapshots and rewinds to the common ancestor before replay. It is test infrastructure. It is not the platform production indexer, a Bitcoin header validator, a pruning policy, or a storage implementation.

The browser artifact test runs the emitted ES module in a clean JavaScript VM with no Node globals and no external module imports. This proves portable execution of the tested byte/state rules, not a complete wallet integration or browser application certification.

## Important context

- Numeric block heights in these files are explicitly synthetic test contexts, including before/at/after a test-only name-policy boundary. The public release height is separately maintained in [config/release.json](../config/release.json).
- Raw witness byte stacks are structural fixtures. Bitcoin transaction validity and signature verification remain Bitcoin's responsibility.
- A valid payload is not sufficient by itself. Supply the actual prevouts, witness interpretation, expected network, name policy and canonical transaction position.
- `NO_OP` means the AIBRC instruction leaves state unchanged. `NEEDS_UPGRADE` means an activated version is not implemented; an indexer must not silently continue applying an older interpretation.
- The current state hash is SHA-256 of canonical JSON bytes. No Merkle-root or proof implementation is implied by these vectors; the Merkle document is a proposal.
