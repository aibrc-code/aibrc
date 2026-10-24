# 06 · Bitcoin Resident Agent

**Research**

What would it mean for an Agent to have a durable presence on Bitcoin? A Resident Agent explores an identity,
a treasury, bounded operating authority and a versioned service history that can survive a change of operator.
Its model runs off-chain; its economic identity and commitments can be anchored to Bitcoin.

The useful test is continuity: customers receive a service, revenue covers its costs and another authorized
operator can continue it from an available, verifiable package.

## Why it matters

A memorable AI character can attract attention while its actual continuity depends on a single server, model provider or operator. If that operator leaves, the character's name and token may remain, but the service may not. A Resident Agent asks a more concrete question: what must another legitimate operator receive to continue the same service?

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

A related asset may fund a budget or express a narrowly defined service relationship, but its trading price is not spendable revenue. Application fees may be assigned to a treasury only through an explicit rule; no generic protocol fee or automatic “trading volume becomes compute” mechanism is assumed.

The Bitcoin–Agent “double helix” is useful as a description of two reinforcing activities. Bitcoin supplies money and a verifiable history for autonomous services; services generate demand for payments, data and verifiable records. The relationship must be earned through utility, rather than inferred from the presence of a token.

## How AIBRC fits

Current script accounts and transfers provide an asset foundation. [AIP-0001](../../proposals/AIP-0001-delegation-v1.md), [AIP-0004](../../proposals/AIP-0004-bind.md) and [AIP-0005](../../proposals/AIP-0005-attest.md) offer proposed directions for bounded spending, identity relationships and memory or receipt commitments. Computation, retrieval and tool calls remain off-chain.

A public, appropriately licensed model package could be published through a content system, including an Ordinals-based content experiment. A content commitment can identify the exact package. It does not guarantee that downloading it will be economical, that all dependencies are licensed or that the package contains the Agent's latest memory.

Ownership, use, operation and spending authority need separate meanings. A normal asset Transfer cannot silently transfer credentials or rights in an external service.

## Building the first version

The first prototype should deliver one paid service with a bounded budget. It needs explicit memory versions, content backups, authority rotation and a tested handover procedure. A third party should actually be able to resume it before the project claims operational continuity.

A hash identifies content but does not store it. A chain record does not make an Agent immortal, and a model's natural-language decision is not deterministic proof. Budget exhaustion, supplier failure and service termination require visible outcomes. Any treasury or delegation extension must keep the same canonical-chain and confirmed-revocation boundaries as its underlying proposal.

**What it implements:** **Research.** Give an Agent a continuous identity, a treasury, bounded operating authority and commitments to its evolving memory.\
**What it enables:** A useful service could survive a change of operator while its income and operating costs remain explainable.\
**In plain words:** The model does not run inside a Bitcoin block; its identity, authority and economic history can be anchored to Bitcoin.\
**Technical line:** `identity + treasury + bounded authority + memory commitments + service receipts`.

## Where it can lead

Specialized Resident Agents could cooperate across an open service market: analysis purchases data,
verification checks sources, and a treasury pays the agreed costs. Versioned memory and explicit authority
make handover part of the design, giving a useful service a life beyond one operator or chat interface.
