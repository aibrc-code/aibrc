# 02 · Indexers, Explorers and Data Services

**Live components**

Open rules become shared infrastructure when independent services can reproduce them. An AIBRC indexer
reads Bitcoin history, interprets Covenant Inscription operations and exposes the resulting asset state.
An explorer gives people a readable path through those same facts.

A wallet, exchange or Agent can choose a provider and still know which block and rule version produced its
answer. Another implementation can run the calculation again and investigate a disagreement.

## Why it matters

Explorers make public chains readable, while data providers offer reliable access to histories and derived views. A polished search page, however, does not by itself establish which chain, rule version or verified height produced a result. A protocol explorer should expose that context as part of the answer.

The important comparison is not which provider has the most attractive interface. It is whether independent implementations derive the same state from the same canonical history.

## A practical example

A wallet asks for an account balance and receives the asset identity, quantity, source block and interpretation context. A developer investigates a transfer by following its raw transaction, classification reason and resulting state change. If two services disagree, the developer locates the first differing block instead of choosing whichever number looks preferable.

A first useful service can provide issuance, transfer and balance queries. It does not need to operate an exchange or market engine.

## Who pays, who earns

Providers can sell availability, archive access, developer support, analytics or independent verification. Their service quality may justify a fee; it does not give their state interpretation authority over the public rules.

An ecosystem benefits when wallets, exchanges and data businesses can run the same checks for their own needs. Independence depends on actual implementation and source diversity, not simply on the number of differently branded endpoints.

## How AIBRC fits

An indexer processes blocks and transactions in canonical order, applies current rules, and retains enough state to undo and replay affected history. The current state hash allows comparison of the complete canonical result; it is not a substitute for historical data availability. See [the specification, §§6.1–8](../../spec/AIBRC_PROTOCOL_V0.25.md) and [the indexer guide](../06-indexer-guide.md).

```text
Validate the chain source
  → interpret instructions
  → persist recoverable state
  → serve contextual queries
  → compare the same block and rules
```

A locator resolves in the current canonical chain. A query must not quietly preserve an orphaned interpretation after the chain context changes.

## Building the first version

The public package supplies pure rules and vectors, not the platform's production storage, query projections or replica mechanism. A service must choose its own persistence, bounded queries, retention and reorganization recovery.

Full-state serialization, history access and snapshots grow with the data they cover. A failed read must remain unavailable, never become a fabricated zero balance. Multiple services sharing one faulty implementation can agree and still be wrong.

`verified blocks → ordered interpretation → canonical state + contextual queries`.

## Where it can lead

Checkpoint exchange and proposed Merkle proofs can extend that independence toward lighter clients.
A useful next product might compare the same block across implementations or let a wallet verify one record
against an accepted commitment. The common goal is a shorter path from a displayed number to its evidence.
