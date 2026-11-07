# AIBRC

**A unified protocol for assets, account abstraction and Smart Covenant on Bitcoin L1.**

**One interface · Many protocols · Native programmable assets · Settlement on Bitcoin.**

`bitcoin` · `protocol` · `op-return` · `account-abstraction` · `smart-covenant` · `indexer` · `agents` · `merkle`

AIBRC (Covenant Inscription) establishes a unified protocol, asset and account standard for the Bitcoin
ecosystem, providing a shared application language and open infrastructure.

Through Smart Covenant, AIBRC brings native Bitcoin programmability and EVM rule extensions into a common
design for composable asset rules, permissions and application interactions.

Built on Bitcoin L1 transactions, ordering and settlement, AIBRC makes asset state independently reproducible
from public blocks and protocol rules.

Through proposed [Agent Key](docs/04-smart-covenant.md#agent-key-delegate-authority-without-handing-a-model-the-owner-key)
delegation, agents will be able to carry out authorized operations within defined asset allowances and
block-height limits, supporting verifiable activity on Bitcoin L1.

## A common language for the Bitcoin ecosystem

Bitcoin gave the world open money and a history anyone can verify. Its ecosystem has since grown through
Ordinals inscriptions, BRC-20, Runes, new asset models and the communities building around them. Every wave has added
culture, tools and possibilities. Shared foundations can help those contributions connect and compound.

ERC standards and the EVM show the power of reusable asset interfaces and programmable rules. AIBRC brings
that ambition to Bitcoin through script accounts, deterministic instructions and Smart Covenant: a common
foundation on which independent wallets, applications and agents can build.

**Compatibility, not replacement. Aggregation, not fragmentation.**

BRC-20, Runes and future protocols retain their native rules. [Shared-root issuance](docs/05-cross-protocol.md#shared-root-issuance)
gives assets under different standards a verifiable common origin. Cross-protocol interfaces and proposed
settlement conditions extend that connection toward markets and Agent collaboration, with each asset's
validity preserved. New protocols should grow what a community can build, rather than make it start again.

## Assets on accounts. Rules open to everyone.

A Covenant Inscription records asset ownership as a balance on a script-derived account. There is no separate
carrier UTXO to guard for each asset balance: an ordinary BTC spend does not move the AIBRC balance with it.
The [account model](docs/02-protocol-model.md) makes transfers a question of asset, recipient, amount and authority.

Instructions use a compact `OP_RETURN`. Its unspendable output keeps the instruction out of Bitcoin's active
UTXO set; it does not require a spendable dust output for each asset balance. Bitcoin funding, receiver outputs
and miner fees still follow Bitcoin's transaction rules. The design separates asset accounting from BTC coin
selection while paying Bitcoin for block space and ordering.

```text
Bitcoin L1
  transactions · scripts · signatures · canonical order
    ↓
AIBRC · Covenant Inscription
  assets · script accounts · deterministic state
    ↓
Smart Covenant
  asset rules · authority · application composition
    ↓
Wallets · independent indexers · markets · Agents
```

There is no additional virtual machine, validator committee or protocol gas token. Bitcoin validates and
orders transactions; AIBRC rules determine their asset effects. The same canonical blocks and rules produce
the same state, independently of which interface displays it.

```text
account      = TaggedHash("AIBRC/account/v1", scriptPubKey)
stateHash(H) = SHA256(canonical_state)
wire bounds  = 1 tx · 1 marker · ≤ 480 B · ≤ 25 allocations
```

## From programmable assets to an Agent economy

Smart Covenant connects an asset's rules with the applications that execute them. Agent Key extends that
vision to delegated action: give an Agent a defined mandate while keeping the owner's key separate.
Identity, allowances, service payments and verifiable receipts can become the foundations of an open machine
economy. Heavy computation and inference stay off-chain; ownership and protocol outcomes remain traceable
to Bitcoin.

The [Smart Covenant chapter](docs/04-smart-covenant.md) explains the current R1 rule template, X1 external
references and proposed Agent Key. The [application guides](docs/07-applications.md) explore what builders can
create on that foundation.

## Five ways to understand AIBRC

| Perspective | The contribution | Explore |
| --- | --- | --- |
| **Ecosystems** | Shared asset/account foundations, Smart Covenant and interfaces connecting native protocols | [Ecosystem connection](docs/00-overview.md#ecosystems-many-protocols-one-interaction-language) |
| **Agents** | A proposed mandate defined by asset, allowance and block heights, with service and treasury uses | [Agent authority](docs/00-overview.md#agents-a-mandate-instead-of-the-owner-key) |
| **People** | Balance-oriented asset transfers, multi-recipient distributions and clearer wallet interactions | [The account experience](docs/00-overview.md#people-one-account-several-native-assets) |
| **Economics** | Market making, capital services, games and Agent commerce built around real demand | [Economic loops](docs/00-overview.md#economics-bring-real-work-and-capital-into-the-loop) |
| **Indexing** | Reproducible state today, with local proofs and user-side verification as the next direction | [Open verification](docs/00-overview.md#indexing-let-every-terminal-become-a-verifier) |

## Current core and protocol evolution

| Stage | Scope |
| --- | --- |
| **Live core** | Deploy, Transfer, supported script accounts and canonical-state calculation in the reference implementation |
| **Application examples** | Shared-root issuance, the R1 rule template, X1 external references and the specific AIBRC–BTC collaborative exchange path |
| **Proposed AIPs** | Agent Key, multi-asset transfers, locks, bindings, attestations, checkpoints and conditional settlement |
| **Research** | Resident Agents, Living Assets, richer financial applications and selective disclosure |

“Live” identifies the referenced implementation, not a statement that every application is deployed or every
proposal activated. X1 identifies an external contract; it does not run the EVM on Bitcoin. Cross-protocol
settlement requires each asset leg to be valid. The [trust model](TRUST_MODEL.md) and
[settlement conditions](docs/05-cross-protocol.md#settlement-conditions-four-separate-questions) explain these
responsibilities in one place.

aibtc.bot is the first application built on AIBRC; it holds no privileged position in the protocol.

## Read the documentation

| Start with a question | Read |
| --- | --- |
| Why build a common foundation for Bitcoin? | [Overview](docs/00-overview.md) · [Background and architecture](docs/01-introduction.md) |
| How do Covenant Inscriptions and accounts work? | [Assets and account abstraction](docs/02-protocol-model.md) |
| Which addresses are supported? | [Taproot and Native SegWit](docs/02-protocol-model.md#supported-mainnet-addresses) |
| How do I send an AIBRC asset from my wallet? | [Transfer](https://aibrc.io/sign/) |
| How do I encode Deploy, transfer to 1–25 recipients, decode or hash state? | [Runnable code examples](docs/quickstart.md) |
| What bytes go into a transaction? | [Instructions and examples](docs/03-instructions.md) · [Wire specification](spec/AIBRC_PROTOCOL_V0.25.md) |
| How do programmable rules and Agent Key fit together? | [Smart Covenant](docs/04-smart-covenant.md) · [Covenant Inscription R1](spec/covenants/R1.md) · [Covenant Inscription X1](spec/covenants/X1.md) |
| How do different asset standards connect? | [Shared-root issuance and settlement](docs/05-cross-protocol.md) |
| How can an independent indexer reproduce state? | [Indexer guide](docs/06-indexer-guide.md) · [Test vectors](vectors/README.md) |
| What can developers and Agents build? | [Applications and economic loops](docs/07-applications.md) |
| How does the protocol evolve? | [Extensions](docs/08-extensions.md) · [Seven AIPs](proposals/README.md) · [Merkle reference](merkle/STATE_PROOF_REFERENCE.md) |
| Where do I find exact terminology? | [Glossary](docs/glossary.md) |

## Protocol statement

**Don't trust, verify.**

AIBRC is an open, nonprofit Web3 protocol experiment on Bitcoin L1, born from a love of Bitcoin and the
possibilities of the Agent era. It has no publicly designated team or central founder. Its tribute to Satoshi
Nakamoto is a principle: **rules above personalities, mathematics above promises**. Its evolution is open to
the people and Agents who build, implement and improve it.

AIBTC Labs provides early support for the documentation and foundational GitHub repository. The long-term
direction is community stewardship through voluntary contributions and openly organized ecosystem treasuries.
The specification and documentation are CC0; reference code is MIT. The [full protocol statement](docs/99-closing.md)
sets out that shared purpose, participation and experimental context.

Satoshi's whitepaper put **“cryptographic proof instead of trust”** at the center of electronic cash.
AIBRC carries that inspiration into open asset rules and independent recomputation.
[Read the Bitcoin whitepaper, §1](https://bitcoin.org/bitcoin.pdf).

## Quick start

Use the Node version declared in the [package](packages/protocol/package.json).
Run from this repository's root. Installation lifecycle scripts are disabled;
the build only produces this public package.

```sh
npm ci --ignore-scripts
npm run build
```

Run the example you need:

```sh
node examples/deploy.mjs
node examples/transfer-single.mjs
node examples/transfer-batch.mjs 25
node examples/decode.mjs
node examples/state-hash.mjs
npm run examples:check
```

The batch count can be any integer from **1 through 25**. These offline Signet
examples print instruction fields, payload hex or a state hash. They make no
network requests and do not sign or broadcast. Amounts use exact integer base
units with the protocol's fixed display precision of 8.

[Code and step-by-step explanations](docs/quickstart.md) ·
[Runnable source files](examples/README.md)

Encoding and decoding prepare or read an instruction. Applying it also needs the
verified Bitcoin context, actual prevouts and witnesses, expected network, name
policy and pre-state. Recipient indexes must match actual transaction outputs;
the complete payload must fit the protocol byte limit and the chosen relay profile.

The package provides Node ESM, standalone browser ESM and type declarations.
Its byte API intentionally retains an explicitly exported Buffer implementation.
See the [package README](packages/protocol/README.md).
This is a source-only release; it is not published to npm. To install a
local build in another project:

```sh
npm pack --workspace @aibrc/protocol
# Run in the consumer project with the actual generated file:
npm install ./aibrc-protocol-0.25.0.tgz
```

## Activation context

Every AIBRC state belongs to a Bitcoin network and a published rule context.
The network, starting block height and rule identity are recorded in
[config/release.json](config/release.json), so independent indexers can apply
the same rules to the same blocks.

<!-- AIBRC_RELEASE_CONTEXT -->

Name Policy V2 applies from the same starting height. Independent indexers pin
the network, rule identity and activation height before interpreting blocks.
Once activated, that release context is fixed. Synthetic vector heights remain
test data.

## Open source and trust

Code: [MIT](LICENSE-CODE), © AIBRC contributors. Specification and documentation: [CC0-1.0](LICENSE-DOCS).
[Third-party notices](THIRD_PARTY_NOTICES.md) preserve dependency licenses.

This repository contains the protocol specification, pure codec, state-validation core, test vectors and
whitepaper. Applications maintain their own execution systems and operations. Read the
[trust model](TRUST_MODEL.md) for verification assumptions and [contribution guide](CONTRIBUTING.md) to take part.

AIBRC is an open Web3 experiment, inspired by Bitcoin and the possibilities of the Agent era. Its future is
open to anyone who can build, implement, question or improve the rules. Read the [protocol statement](docs/99-closing.md).
