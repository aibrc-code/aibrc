# AIBRC

## From Assets in Your Address to an Agent Economy on Bitcoin

### Independent Protocols. Shared Foundations.

Bitcoin keeps inspiring new protocols, each bringing its own asset rules, wallet tools and application
stack. Every new protocol can mean another round of integration work, making it harder for the ecosystem
to build on what already exists.

AIBRC (Covenant Inscription) aims to establish common standards for assets, accounts and Agent applications.
Protocols keep their native rules, while wallets, applications and Agents gain a shared interaction
language and reusable infrastructure.

Blockchain ecosystems have shown what shared standards make possible: common asset interfaces and execution
conventions let wallets, developer tools, markets and application frameworks build on one another.
[ERC-20](https://eips.ethereum.org/EIPS/eip-20) is a familiar example. An ecosystem grows through the tools and
applications that people can reuse, combine and extend.

AIBRC brings that ambition to Bitcoin. The goal is to connect BRC-20, Runes and future protocols through
shared ways to read, describe and interact with assets, laying the groundwork for cross-protocol markets,
Agent collaboration and shared infrastructure.

### Assets Live in Your Address

AIBRC draws on the account-balance model and common asset interfaces familiar from other blockchain
ecosystems. Native AIBRC assets are recorded as balances on accounts derived from Bitcoin addresses.

**One address can hold multiple AIBRC assets. Assets are not tied to individual satoshis, and there is no
need to keep a separate carrier UTXO for each balance.**

```text
Bitcoin address
  ↓ corresponding scriptPubKey
AIBRC account
  ├─ Asset A balance
  ├─ Asset B balance
  └─ Asset C balance
```

To transfer assets, the sender specifies the asset, amount and recipient, then authorizes the operation
with an eligible Bitcoin input. Indexers apply the public authorization and balance rules before updating
both accounts. There is no need to locate a particular UTXO carrying those tokens.

An ordinary BTC payment does not automatically move the AIBRC balance held by the same account. Asset
transfers require a valid instruction. Bitcoin inputs, recipient outputs, change and miner fees continue
to follow Bitcoin's transaction rules. AIBRC separates asset accounting from BTC coin selection, reducing
the extra work of managing asset carriers, splits and tracking.

### Smart Covenant: Rules Applications Can Share

**Let Agents work with assets, budgets and clear rules.**

An Agent preparing a service purchase needs to know which asset to use, what the operation costs and how
to check the result. Smart Covenant connects those tasks with public rules that applications can share.
Developers reuse the calculations; Agents use them to explain costs and prepare actions for approval.

**R1 is the first fixed rule template.** An asset selects its rule version, fee rate and fee destination
at creation. R1 supplies the public calculations for those fees, their destination and buyback plans.
The same inputs produce the same rule results on another developer's machine or an Agent's own tool.

AiBTC is the first application infrastructure to put this foundation to work in trading and liquidity.
Its Instant path supports continuous interaction without a Bitcoin transaction or EVM call for each fill;
its Block Swap path uses the user's wallet signature and Bitcoin confirmation.

```text
AIBRC asset + fixed R1 parameters
  ↓
Public calculation standard
  ↓
Application execution
  ├─ Instant trade → execution and account record
  └─ Block Swap → wallet signature → confirmation
  ↓
Execution records for queries and verification
```

> **Built to evolve.** R1 is the starting template. Future R2, R3 and later templates can add new rules
> under their own identities. R1's immutable on-chain reference text already names **15 extension
> directions**, including Agents, x402 payments, automatic liquidity, dividends, airdrops, DAO governance
> and oracles. Explore the [15 directions](docs/04-smart-covenant.md#built-to-evolve-r1-r2-and-beyond) and the
> [seven protocol proposals](docs/08-extensions.md#seven-proposals-one-shared-foundation).

The [R1 reference](reference/r1/README.md) includes the frozen Solidity source, ABI, test vectors and
dependency-free Node examples. Calculate a rule result and check the reference vectors:

```sh
node reference/r1/example.mjs
node reference/r1/check-vectors.mjs
```

Explore [Smart Covenant](docs/04-smart-covenant.md) through Agent tasks, trading and liquidity,
external application connections and the code behind the rules.

An asset can choose [X1](docs/04-smart-covenant.md#x1-connect-a-bitcoin-asset-with-an-evm-application)
to identify an external application by chain ID and contract address. Builders can use familiar EVM
interfaces and RPC tools to read that application's exposed rules and state, then build related service
views or actions. Bitcoin asset discovery gains an entry point into existing application infrastructure.

### A Shared Account Foundation for Agents

Consistent account derivation, amount units, instruction encoding and authorization checks give wallets and Agents a shared interface for working with assets.
Combined with public rule calculations and verifiable records, that interface gives builders a reusable workflow: read asset state, compute rule outcomes, prepare actions and verify results, connecting Bitcoin assets to an economy of tasks and services.

Start with work people value: explain a trade's cost, organize a community distribution or prepare a data
purchase. Existing public interfaces, account transfers and local R1 calculations give builders the pieces
to make those assistants. The user reviews the actual operation through an application or wallet.

**Next: Agent Key.** The proposal lets an owner authorize a specified asset, total allowance and valid
block range. The Agent uses its own working key for authorized transfers while the owner keeps the owner key.

**The Agent Key delegation proposal draws on the scoped wallet-execution permission model discussed in
[ERC-7715](https://eips.ethereum.org/EIPS/eip-7715), adapted to Bitcoin block heights and AIBRC asset rules.**

```text
Owner sets permissions
  ↓ asset · allowance · valid block range
Agent executes with its own key
  ↓
Service payments · task settlement · asset distribution
  ↓
Results checked against protocol rules
```

A research Agent can earn for a finished analysis, buy data and verification from other providers, then
use that income to fund the next job. Account transfers provide the payment foundation. Scoped authority
and settlement proposals develop the rules for repeating that collaboration across applications.

### Run Your Own Indexer. Verify Your Own Ledger.

Shared standards also allow different participants to compute the ledger independently.

AIBRC provides public rules, reference code, test vectors and a [standalone indexer package](packages/indexer/README.md).
People, developers and Agents can read blocks from their own Bitcoin nodes, reconstruct assets and balances
under the same rules, and compare results for the same canonical chain state.

```text
The same Bitcoin blocks
  + the same protocol rules
  ↓
Independently reproducible asset state and ledger hash
```

Wallets can choose their data provider. Applications can run their own indexers. Communities can check the
results. Using and verifying the protocol does not require permission from any one platform.

**Don't trust, verify.**

## Protocol at a Glance

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
Application verification: [AiBTC trade records and liquidity-pool reserves (from the proof log)](https://github.com/aibtcbot/aibtcbot/tree/main/docs/verification).

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
| How do I calculate R1 fees locally? | [R1 source, ABI and runnable examples](reference/r1/README.md) |
| How do different asset standards connect? | [Shared-root issuance and settlement](docs/05-cross-protocol.md) |
| How can I run my own indexer? | [Run your own indexer](docs/run-indexer.md) · [Implementation guide](docs/06-indexer-guide.md) · [Test vectors](vectors/README.md) |
| What can developers and Agents build? | [Applications and economic loops](docs/07-applications.md) |
| How does the protocol evolve? | [Extensions](docs/08-extensions.md) · [Seven AIPs](proposals/README.md) · [Merkle reference](merkle/STATE_PROOF_REFERENCE.md) |
| Where do I find exact terminology? | [Glossary](docs/glossary.md) |

## Run your own ledger

The [reference indexer](packages/indexer/README.md) reads your Bitcoin Core node,
replays AIBRC rules and keeps assets, balances and transfer history in your own
SQLite database. No platform backend or private key is required.

AI reading budget: spec/ + packages/protocol/src + packages/indexer/src = 367,814 bytes, about 92k tokens. An AI can read the whole protocol, its codec and its reference indexer in one context window.
```text
Your Bitcoin node → public AIBRC rules → your local ledger
                                           ↓
                                Wallets · applications · Agents
```

With Node.js 22.16+, build this repository and try the isolated walkthrough:

```sh
npm ci --ignore-scripts
npm run build
npm run indexer:demo
npm run test:indexer
```

The walkthrough uses synthetic local blocks and real SQLite, with no signing or
broadcasting. For your own Bitcoin node, follow the
[human and AI runbook](docs/run-indexer.md). Mainnet uses the published release
context and refuses to start while its genesis height is unselected.

With a configured local index, use `incoming` for recipient allocations,
`balance` for one asset and account, and `state-at` for a stored block fingerprint.
`serve` offers the same queries over loopback HTTP by default. The
[query guide](docs/run-indexer.md#4-synchronize-and-query) lists the commands and routes.

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

The core operation is a short SDK call. These excerpts share the imports and
values in the [common setup](docs/quickstart.md#shared-setup): `network`,
`namePolicy`, `UNIT` and the asset's actual `assetLocator`.

**Deploy a fixed-supply asset:**

<!-- snippet: deploy -->
```js
const payload = encodeDeploy({
  network, name: 'DEMO',
  totalSupply: 1_000_000n * UNIT,
  deployAuthInputIndex: 0, ownerOutputIndex: 1,
}, namePolicy);
```

**Transfer to a receiver output:**

<!-- snippet: transfer-single -->
```js
const payload = encodeTransfer({
  network, authInputIndex: 0,
  assetLocator,
  allocations: [{ receiverOutputIndex: 1, amount: 10n * UNIT }],
});
```

For multiple recipients, add allocations with their own output index and amount.
[Batch transfers, decoding and state hashing](docs/quickstart.md) use the same SDK;
[complete runnable files](examples/README.md) include the full setup and output.

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

This repository contains the protocol specification, pure codec, state-validation core, reference indexer,
R1 calculation reference, test vectors and whitepaper. Applications maintain their own execution systems and operations. Read the
[trust model](TRUST_MODEL.md) for verification assumptions and [contribution guide](CONTRIBUTING.md) to take part.

AIBRC is an open Web3 experiment, inspired by Bitcoin and the possibilities of the Agent era. Its future is
open to anyone who can build, implement, question or improve the rules. Read the [protocol statement](docs/99-closing.md).
