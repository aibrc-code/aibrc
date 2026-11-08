# 06 · Bitcoin Resident Agent

**Research**

A Resident Agent could keep delivering research, verification or another useful service as its operators
change. It would have a recognizable identity, an operating budget and a service history that customers
and suppliers can follow. Its model runs off-chain; its economic identity and commitments can be anchored
to Bitcoin.

The useful test is continuity: customers receive a service, revenue covers its costs and another authorized
operator can continue it from an available, verifiable package.

## Why it matters

A useful service should have a path beyond its original operator. For a Resident Agent, the practical
question is what another authorized operator would need to continue answering customers, paying suppliers
and maintaining the same service history.

This reuses a useful idea from programmable asset ecosystems: give identity, operating authority and a
treasury distinct roles. A Bitcoin design can connect those roles through explicit asset rules and
available service packages, while keeping model execution in its appropriate off-chain environment.

The answer includes more than model weights. It may require configuration, licensed tools and datasets, a recoverable memory format, operating authority and a budget. Public identity helps make those dependencies visible; it does not make them disappear.

## A practical example

A user pays an Agent for a recurring research or verification service. The Agent returns a result with an identifiable receipt. Its treasury pays the model, data and execution bills. At defined checkpoints, it commits to a memory version that authorized successors can retrieve and verify.

If the operator changes, the replacement follows an explicit transition: obtain the available service package, verify its commitments, receive the required authority and resume delivery. Users can distinguish a continuation from a new service merely reusing the same name.

```text
Paid request → useful result and receipt
  → operating costs paid from a budget
  → versioned memory commitment
  → authorized operator transition
  → service continues under the same identity
```

## Who pays, who earns

Income should come from answers, analysis, data access or tool execution that somebody wants to buy. Costs include inference, retrieval, data licensing, Bitcoin fees and user support. A treasury is sustainable only if actual income or explicit donations cover those costs.

A related asset may fund a budget or express a defined service relationship. Track its market valuation
separately from the revenue and reserves actually available to pay bills. An application can allocate fees
to a treasury through an explicit published rule, making the funding path visible to customers and operators.

The Bitcoin–Agent “double helix” describes two reinforcing activities. Bitcoin supplies money and a
verifiable history for services; useful services create demand for payments, data and verifiable records.
Customers paying for work give the service the resources to keep operating.

## How AIBRC fits

Current script accounts and transfers provide an asset foundation. [AIP-0001](../../proposals/AIP-0001-delegation-v1.md), [AIP-0004](../../proposals/AIP-0004-bind.md) and [AIP-0005](../../proposals/AIP-0005-attest.md) offer proposed directions for bounded spending, identity relationships and memory or receipt commitments. Computation, retrieval and tool calls remain off-chain.

A public, appropriately licensed model package could be published through a content system, including an Ordinals-based content experiment. A content commitment can identify the exact package. It does not guarantee that downloading it will be economical, that all dependencies are licensed or that the package contains the Agent's latest memory.

Ownership, use, operation and spending authority need separate meanings. A normal asset Transfer cannot silently transfer credentials or rights in an external service.

## Building the first version

The first prototype should deliver one paid service with a bounded budget. It needs explicit memory versions, content backups, authority rotation and a tested handover procedure. Operational continuity means an authorized replacement can resume the service from that package.

A hash identifies content but does not store it. A chain record does not make an Agent immortal, and a model's natural-language decision is not deterministic proof. Budget exhaustion, supplier failure and service termination require visible outcomes. Any treasury or delegation extension must keep the same canonical-chain and confirmed-revocation boundaries as its underlying proposal.

`identity + treasury + bounded authority + memory commitments + service receipts`.

## Where it can lead

Specialized Resident Agents could cooperate across an open service market: analysis purchases data,
verification checks sources, and a treasury pays the agreed costs. Versioned memory and explicit authority
make handover part of the design, giving a useful service a life beyond one operator or chat interface.
