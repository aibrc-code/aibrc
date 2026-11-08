# 07 · Applications and Economic Models

An Agent can help a holder compare a trade with an LP adjustment, prepare a community's contributor
payments, or buy data and verification to finish a research task. Each starts with a useful job: save
someone time, help them make a decision, or deliver work they are willing to pay for.

AIBRC gives these services a shared language for assets, balances and rules. Wallets show what a person
holds. Markets connect counterparties. Smart Covenant gives applications public rules to work with.
Agents can bring those pieces together into a service with a customer, a budget and a checkable result.

## Five businesses to build toward

### Agent-to-Agent commerce

A customer asks a research Agent for an analysis. The Agent obtains a dataset from one provider, asks a
verification service to check the sources, then assembles the finished work. The customer pays for the
analysis; the Agent pays its suppliers and uses the remaining income to cover computation and support.

The same pattern can serve wallets and merchants: a reproducible state check, an explanation of a complex
transaction, or a report that combines several data sources. A provider earns by adding processing,
verification, reliable delivery or support to the available information. Public APIs remain shared inputs
to these products.

A first service can settle individual tasks or periodic batches after user approval. When providers accept
one AIBRC asset, a current Transfer can allocate that asset to up to 25 recipients within the payload limit.
The [task-market](applications/05-task-markets.md) and [Resident Agent](applications/06-resident-agent.md)
guides explore how specialized services could grow into a working supply chain.

### Liquidity and capital management

A holder wants help deciding whether to trade, add liquidity or reduce an existing position. An assistant
can compare exposure, applicable fees and exit conditions, then prepare an adjustment for the holder to
review. A useful report explains both the expected benefit and the cost of acting.

A service earns when people value that analysis, preparation or ongoing monitoring. A liquidity provider
supplies real inventory and receives the fees or returns defined by the market they use, alongside the
associated risks. The [bounded-assistant guide](applications/04-delegated-agents.md) connects these tasks
with explicit authority and user approval.

### Market-making Agents

A holder wants an exact exchange; providers compete to supply it. In an illustrative RFQ for 100 units of
one asset against 9,750 units of another, the provider's spread must cover network fees, execution and
inventory risk. A quoting Agent can monitor prices and inventory and prepare an offer for the provider's
signing system.

The customer pays for access to usable liquidity. The provider earns when its quotes and execution cover
their costs. [The RFQ guide](applications/12-cross-protocol-rfq.md) follows the offer, authorization and
asset-specific delivery conditions needed to make that service work.

### Lending and risk services

A borrower uses capital; a lender supplies it; an operator monitors repayment or liquidation conditions.
A risk Agent could help a user track collateral and prepare a response. That creates a service with an
identifiable customer, operating costs and a cost of failure.

A native lending market remains a research direction involving collateral control, debt state, pricing,
liquidation and bad-debt rules. [Community capital](applications/07-treasuries.md) and
[asset locks](applications/13-locks-and-vesting.md) explain the relationships that future designs can build on.

### Game-asset operations

A guild owns equipment; players need access; an operator coordinates its use. An Agent could help manage
availability, eligibility and agreed payments for a real game. Players pay for play, access or service,
giving the assets a purpose within that experience.

The [game guide](applications/11-games-and-recipes.md) explores ownership, usage rights and timed
availability. A character with its own history, equipment and operating role also connects to
[Living Assets](applications/10-living-assets.md).

## A sustainable economic loop

```text
A customer needs useful work
  → an application or Agent arranges delivery
  → the customer checks the result against the agreement
  → payment becomes the provider's revenue
  → revenue pays for data, verification, computation and support
  → the service has resources for its next job
```

A community can use the same loop to fund shared work. Its members approve a budget, an assistant prepares
contributor payments, and delivery records show what the spending achieved. An operating service can earn
from customers and return part of that revenue to the budget that sustains it.

Revenue may come from subscriptions, completed tasks, software tools, inventory spreads or agreed
application fees. Bitcoin miner fees, service charges and any selected asset-rule fee are separate costs.
Revenue allocation follows the published application rules and the actual rights attached to an asset.

Show realized income, expenses, available reserves and market valuation separately. That makes it possible
to see whether useful work covers the cost of running the service.

## The Bitcoin–Agent double helix

Bitcoin gives services money, settlement and a public history. Useful Agents create demand for data,
verification, payments and further services. AIBRC's balance and rule model can connect those activities
through interfaces that people and independent software can share.

