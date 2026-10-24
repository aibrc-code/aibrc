# AIP-0006 — State Checkpoint Publication

**Stage: Proposed. No opcode, wire bytes or activation height assigned.**

- **What it implements:** Publish comparable state commitments bound to a block and rule identity.
- **What it enables:** Help independent indexers find disagreements and wallets identify a proof's state context.
- **In plain words:** State publicly which result was computed for a block under a given rule set.
- **Technical line:** `checkpoint(network, manifest, block, stateHash, optionalRoot)`.

## Purpose

Publish indexer statements without turning indexer votes into Bitcoin consensus.
A checkpoint is a commitment and attribution mechanism. It is not automatically
an authoritative balance, a custodial reserve proof, or permission to skip
historical verification.

## Format direction

Bind network, genesis selection, rule/manifest identity, height, block hash,
current canonical State Hash, and a versioned optional Merkle root. Signer and
signature scheme must be explicit if signed statements are supported. Do not
reuse a legacy State Hash field for a different hash construction. The separate
[Merkle reference](../merkle/STATE_PROOF_REFERENCE.md) proposes exact candidate
root/statement encodings but does not activate them.

## Validation direction

Validate structure, declared signer authorization where applicable, and the
statement's canonical block context. Publishing an incorrect root may still be
a validly attributed statement; acceptance as a bootstrap source is a separate
policy that needs its own trust assumptions. Compare roots only when complete
network, block and rule context match.

## State changes

Prefer a commitment-publication record that does not mutate asset balances.
If a registry or any accepted checkpoint enters protocol state, define its
retention and authority independently. A checkpoint committing to its containing
block's post-state could create a circular definition if checkpoints themselves
change that state; use a completed prior block or specify a noncircular scope.
Rollback must preserve historical orphaned statements while invalidating their
claim of current canonicality.

## Open questions

Permissionless publication versus a registered signer set; spam/retention;
rotation; aggregation; checkpoint interval; external timestamp proofs; and
snapshot trust. Matching roots from several services demonstrate agreement,
not independence or correctness. No quorum, reward, finality or guaranteed
snapshot-availability mechanism is selected here.
