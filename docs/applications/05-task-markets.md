# 05 · Task Markets and Verifiable Receipts

**Application pilots · Proposed protocol receipts and settlement**

Agents can produce work, buy work and verify work. A task market connects those activities through an
explicit request, a result, an acceptance method and a payment. Portable receipts let the record travel with
the participants instead of staying inside one marketplace.

AIBRC's asset model supplies the payment foundation. A service can begin with current transfers, user
approval and signed delivery records. Proposed attestations, locks and conditional settlement develop
shared rules for linking a task, its budget and its evidence.

## Why it matters

Freelance markets and software marketplaces coordinate useful work, but their records are often trapped in one platform. Screenshots and ratings may show activity without proving that a particular result met a particular task. Moving the same rating onto a chain does not solve that problem by itself.

A portable receipt can instead preserve who made a statement, which task it concerns and what evidence the statement commits to. Evaluation can remain open to more than one application.

## A practical example

A wallet or merchant buys a reproducible state check. Its request identifies the chain context, rule version,
required result and acceptance method. A provider returns the result with enough information to repeat the
check. The agreed reviewer accepts the delivery, and a receipt links the task, result and payment.

A research Agent can use the same structure to fill a customer's order. It buys a dataset from one service,
pays another to check it and delivers the final analysis to the customer. For providers accepting one asset,
a current AIBRC Transfer can distribute a task's payments across up to 25 allocations, within the payload
limit. A first service can settle by task or periodic batch after the user reviews and signs.

## Who pays, who earns

Providers earn from delivery. A marketplace can charge for discovery, coordination and support. A verifier may receive an explicitly agreed verification fee. These are different roles and should not be hidden behind a single platform score.

Customer payments fund delivery, marketplace coordination and verification. The service earns from the
finished work and uses that income to pay its suppliers and operating costs. Existing free public APIs
remain available; a paid offering adds a defined analysis, check, delivery commitment or support service.

## How AIBRC fits

Current [Transfer](../03-instructions.md) supplies the single-asset payment path. An application's invoice
and receipt can identify the payment transaction, quantities, recipients, accepted result and task.

[AIP-0005](../../proposals/AIP-0005-attest.md) provides a direction for typed statements and receipts. [AIP-0003](../../proposals/AIP-0003-lock.md) explores reserving a budget, while [AIP-0007](../../proposals/AIP-0007-conditional.md) explores release against specified evidence. Task text and large deliverables remain in a content system; shared rules can identify participants and commit to the relevant records.

```text
Task and acceptance method
  → checkable delivery
  → explicit acceptance
  → linked payment and receipt
  → independent interpretation of work history
```

A signed statement identifies its issuer and claim. The agreed acceptance method determines who evaluates
delivery and which evidence they use.

## Building the first version

A product needs a task format, attributable receipts, available deliverables, an acceptance method and
recovery for payment results that are still unknown. Objective checks can repeat a computation; subjective
work needs an agreed reviewer and dispute responsibility. A receipt hash commits to content, while an atomic
payment-and-delivery claim requires specified settlement rules. A fixed deadline should not become permission
to pay twice or ignore a late but already committed result.

Colluding parties can create artificial receipts, and multiple identities can manufacture a history. Reputation therefore needs an explained methodology and anti-abuse assumptions. An on-chain receipt count is not an objective measure of competence.

`task commitment → delivery receipt → acceptance → settlement`.

## Where it can lead

A reproducible analysis, data transformation or source-verification service is a practical starting point.
From there, task markets can connect specialized Agents into a supply chain: one buys data, another checks
it, and a third delivers the final result. Payment and receipts give that cooperation an economic history.
