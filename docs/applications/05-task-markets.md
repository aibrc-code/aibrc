# 05 · Task Markets and Verifiable Receipts

**Proposed / Research**

Agents can produce work, buy work and verify work. A task market connects those activities through an
explicit request, a result, an acceptance method and a payment. Portable receipts let the record travel with
the participants instead of staying inside one marketplace.

AIBRC's asset model supplies the payment foundation. Proposed attestations, locks and conditional settlement
explore how the task, its budget and its delivery evidence could be linked.

## Why it matters

Freelance markets and software marketplaces coordinate useful work, but their records are often trapped in one platform. Screenshots and ratings may show activity without proving that a particular result met a particular task. Moving the same rating onto a chain does not solve that problem by itself.

A portable receipt can instead preserve who made a statement, which task it concerns and what evidence the statement commits to. Evaluation can remain open to more than one application.

## A practical example

A buyer specifies a reproducible data-processing task and an acceptance method. A provider returns the output with enough information to repeat the check. The buyer, both parties or an explicitly selected verifier accepts it, and the payment is linked to the resulting receipt.

An Agent can use the same structure when buying a dataset or tool result from another service. The first experiment should choose an output that is easy to verify, rather than start with subjective work whose disputes have no agreed decision-maker.

## Who pays, who earns

Providers earn from delivery. A marketplace can charge for discovery, coordination and support. A verifier may receive an explicitly agreed verification fee. These are different roles and should not be hidden behind a single platform score.

Customer payments fund delivery, marketplace coordination and verification. A sustainable service covers those operating costs through useful work.

## How AIBRC fits

[AIP-0005](../../proposals/AIP-0005-attest.md) provides a direction for typed statements and receipts. [AIP-0003](../../proposals/AIP-0003-lock.md) explores reserving a budget, while [AIP-0007](../../proposals/AIP-0007-conditional.md) explores release against specified evidence. Task text and large deliverables remain in a content system; the protocol can identify participants and commit to the relevant records.

```text
Task and acceptance method
  → checkable delivery
  → explicit acceptance
  → linked payment and receipt
  → independent interpretation of work history
```

A statement proves that its issuer made a particular claim. It does not make an indexer the judge of all off-chain service quality.

## Building the first version

A product needs a task format, receipt issuance and revocation, content availability, dispute responsibility and recovery for payment results that are still unknown. A fixed deadline should not quietly become permission to pay twice or ignore a late but already committed result.

Colluding parties can create artificial receipts, and multiple identities can manufacture a history. Reputation therefore needs an explained methodology and anti-abuse assumptions. An on-chain receipt count is not an objective measure of competence.

`task commitment → delivery receipt → acceptance → settlement`.

## Where it can lead

A reproducible analysis, data transformation or source-verification service is a practical starting point.
From there, task markets can connect specialized Agents into a supply chain: one buys data, another checks
it, and a third delivers the final result. Payment and receipts give that cooperation an economic history.
