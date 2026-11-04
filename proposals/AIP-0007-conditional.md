# AIP-0007 — Deterministic Transfer Conditions

**Stage: Proposed. No opcode, wire bytes or activation height assigned.**

Conditional transfers apply an asset movement when defined transaction conditions hold. They provide a design path for exact exchanges, task payments and bounded offers.

`verifyAuthorization && verifyConditions && verifyBalance → apply`.

## Purpose

Explore bounded conditions such as a payment output to a specified script, a
height interval or spending a specified outpoint. This is a possible future
settlement primitive, not evidence that today's script-account balance assets already
support unattended PSBT markets with guaranteed cross-protocol delivery.

## Format direction

An explicit authorized asset movement plus a bounded, typed condition list.
Each condition declares exact Bitcoin transaction fields or agreed protocol
state it inspects. Amounts, recipient scripts, height endpoints, reference
outpoints and units require canonical encodings. No arbitrary network call,
wall clock, natural-language judgment or LLM output is a consensus predicate.

## Validation direction

Validate authorization, condition commitments, input/output relationships,
asset balance and complete fulfillment before applying anything. Bitcoin
transaction inclusion alone does not make another protocol's instruction valid.
For an external asset leg, the trusted interpretation and actual delivery check
must be specified. Existence of an input/output carrying a reference is not
necessarily proof of the intended asset transfer.

Current AIBRC authorization forbids `SIGHASH_SINGLE` and `ANYONECANPAY`.
This proposal does not relax that rule. Any future partial-signature scheme
must prove which signature commits the payload, conditions and recipients,
prevent substitution, and address stale account balances. A Bitcoin-valid
payment could otherwise survive while the AIBRC leg becomes a no-op.

## State changes

A simple same-transaction condition can gate an ordinary atomic balance delta.
Persistent orders, locks or partial fills add commitments, version fences and
cancellation state; they are not a free consequence of adding a boolean check.
If pre-signing requires reserving spendability, its interaction with
[delegation](AIP-0001-delegation-v1.md) and [locks](AIP-0003-lock.md) must be explicit.

## Open questions

First supported predicate set; reservation of seller balances; replay and
cancellation; expiry; partial fills; malicious counterparties; front-running;
payload/work limits; and cross-protocol interpretation. An online signer that
checks fresh state and an unattended pre-signed order have different guarantees.
Do not advertise trustless atomic delivery until independent counterexamples,
full transaction paths and activation semantics have been resolved.
