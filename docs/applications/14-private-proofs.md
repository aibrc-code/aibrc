# 14 · Selective Disclosure and Lightweight Verification

**Research**

A service often needs one fact, not a person's entire activity history. Selective disclosure explores how a
client could prove that fact against an accepted state commitment while revealing less unrelated data.
Lightweight verification asks a related question: how can a client check the record it needs efficiently?

These are research directions for AIBRC's public account foundation, from explicit membership proofs to
more advanced private eligibility statements.

## Why it matters

An access service may only need to know whether a user meets a holding condition, yet it may ask for an entire account and transaction history. Public ledgers make data easy to inspect; data minimization still needs deliberate design.

Membership proofs and privacy proofs answer different questions. A Merkle path can show that an explicit record belongs to a root. Hiding the record's amount while proving a range or eligibility condition requires an additional proof system.

## A practical example

A client first accepts a state commitment on a justified basis. It chooses the smallest property required by a service, generates the relevant proof and lets the service evaluate that property. The application also checks whether the underlying state is recent enough and whether a credential has been revoked.

The service should not invent a root and use only its own proof to certify that its root represents the correct ledger. Acceptance of the root is a separate part of the trust model.

## Who pays, who earns

Privacy-oriented wallets, eligibility services and lightweight clients may earn revenue by providing useful access with less disclosure. Their value comes from a product that remains usable while collecting less information, not from accumulating more user histories.

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

**What it implements:** **Research.** Prove a necessary property against an accepted state commitment while reducing unrelated disclosure.\
**What it enables:** Wallets and services can request less information without abandoning verification.\
**In plain words:** Proving eligibility need not mean revealing every wallet activity.\
**Technical line:** `justified state commitment + minimal property proof + freshness and revocation checks`.

## Where it can lead

First, let a client verify one explicit record against a justified commitment. Then study a narrowly scoped
property proof, such as eligibility for a community service. The ambition is practical privacy: useful access
with less unnecessary disclosure, grounded in a clearly understood proof and state model.