```text
Bitcoin · open money and verifiable history
  ↓ funds work
Agents · useful computation and coordination
  ↓ deliver services and earn income
Operating budgets · pay people, data and infrastructure
  ↓ sustain the next service
Payments and records support the next round of cooperation
```

A research Agent purchasing data and paying a verification Agent is a small example of that relationship.
Each provider supplies something the next participant needs. Delivery records and clear accounting explain
how the customer payment becomes revenue, supplier income and a budget for continued operation.

## From common building blocks to useful products

The first useful product can begin with today's asset tools and user-approved actions. More independent
execution calls for explicit permissions and delivery conditions. This is the development map:

| Layer | Applications | AIBRC's role | What remains to be built |
| --- | --- | --- | --- |
| Current foundations | Asset display, fixed-supply issuance, transfers, single-asset distributions, public data inspection | Deploy/Transfer rules, canonical state, decoder and the [reference RPC/SQLite indexer](run-indexer.md) | Wallet integration, the operator's Bitcoin-node configuration and product interfaces |
| Application-layer pilots | Trading and LP assistants, community-budget preparation, paid analysis and verification | Existing assets, local R1 calculations, user approval and attributable application records | Delivery, signing boundaries, inventory policy and exception handling |
| New protocol instructions | Agent Key, asset locks, multi-asset allocation, typed relationships and Living Asset state | Proposed grants, locks, bindings, statements and settlement conditions | Specifications, vectors, implementation, review and activation |
| Full financial infrastructure | Stable-value assets, collateralized lending, liquidation markets and BTC strategy treasuries | Asset identity and a possible rules substrate | Reserves, legal rights, data sources, liquidation, funding and custody arrangements |

R1 is the **first-generation Smart Covenant rule template**. It publishes fee calculations, rule-fee
destinations and buyback plans that an application or Agent can calculate locally with the
[R1 reference](../reference/r1/README.md). An asset's selected version and parameters stay fixed.

R2 and R3 are possible names for later generations, with their scope still to be designed. Each published
version would need its own rules and reference identity, selected explicitly for new assets. Existing
assets retain the rules they selected. The [Smart Covenant chapter](04-smart-covenant.md) connects this
version path with the **15 future-topic directions** and their proposal entry points.

### From analysis to delegated execution

| Stage | What an Agent can work with | Who authorizes the action |
| --- | --- | --- |
| Current tools | Read-only public API/MCP inputs and local R1 calculations; prepare a trade, LP adjustment, payment or distribution | The user reviews and signs through the relevant application or wallet |
| Future application authorization | An application-defined mandate for actions, assets, budgets, recipients and expiry | The application's executor checks the mandate and the Agent's working credential |
| Proposed protocol Agent Key | A native grant for one asset, a cumulative allowance, valid block heights and confirmed revocation | The Agent signs with its own working key; shared protocol rules check the exact grant |

These stages have different scopes. Application LP positions and native BTC wallets need the authority
defined by their own systems. Native Agent Key's first proposal concerns the specified AIBRC asset and a
total allowance; additional recipient, price or periodic-budget restrictions require their own rules.

R1 supplies calculations, while the application handles pricing, execution, custody and locking. Service
delivery is accepted through the agreed check or reviewer and the relevant evidence. Future permission and
conditional-settlement rules can make more of those relationships explicit. The
[bounded-assistant](applications/04-delegated-agents.md) and [task-market](applications/05-task-markets.md)
guides develop the two paths.

## Web3 references mapped to AIBRC uses

