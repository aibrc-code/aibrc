# AIBRC Improvement Proposals

Every document here is **Proposed**. These seven pages are design directions,
not active opcodes, final byte layouts, activation announcements or promises of
delivery. Wire version 1 currently recognizes only Deploy and Transfer. Opcode
range reservations do not activate any proposal.

| Proposal | Question it answers |
| --- | --- |
| [AIP-0001: Delegation v1](AIP-0001-delegation-v1.md) | How can an owner grant limited asset-transfer authority to an Agent account? |
| [AIP-0002: Multi-asset transfer](AIP-0002-multiasset-transfer.md) | Can one instruction atomically allocate several AIBRC assets? |
| [AIP-0003: Lock](AIP-0003-lock.md) | Can specified assets be unavailable until a Bitcoin height? |
| [AIP-0004: Bind](AIP-0004-bind.md) | Can an authorized account publish an explicit typed association? |
| [AIP-0005: Attest](AIP-0005-attest.md) | Can an account commit to a receipt, credential or memory-root statement? |
| [AIP-0006: Checkpoint](AIP-0006-checkpoint.md) | Can indexers publish comparable state commitments? |
| [AIP-0007: Conditional](AIP-0007-conditional.md) | Can an asset movement require deterministic transaction conditions? |

A proposal progresses through explicit specification, independent positive and
negative vectors, review, complete state/recovery consumer integration, and an
activation announcement. A version set accepted by a pure parser is not a
complete height-activation system. Historical replay must retain earlier rules;
clearing an application's database does not reset Bitcoin history.

Do not construct or sign spendable transactions from these outline fields.
The current 480-byte payload ceiling and compatibility profile remain reference
constraints, not permission to sacrifice authorization identity to save bytes.
New rules need new public vectors and a reviewed activation design.
