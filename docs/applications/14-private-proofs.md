# 14 · Selective Disclosure and Lightweight Verification

**Research**

A wallet or Agent may need to check one asset balance or one community eligibility record. It should have
a path from that specific record to the evidence supporting it. Lightweight verification explores that
path; selective disclosure asks how a service could request less unrelated information along the way.

For AIBRC, the first useful goal is to verify one explicit record against an accepted state commitment.
Further research can develop private statements about eligibility or holdings on that foundation.

## Why it matters

An access service may only need to know whether a user meets a holding condition, yet it may ask for an entire account and transaction history. Public ledgers make data easy to inspect; data minimization still needs deliberate design.

Membership proofs and privacy proofs answer different questions. A Merkle path can show that an explicit record belongs to a root. Hiding the record's amount while proving a range or eligibility condition requires an additional proof system.

## A practical example

A wallet assistant checks a user's asset record before preparing a payment. In a proposed lightweight
design, it obtains the explicit record and a membership proof, then verifies that proof against a root
accepted for the relevant Bitcoin history and rule context. It can focus on the needed record instead of
asking the user to disclose an entire activity history.

A later community service could request a proof of eligibility with fewer disclosed details. The exact
statement, proof system, freshness and revocation policy would determine what that service can conclude.
Root acceptance remains a separate trust decision from checking a path against it.

## Who pays, who earns

Wallets, eligibility services and independent verification providers could earn by making specific checks
easier to obtain and repeat. People gain clearer access to evidence; Agents gain a way to inspect the
record needed for a task. A selective-disclosure product adds value by collecting only the information
required for its stated purpose.

Compliance or community policies remain application choices. A proof can demonstrate a defined statement; it does not automatically satisfy every legal or social requirement associated with that statement.

## How AIBRC fits

Current script accounts and quantities are public. The [Proposed Merkle reference](../../merkle/STATE_PROOF_REFERENCE.md) describes membership and non-membership against a specified root. Selectively hiding values or proving a threshold needs separate cryptographic and state rules.

```text
Accept a justified state root
  → choose the required property
  → create and verify the proof
  → disclose only its required inputs
  → recheck freshness and revocation
```

The reference uses a 256-level sparse tree; an uncompressed sequence of 256 32-byte siblings is about 8 KiB before other fields. Compression, aggregation and zero-knowledge formats are additional work, not performance properties of the current state hash.

## Building the first version

First establish the basic proof format and root acceptance model. Then evaluate proof-system assumptions, any trusted setup, client generation costs, verification costs and old-state replay. Cryptography cannot compensate for an accepted root that represents the wrong chain or rule version.

One-time receiving scripts may reduce certain direct links, but common inputs or other behavior may restore them. Encrypting off-chain content does not hide public transfers. Confidential amounts and shielded state would change supply checks, balance validation and recovery, so they remain separate research directions.

`justified state commitment + minimal property proof + freshness and revocation checks`.

## Where it can lead

First, let a client verify one explicit record against a justified commitment. Then study a narrowly scoped
property proof, such as eligibility for a community service. The ambition is practical privacy: useful access
with less unnecessary disclosure, grounded in a clearly understood proof and state model.
