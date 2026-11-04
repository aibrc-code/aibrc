# AIBRC · Covenant Inscription

**Connect Bitcoin assets. Make Bitcoin a foundation for Agent assets and exchange.**

AIBRC establishes a unified protocol, asset and account standard for the Bitcoin ecosystem: a shared
application language and open infrastructure. Smart Covenant connects asset rules with native
programmability and EVM extensions. Bitcoin L1 provides the transactions, canonical ordering and settlement
history from which independent software can reproduce asset state.

Bitcoin's culture begins with open rules and the ability to verify them. AIBRC carries that instinct into
five connected areas: ecosystems, Agents, people, economic activity and independent verification.

```text
People and Agents express an intent
  ↓
Wallets and applications prepare and authorize it
  ↓
AIBRC · assets, accounts and Smart Covenant
  ↓
Bitcoin L1 · transactions and canonical history
  ↓
Independent indexers derive the asset result
```

Current core rules, application examples, AIPs and research are listed in the
[capability map](../README.md#current-core-and-protocol-evolution).

## Ecosystems: many protocols, one interaction language

**The friction:** a community can share a culture while its wallets, asset rules and markets remain separated
across protocols. Every application then spends more effort rebuilding adapters.

AIBRC supplies a common asset and script-account model. Shared-root issuance, demonstrated by the first
application, gives AIBRC, BRC-20 and Runes issuance paths a verifiable common origin. Smart Covenant identifies
application rules and external references. Together these form a foundation for connected interfaces and markets.

The useful parallel is [ERC's shared token interface](https://eips.ethereum.org/EIPS/eip-20): wallets and
applications gain something reusable. AIBRC follows that principle on Bitcoin while retaining each external
protocol's own asset identity and validation.

```text
A shared Bitcoin root
  ├─ AIBRC · Covenant Inscription
  ├─ BRC-20 · inscription path
  └─ Runes · etching path
       ↓
Shared origin + protocol-specific interpretation
       ↓
Wallets · quotes · markets · Agents
```

A future exchange application could let a holder request one exact asset for another, receive competing
quotes and authorize the agreed exchange. An online provider contributes real inventory; asset-specific
checks establish delivery. The direction is read and route, quote and exchange, then broader market
collaboration through proposed settlement conditions.

**Technical line:** `shared origin + exact asset IDs + native validators → common interaction`.

Read [shared-root issuance and cross-protocol settlement](05-cross-protocol.md).

## Agents: a mandate instead of the owner key

**The friction:** useful automation needs permission to act, while an owner needs control over what it may spend.

AIBRC's current authorization model identifies which Bitcoin input authorizes an asset operation. Proposed
[Agent Key](04-smart-covenant.md#agent-key-delegate-authority-without-handing-a-model-the-owner-key) extends
that foundation to a grant: authorize an Agent or another script account for a specified asset, total
allowance and block-height interval. The owner keeps the owner key; the delegate operates with its own key.

This brings a smart-account-style delegation relationship to Bitcoin-native protocol assets. Comparable
[smart-account modules](https://docs.safe.global/advanced/smart-account-modules) illustrate why separate
execution authority is useful. AIBRC's proposal expresses its own authority and state rules rather than
importing another chain's contract environment.

For example, a community holding 10,000 asset units could authorize an operating Agent to spend at most
1,000 during a defined height interval. A data supplier receives payment for work; members can inspect the
grant and transfers. Additional conditions for recipients or delivery are separate Smart Covenant extensions.

```text
Community owner
  ↓ approves asset + total allowance + valid heights
Agent's working key
  ↓ prepares and signs permitted transfers
Service providers
  ↓ deliver data, tools or other agreed work
Receipts and records support review
```

The same foundation could support market operators, treasury assistants and Agents purchasing services from
one another. Identity, attestations and conditional settlement develop that path toward a wider economic loop.

**Rule sketch · proposal:** `grantId + owner permission generation + asset + allowance + height bounds`.

## People: one account, several native assets

**The friction:** an asset action is harder to explain when users must also track which particular BTC output
carries the asset and which leftover output preserves it.

A Covenant Inscription balance belongs to the script-derived account. Ordinary BTC spending does not move
that balance simply by consuming a UTXO. A Transfer specifies the asset and the quantities allocated to
recipient outputs; the remaining asset balance stays with its account.

```text
One supported Bitcoin script account
  ├─ AIBRC asset A balance
  ├─ AIBRC asset B balance
  └─ AIBRC asset C balance

Send part of A → recipient receives the allocation
                original account keeps the remainder
```

This gives Bitcoin assets the balance-oriented interaction familiar from account-based applications. BTC
still uses UTXOs for transaction funding and network fees. External BRC-20 and Runes balances retain their
native models and can be presented alongside AIBRC through common interfaces.

Current Transfer can allocate one asset to up to 25 entries within the payload limit. Proposed multi-asset
operations, locks and delegation extend the workflow toward richer asset interactions. A wallet could explain
“send 2,000 to B and 3,000 to C,” prepare the exact transaction and verify its result after confirmation.

Supported mainnet scripts are **P2TR/Taproot** (`bc1p…`) and **P2WPKH/single-key Native SegWit** (`bc1q…`).
Actual script bytes determine support; some `bc1q…` addresses represent other scripts. The
[account chapter](02-protocol-model.md#supported-mainnet-addresses) explains account identity and authorization.

**Technical line:** `account = TaggedHash("AIBRC/account/v1", scriptPubKey)`.

## Economics: bring real work and capital into the loop

**The friction:** an asset launch can attract attention without establishing who pays for a service, who
supplies capital or how the next round of work is funded.

Current assets and transfers provide a common economic base. Smart Covenant application rules, followed by
proposed grants, locks, receipts and conditions, create paths toward familiar Web3 businesses on Bitcoin.
The opportunity is to connect participants with actual roles and revenue.

| Business | A practical Bitcoin-oriented scenario | Who pays and who earns | Development path |
| --- | --- | --- | --- |
| Market making | Several providers quote an exact cross-protocol exchange from their inventories | Traders pay a spread; providers manage execution and inventory risk | Read-only discovery and online quotes, then conditional settlement |
| Lending and risk management | A service monitors collateral and prepares permitted repayment or liquidation actions | Borrowers pay financing costs; operators earn for the service they provide | Research with debt, pricing, collateral control and liquidation rules |
| Asset and liquidity management | An Agent explains positions and prepares approved adjustments | Users pay for useful analysis or management; capital supplies an actual market service | Analysis first, then independently scoped operating authority |
| Game-asset operations | A guild manages equipment and player access through explicit usage rights | Players and game customers fund the activity; owners and operators supply assets and work | Research combining identity, rights, locks and game integration |
| Agent-to-Agent commerce | A research Agent buys data and a verification Agent checks it | Customers pay for results; service revenue funds compute and maintenance | Paid services and receipts, followed by bounded delegation |

For example, a quote provider buys a fresh asset-validity check before offering an exchange. The data service
earns for reducing execution errors; its income pays for continued indexing. That useful purchase can create
demand for verification, payment tools and additional services around it.

```text
Real demand → service or liquidity → payment
  → checkable delivery → operating income
  → computation, data and maintenance → more useful work
```

Bitcoin supplies money and a verifiable history. Agents supply computation and coordination. AIBRC connects
asset identities, rules and authority: the foundations of a Bitcoin–Agent double helix. The
[application guides](07-applications.md) develop these businesses and their dependencies.

**Economic line:** `customer value → payment → delivery evidence → revenue → next service`.

## Indexing: let every terminal become a verifier

**The friction:** a balance page is convenient, but a person should also have a path to check how that balance
was calculated and compare it with another implementation.

**Don't trust, verify.**

AIBRC's current core derives asset state from canonical Bitcoin transactions and produces a canonical state
hash. Independent indexers can compare the same block and rule context, locate a disagreement and recompute
it. This makes open verification part of the asset foundation.

Proposed Merkle proofs take the next step toward light clients: a wallet or personal Agent could verify an
account record against an accepted root without downloading the whole state. The reference uses a separate
proof format; its size and root-acceptance conditions are explained in [extensions](08-extensions.md).
Compact, kilobyte-scale verification is the research direction, not a fixed-size promise for today's state hash.

```text
Bitcoin blocks + AIBRC rules
  ├─ Independent indexer A
  ├─ Independent indexer B
  └─ Independent indexer C
       ↓ compare the same block and commitment
Wallet · personal terminal · Agent
       ↓ proposed local proof
Check the account record that matters
```

The analogy is a state proof or light client: the device checks a defined cryptographic statement with its
chain context. An Agent can help obtain evidence, run deterministic tools and explain the result. The
calculation, rather than the model's confidence, supplies the verification.

**Current line:** `same canonical blocks + same rules → same stateHash`.

**Proof sketch · proposed:** `accepted root + account record + proof → verify`.

## The language that connects the five

| Term | Why it matters |
| --- | --- |
| **Covenant Inscription** | A Bitcoin-native asset expressed through AIBRC's instructions and script-account balances |
| **Unified protocol** | Gives independent implementations the same asset rules to interpret |
| **Account abstraction** | Separates protocol asset balances from BTC UTXO inventory and makes authority explicit |
| **Shared application language** | Lets wallets, markets and Agents build reusable interactions |
| **Smart Covenant** | Connects identified rules, parameters, authority and the executor responsible for applying them |
| **Shared-root issuance** | Preserves a verifiable common origin across different issuance standards |
| **Agent Key** | Proposes a limited operating mandate without sharing the owner key |
| **Open verification** | Gives every result a path back to public rules, data and reproducible calculation |
| **Bitcoin–Agent double helix** | Connects open money and verifiable history with useful services and sustainable operating demand |

Continue with the [background](01-introduction.md), [account model](02-protocol-model.md),
[Smart Covenant](04-smart-covenant.md), [protocol statement](99-closing.md) or
[glossary](glossary.md).
