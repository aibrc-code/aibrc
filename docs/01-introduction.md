# 01 · Why Bitcoin needs a shared application language

## The moment: open money meets programmable cooperation

Bitcoin connects energy, proof of work and an openly verifiable monetary history. Its strength is both
technical and cultural: anyone can hold value, inspect the rules and verify the chain. Other blockchain
ecosystems have shown what shared asset interfaces and execution environments make possible. ERC standards
and the EVM helped wallets, developers and applications reuse a common foundation rather than start from
scratch with every project.

As AI moves from answering questions to taking action, that foundation matters in a new way. Agents need
money to buy services, explicit authority to act and records that others can check. A shared language can
connect an instruction such as “pay for this result” with the assets, permissions and evidence behind it.

Satoshi described Bitcoin as **“based on crypto proof instead of trust”** in his
[2009 open-source announcement](https://satoshi.nakamotoinstitute.org/posts/p2pfoundation/1/).
That idea remains a practical guide: publish the rules and let independent software check the result.

## Bitcoin's ecosystem: exploration and accumulation

Ordinals, BRC-20, Runes and other protocols brought new assets, creative work, communities and tools to
Bitcoin. Lightning and other extensions explored different payment and execution paths. Each contribution
reflects a different answer to what can be built around Bitcoin.

Behind those systems are people creating art, maintaining wallets, writing indexers and keeping communities
alive between market cycles. Their accumulated work is a foundation to preserve. An open standard becomes
valuable when the next builder can use what already exists and add something of their own.

## Native protocols, many paths and fragmented integration

Protocol diversity also means different asset identities, transfer rules and wallet workflows. One community
can appear across several standards while its markets and application integrations develop separately.
Culture can travel faster than the infrastructure connecting it.

AIBRC responds with a common protocol and account foundation, open interpretation rules and Smart Covenant.
The goal is compatibility: connect asset standards and applications through a language they can share,
while keeping each protocol's native validity rules intact.

```text
One community
  ├─ AIBRC assets
  ├─ BRC-20 assets
  └─ Runes assets
       ↓
Shared origin · clear identities · common interaction
       ↓
Connected wallets, services, markets and Agents
```

[Shared-root issuance and settlement](05-cross-protocol.md) connect this common origin to asset-specific
issuance and exchange conditions.

## How the layers fit

AIBRC uses declarative instructions: express an asset operation, check its conditions and derive its state
change. The current core is deliberately compact. Applications can add their own execution systems, while
protocol changes affecting ownership or permissions use explicit, versioned rules.

```text
A person or Agent expresses an intent
  ↓
A wallet prepares and authorizes the transaction
  ↓
Bitcoin validates spending and orders the transaction
  ↓
AIBRC interprets the instruction and asset effects
  ↓
Applications use the result and expose the evidence
```

Bitcoin checks BTC spends, signatures, scripts and blocks. AIBRC interpreters check protocol authority,
asset identity and balances. Applications provide products: wallets, exchanges, data services or Agent tools.
Each layer has a clear job, and third parties can build without adopting one mandatory application.

ERC and EVM are useful parallels for the value of common standards and reusable rules. AIBRC does not import
Ethereum's execution environment into Bitcoin: Smart Covenant defines explicit relationships between asset
rules and their executors. The [Smart Covenant chapter](04-smart-covenant.md) develops that design.

## A ledger independent software can reproduce

An AIBRC account is derived from `scriptPubKey`; its asset balance follows accepted instructions in canonical
Bitcoin order. Canonical serialization puts assets, names, locators and positive balances into a single defined
representation:

```text
Canonical blocks + applicable rules
  → ordered asset transitions
  → canonical state bytes
  → SHA256 state hash
```

This gives wallets and indexers a reproducible result to compare. The exact format is in
[§6.1 of the specification](../spec/AIBRC_PROTOCOL_V0.25.md). Merkle proofs are a separate extension for checking
individual records; the present state hash covers the complete canonical state.

## Build from the core, extend through open proposals

The current operations are Deploy and Transfer. They provide fixed-supply issuance and transfers from an
authorized script account to one or more recipients. The public package supplies the codec, deterministic
validation and state functions, test vectors and implementation guidance.

The next building blocks are organized as [AIPs](../proposals/README.md): Agent Key, multi-asset transfers,
height locks, bindings, attestations, checkpoints and conditional settlement. New behavior becomes a rule
through specification, examples, implementation and an explicit activation context.

A wallet can begin with clear asset transfers. An indexer can reproduce state. An Agent can begin by reading,
explaining and preparing operations. Each is a useful contribution to the same open foundation.
