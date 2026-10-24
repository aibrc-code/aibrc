# AIP-0005 — Attestation Commitment

**Stage: Proposed. No opcode, wire bytes or activation height assigned.**

- **What it implements:** Let an account commit to receipts, credentials or memory content.
- **What it enables:** Give Agents portable public records that independent applications can interpret.
- **In plain words:** Show who stated what and when; attribution alone does not make the statement true.
- **Technical line:** `attest(issuer, type, subject, contentHash, revision)`.

## Purpose

Commit to task receipts, credentials, model-package identities or memory roots
without executing an LLM or storing its full data in protocol state. An
attestation can be evidence for a reputation system; the protocol should not
equate issuance volume with truth or assign universal reputation scores.

## Format direction

Explicit issuer authorization, bounded statement type, subject identity,
content/hash-scheme identifier, content commitment and optional prior-statement
reference. Larger receipts can be committed through a separately specified tree
root. Any reference to external data must identify content independently of a
mutable URL.

## Validation direction

Verify issuer authority and deterministic field bounds. An optional subject
acknowledgment is a separate signature/statement, not inferred agreement.
Updates and revocations require an explicit identity and sequence rule; the
original statement cannot be erased from Bitcoin history. A statement about
completion does not itself authorize asset payment.

## State changes

Choose explicitly between retaining only a current head and retaining a full
protocol attestation registry. An append-only query archive is not automatically
consensus state. Any current head, revocation fence or enforced registry must be
included in versioned state hashing, snapshots and reorganization handling.

## Open questions

Retention cost and anti-spam economics; statement availability; privacy and
selective disclosure; replay prevention; issuer key rotation; schema discovery;
and subject consent. Publishing a hash does not make its contents secret or
available. A memory root does not prove that a model performed the claimed
reasoning or remains online.