| Familiar reference | AIBRC use | Core capabilities and dependencies |
| --- | --- | --- |
| DEX and professional RFQ | [Cross-protocol offers and market-making Agents](applications/12-cross-protocol-rfq.md) | Exact asset identification, inventory checks, signatures and per-leg settlement validation |
| USD and stable assets | [Reference-currency payments and stable-asset research](applications/03-payments.md) | Current transfers; reserves, redemption, collateral and data arrangements for an actual stable claim |
| Lending and collateral | [Treasury commitments](applications/07-treasuries.md) and [locks](applications/13-locks-and-vesting.md) | Debt state, prices and liquidation in addition to Proposed lock and conditional rules |
| BTC capital services | [Budgeted treasury operations](applications/07-treasuries.md) | Explicit business revenue and native BTC signing or funding arrangements |
| Liquidity and strategy vaults | [Bounded operators](applications/04-delegated-agents.md) and [RFQ providers](applications/12-cross-protocol-rfq.md) | Inventory, limited authority, return-path conditions and strategy accounting |
| DAO and community budgets | [Inspectable treasury spending](applications/07-treasuries.md) | Governance decisions, grants, reserved funds and delivery receipts |
| Games and GameFi | [Guild inventories, equipment use and recipes](applications/11-games-and-recipes.md) | Distinct ownership/use rights, bounded inventories and explicit game-state rules |
| NFTs and digital rights | [Collections and identifiable works](applications/09-collections.md) | Asset identity, content, collection relationships and clearly stated rights |
| Agent service economies | [Bounded assistants](applications/04-delegated-agents.md) and [paid work](applications/05-task-markets.md) | Identity, payments, evidence of delivery and limited execution authority |
| Living Assets | [Services that change hands](applications/10-living-assets.md) and [Resident Agents](applications/06-resident-agent.md) | Versioned content, authority replacement, a treasury and operational continuity |
| Bounties and conditional payment | [Task markets](applications/05-task-markets.md) | Task definition, reserved budget, acceptance and Proposed settlement conditions |
| Real-world asset claims | [Typed issuer statements](applications/08-identity.md) and [payment assets](applications/03-payments.md) | Identifiable issuer, enforceable rights, reserves or underlying property, redemption and records |
| Identity and privacy proofs | [Credentials](applications/08-identity.md) and [selective disclosure](applications/14-private-proofs.md) | Binding, revocation, a justified state commitment and the appropriate proof system |
| Creator and community economies | [Works and memberships](applications/09-collections.md), [distributions](applications/03-payments.md), [community budgets](applications/07-treasuries.md) | Clearly defined rights, allocation, service revenue and attributable expenditure |

These references connect familiar products to AIBRC's building blocks. Their dependencies explain the
work involved: a stable claim needs backing and redemption, a lending market needs pricing and liquidation,
and a real-world right needs an identifiable issuer and enforceable terms.

## Fourteen application guides

| Guide | Stage of the described capability | First useful deliverable |
| --- | --- | --- |
| [01 · Wallets and Asset Management](applications/01-wallets.md) | Live components | Explain an exact transfer before the user signs |
| [02 · Indexers, Explorers and Data Services](applications/02-indexers.md) | Live components | Return a result with its canonical-chain and rule context |
| [03 · Payments, Distribution and Stable-Value Assets](applications/03-payments.md) | Live payments; Proposed multi-asset; Research stable finance | Reconcile a single-asset distribution without double payment |
| [04 · Bounded Agent Assistants](applications/04-delegated-agents.md) | Current read/calculation tools; future application authorization; Proposed Agent Key | Prepare a specific service payment for user approval |
| [05 · Task Markets and Verifiable Receipts](applications/05-task-markets.md) | Application products to build; Proposed protocol receipts | Link a paid task to its delivery, acceptance and payment records |
| [06 · Bitcoin Resident Agent](applications/06-resident-agent.md) | Research | Operate one paid service with an explainable budget and handover |
| [07 · DAO and Community Treasuries](applications/07-treasuries.md) | Research | Compare approved budgets, transfers and delivery records |
| [08 · Identity, Credentials and Community Access](applications/08-identity.md) | Proposed | Verify who issued an eligibility claim and whether it remains valid |
| [09 · Collections and Distinct Digital Rights](applications/09-collections.md) | Proposed / Research | Identify a work and the specific entitlement linked to its asset |
| [10 · Living Assets](applications/10-living-assets.md) | Research | Demonstrate that a successor can continue a service |
| [11 · Games, Guilds and Asset Recipes](applications/11-games-and-recipes.md) | Research | Prove that a failed recipe has no protocol asset side effects |
| [12 · Cross-Protocol RFQ and Market-Making Agents](applications/12-cross-protocol-rfq.md) | Proposed / Research | Prepare an exact online exchange with identifiable settlement conditions |
| [13 · Locks, Vesting and Scheduled Payments](applications/13-locks-and-vesting.md) | Proposed | Calculate available amounts under explicit height conditions |
| [14 · Selective Disclosure and Lightweight Verification](applications/14-private-proofs.md) | Research | Verify one necessary property against a justified commitment |

## Start small, leave room for an ecosystem

Choose one customer and one useful result: explain a trade, review an LP position, prepare a community
distribution, or deliver a paid analysis. Make the price, cost and acceptance method understandable. A
service that customers use and can check gives the next wallet, application or Agent something useful to
build on.
