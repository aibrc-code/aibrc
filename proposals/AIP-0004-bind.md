# AIP-0004 — Typed Binding

**Stage: Proposed. No opcode, wire bytes or activation height assigned.**

- **What it implements:** Publish explicit, authorized associations between accounts, assets and external identifiers.
- **What it enables:** Let wallets and Agents identify an association's issuer instead of guessing from names.
- **In plain words:** Publish that this account declares a relationship to that identifier.
- **Technical line:** `bind(subject, relationType, target, expectedGeneration)`.

## Purpose

Support account aliases, asset metadata references or collection relations using
typed declarations. A unilateral association proves only its issuer's statement.
It does not prove control of an external wallet, domain, contract or asset;
those relations require independently specified reciprocal evidence.

## Format direction

An explicit authorization input, subject identifier, relation type, bounded
target reference, and update generation/version. Targets should be compact
identifiers or content commitments, not arbitrary large documents. Define which
relation types are protocol-enforced and which are descriptive application data.

## Validation direction

Check who currently controls the subject and which authority can create, replace
or revoke a relation. Validate exact namespace and canonical reference encoding.
Do not infer ownership from a matching ticker, name or EVM address string.
Asset ownership transfer must have an explicit effect on prior bindings; an old
owner's signature cannot silently edit the new owner's relationship.

## State changes

Add versioned typed bindings and any persistent generation fence required to
prevent old material from overwriting a later state. Record revocation with
clear effective canonical order. Historical statements remain distinguishable
from the currently selected binding.

## Open questions

Which subjects have a unique controlling owner for fungible assets; whether
aliases are transferable or first-come; expiry and revocation; target proof
schemes; content availability; and deterministic size limits. A same-origin
reference does not establish equal prices, shared rights or redemption. No
existing cross-protocol issuer is designated “official” by this proposal.
