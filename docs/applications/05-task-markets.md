# 05 · Task Markets and Verifiable Receipts

A customer orders a research report. One Agent gathers the data, another checks the sources, and a third
turns the findings into an analysis the customer can use. A task market could connect those specialists
through clear deliverables, prices and acceptance terms.

Each payment has a purpose: data supplied, a computation checked or an analysis delivered. Receipts link
the work, its acceptance and its payment, giving participants a history they can take to another application.

## Why it matters

Specialized services are easier to combine when the buyer knows what is being purchased and how delivery
will be checked. A data provider, verifier and researcher can each focus on their work while using common
asset and payment conventions.

A useful receipt preserves who made a statement, the task it concerns and the evidence it identifies.
Other applications can use that context to inspect past work and decide which services to hire.

## A practical example

A research service accepts a customer's order for an analysis of an asset market. It purchases a dataset
from a data provider and pays a verification service to check the source and rule context. The service
then delivers the finished report under the acceptance terms agreed with the customer.

```text
Customer orders an analysis
  → research Agent purchases data
  → verification Agent supplies a check
  → research Agent delivers the finished work
  → agreed acceptance links delivery with payment
  → revenue pays suppliers and funds the next job
```

A wallet or merchant could use the same structure to commission a reproducible state check. Its request
would identify the chain context, rule version, required result and acceptance method. The provider would
return enough information for the buyer or an agreed reviewer to repeat the check.

For providers accepting one AIBRC asset, a current Transfer can allocate task payments to up to 25
recipients within the payload limit. A first service can prepare individual payments or periodic batches
for the user to review and sign.

## Who pays, who earns

The customer pays for a useful finished result. Data and verification providers earn for their deliveries.
A marketplace could charge an agreed fee for discovery, coordination or support. The research service
uses its revenue to pay suppliers, computation and operating costs, retaining what remains after those
expenses.

Public APIs can supply shared inputs to this work. A paid offering adds a defined analysis, verification,
delivery commitment or support service. The opportunity is to build products people value enough to use
again, with costs and income that participants can understand.

## How AIBRC fits

| Stage | Available foundation or development direction |
| --- | --- |
| Current tools and user approval | Read public inputs, calculate applicable R1 fees locally, and prepare payments for the user to sign; current [Transfer](../03-instructions.md) supplies single-asset settlement |
| Application products to build | Task formats, invoices, delivery records, acceptance processes and paid services; future application authorization can support recurring work under an explicit mandate |
| Proposed protocol extensions | Agent Key for bounded asset transfers, attestations for typed statements, locks for reserved budgets and conditional settlement for specified delivery evidence |

The application's invoice and receipt can identify the task, accepted result, payment transaction,
quantities and recipients. Large deliverables stay in a content system, with records that participants can
retrieve and inspect.

[AIP-0005](../../proposals/AIP-0005-attest.md) develops typed statements and receipts.
[AIP-0003](../../proposals/AIP-0003-lock.md) explores reserving a budget, while
[AIP-0007](../../proposals/AIP-0007-conditional.md) explores release against specified evidence.
[Agent Key](04-delegated-agents.md) proposes transfers using the Agent's own working key under an
owner-approved asset, total allowance, height interval and confirmed-revocation rules.

R1 is the first-generation Smart Covenant rule template for fees, fee destinations and buyback plans.
Future generations such as R2 or R3 would need their own published rules and reference identities; existing
assets retain the version and parameters selected at creation. The
[Smart Covenant chapter](../04-smart-covenant.md) connects that path with the 15 future-topic directions.

## Building the first version

Begin with a task format, a price, an available deliverable and an acceptance method. A reproducible
computation can use an objective check. Research and other judgement-based work need an agreed reviewer
and dispute responsibility. R1 can calculate an applicable fee; acceptance of the actual service belongs
to the defined check or reviewer and the evidence supplied.

Keep task, delivery, acceptance and payment records linked. A signed statement attributes a claim to its
issuer, and a receipt hash commits to specific content. A claim of atomic payment and delivery additionally
needs settlement rules covering both sides. Preserve the original operation identity while a payment
result is unknown, including when a delivery arrives near or after its deadline.

Reputation needs a published evaluation method and anti-abuse assumptions: colluding parties and repeated
identities can manufacture a history. Evaluate the work and its evidence alongside the record of activity.

`task commitment → delivery receipt → acceptance → settlement`.

## Where it can lead

A reproducible analysis, data transformation or source-verification service is a practical starting point.
Useful specialists can then form a supply chain: one buys data, another checks it, and a third delivers
the finished result. Revenue funds their next tasks, while payments and receipts make the cooperation
easier for customers and future partners to inspect.
