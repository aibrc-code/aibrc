# Contributing

Build a wallet. Write an independent indexer. Improve a vector. Propose a rule that opens a useful new
application. AIBRC grows through public work that others can read, reproduce and build on.

People, developers and Agents are welcome to contribute through public Issues and AIPs. A useful proposal
connects a real need with an explicit change and evidence another implementation can check.

## From a proposal to a rule

```text
User need and concrete problem
  ↓
AIP: format, validation, state transitions, open questions
  ↓
Specification delta + positive and negative vectors
  ↓
Two independent reviews + property tests
  ↓
Activation notice + pinned release identity
  ↓
Verifier releases and agreed-height activation
```

This is the contribution process, not an automatic on-chain governance system.
An AIP number assigns neither an opcode nor an activated rule. New state must be
covered by canonical serialization, state hashes, snapshots, undo, replay,
queries and historical interpretation. New authority must address old signed
materials, revocation and concurrent execution.

The [proposal directory](proposals/README.md) is the starting point. Current
Deploy/Transfer behavior remains governed by the versioned specification.

## What to submit

- State the user's problem and the smallest useful change, including the
  behavior preserved and the behavior changed.
- Distinguish Live rules, Proposed extensions and Research. Include a
  counterexample that fails on the previous rule when changing correctness.
- Run build, typecheck, tests and vector checks. Record unknown, skipped and
  environment-failed checks; do not change expectations to conceal a mismatch.
- Update examples and documentation with interface changes. Serialize large
  integers as canonical decimal strings rather than floating-point values.
- Never commit credentials, deployment paths, private-system code or material
  you cannot license. Discuss protocol issues through the public process in the
  [trust model](TRUST_MODEL.md#public-discussion-and-versioned-correction).

## Source releases and documentation

This release publishes source and local build instructions, not an npm registry package. Consumers can use
`npm pack --workspace @aibrc/protocol` after building, then install the resulting local archive. Keep the
public specification, examples and version context alongside any integration.

The website renders the same repository files through [Cloudflare Pages](site/CLOUDFLARE_PAGES.md). Edit the
source Markdown rather than maintaining a separate website draft.

## Licensing contributions

Code is [MIT](LICENSE-CODE); documentation is [CC0-1.0](LICENSE-DOCS).
Contributors may license only rights they actually hold. Third-party licenses,
patents and trademarks do not disappear because the project is open.
