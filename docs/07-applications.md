# 07 · Applications and Economic Models

An open asset foundation becomes an ecosystem when people build useful things with it. Wallets make ownership
readable. Markets connect counterparties. Creators give assets meaning. Agents coordinate work, purchase
services and leave records another application can understand.

AIBRC brings these activities a shared language for assets, accounts and rules. Current components support
issuance, transfers and independently reproducible state. Proposed instructions add authority, conditions and
relationships; research explores the richer economies they could support.

## From common building blocks to useful products

| Layer | Applications | AIBRC's role | What remains to be built |
| --- | --- | --- | --- |
| Current foundations | Asset display, fixed-supply issuance, transfers, single-asset distributions, public data inspection | Current Deploy/Transfer rules, canonical state, decoder and the [reference RPC/SQLite indexer](run-indexer.md) | Wallet integration, configuration of the operator's Bitcoin node, product-specific interfaces and checks |
| Application-layer pilots | RFQ preparation, market-making assistants, LP risk analysis, paid analysis and verification, attributable work receipts | Existing assets and explicit application execution; signed off-chain records where appropriate | Actual delivery, custody or signing boundaries, inventory policy and exception handling |
| New protocol instructions | Agent Key, asset locks, multi-asset allocation, typed identity relationships and Living Asset state | Proposed grants, locks, bindings, statements and settlement conditions | Complete specifications, vectors, implementation, review and activation |
| Full financial infrastructure | Stable-value assets, collateralized lending, liquidation markets, BTC strategy treasuries and real-world claims | Asset identity and a possible rules substrate | Reserves, legal rights, data sources, liquidation or external funding and custody arrangements |

An application pilot can begin with current transfers, explicit operator responsibilities and signed service
records. Protocol extensions can move additional conditions into shared state once their rules and activation
are complete.

### From analysis to delegated execution

1. **Read, calculate and prepare.** Existing public API and MCP tools provide read-only inputs. An assistant
   can analyze a task, use the [R1 calculator](../reference/r1/README.md) to explain applicable fees and prepare
   an action for the user to review and sign in an application or wallet.
2. **Authorize a specific application task.** Scoped application credentials are the next development step:
   define permitted actions, assets, budgets, recipients and expiry, then check them at execution.
3. **Share authority through protocol rules.** Proposed [Agent Key](applications/04-delegated-agents.md) adds
   native delegated transfers; proposed settlement conditions address the evidence required for delivery.

This sequence lets a useful service find customers before adding continuous spending authority.

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

These references connect familiar Web3 ideas to AIBRC's building blocks. Their complete products require the
dependencies listed: a stable claim needs redemption and backing, a lending market needs pricing and
liquidation, and a real-world right needs an identifiable issuer and enforceable terms.

## Five businesses to build toward

### Market-making Agents

A holder wants an exact exchange; providers compete to supply it. Imagine an illustrative RFQ for 100 units
of one asset against 9,750 units of another. The provider's spread must cover network fees, execution and
inventory risk. A quoting Agent monitors prices and inventory; a constrained signing tool authorizes the
actual transaction. Asset-specific settlement conditions establish delivery.

The product is access to real liquidity. Its revenue comes from customers valuing a usable quote, not from
creating artificial volume. [The RFQ guide](applications/12-cross-protocol-rfq.md) develops the application path.

### Lending and risk services

A borrower uses capital; a lender supplies it; an operator monitors the conditions governing repayment or
liquidation. A risk Agent could help a user monitor collateral and prepare an authorized response. That is a
service with a customer and a cost of failure.

A native lending market is a research direction requiring collateral control, debt state, pricing,
liquidation and bad-debt rules. Proposed locks and conditional settlement are components of that design.
[Community capital](applications/07-treasuries.md) and [asset locks](applications/13-locks-and-vesting.md)
explain the relevant relationships.

### Liquidity and capital management

A liquidity provider supplies inventory to a market. An analysis Agent can explain exposure, fees and exit
conditions, then prepare an adjustment for approval. A management service earns by saving time or improving
execution; capital earns from the actual service it provides and bears its corresponding risks.

An AIBRC asset grant governs its specified L1 asset. Operating an application's LP position or native BTC
wallet needs the distinct authority for that system. A useful product can begin with analysis and clearly
approved actions before adding any new execution authority.

### Game-asset operations

A guild owns equipment; players need access; an operator coordinates use. An Agent could manage
availability, player credentials and agreed payments for a real game. The customer pays for play, access or
service, while the game supplies the demand behind those assets.

Identity relationships, usage rights and timed availability could connect these roles. The
[game guide](applications/11-games-and-recipes.md) explores their rules. A character with its own associated
history, equipment and operating role also connects to [Living Assets](applications/10-living-assets.md).

### Agent-to-Agent commerce

A wallet, merchant or research Agent can buy a data subscription, a reproducible state check or an analysis.
The supplier returns a result identifying its source, time, rule context and scope. Free public APIs remain
shared inputs; the paid service adds processing, verification, reliable delivery or support. A task or
subscription price pays for that work.

A research Agent can also take a customer's order, purchase data and verification from specialized services,
then deliver the finished analysis. Customer revenue pays the suppliers and funds the next job. When the
participants agree on one payment asset, a current AIBRC Transfer can allocate it to up to 25 recipients,
subject to its payload limit. A first product can settle each task or periodic batch with user approval.

BTC or an agreed asset pays for useful work. Proposed grants, identity relationships and receipts can make
repeated cooperation easier to operate and inspect. The
[task-market](applications/05-task-markets.md) and [Resident Agent](applications/06-resident-agent.md) guides
show how that loop could grow.

## Fourteen application guides

| Guide | Stage of the described capability | First useful deliverable |
| --- | --- | --- |
| [01 · Wallets and Asset Management](applications/01-wallets.md) | Live components | Explain an exact transfer before the user signs |
| [02 · Indexers, Explorers and Data Services](applications/02-indexers.md) | Live components | Return a result with its canonical-chain and rule context |
| [03 · Payments, Distribution and Stable-Value Assets](applications/03-payments.md) | Live payments; Proposed multi-asset; Research stable finance | Reconcile a single-asset distribution without double payment |
| [04 · Bounded Agent Assistants](applications/04-delegated-agents.md) | Current read-only tools; Proposed authorization | Prepare a specific service payment for user approval |
| [05 · Task Markets and Verifiable Receipts](applications/05-task-markets.md) | Application pilots; Proposed protocol receipts | Link a paid task to its delivery, acceptance and payment records |
| [06 · Bitcoin Resident Agent](applications/06-resident-agent.md) | Research | Operate one paid service with an explainable budget and handover |
| [07 · DAO and Community Treasuries](applications/07-treasuries.md) | Research | Compare approved budgets, transfers and delivery records |
| [08 · Identity, Credentials and Community Access](applications/08-identity.md) | Proposed | Verify who issued an eligibility claim and whether it remains valid |
| [09 · Collections and Distinct Digital Rights](applications/09-collections.md) | Proposed / Research | Identify a work and the specific entitlement linked to its asset |
| [10 · Living Assets](applications/10-living-assets.md) | Research | Demonstrate that a successor can continue a service |
| [11 · Games, Guilds and Asset Recipes](applications/11-games-and-recipes.md) | Research | Prove that a failed recipe has no protocol asset side effects |
| [12 · Cross-Protocol RFQ and Market-Making Agents](applications/12-cross-protocol-rfq.md) | Proposed / Research | Prepare an exact online exchange with identifiable settlement conditions |
| [13 · Locks, Vesting and Scheduled Payments](applications/13-locks-and-vesting.md) | Proposed | Calculate available amounts under explicit height conditions |
| [14 · Selective Disclosure and Lightweight Verification](applications/14-private-proofs.md) | Research | Verify one necessary property against a justified commitment |

## A sustainable economic loop

```text
A user has a real need
  → an application or Agent delivers a service
  → the result and receipt can be checked
  → the user pays and the provider earns
  → income funds computation, data and maintenance
  → the service can deliver again
```

Bitcoin supplies money and canonical transaction history. AIBRC supplies a common asset and rules vocabulary. Applications connect a specific demand with delivery and income. These roles complement each other; they do not require a new asset at every step.

Revenue may come from subscriptions, data access, software tools, inventory spreads or explicitly agreed application fees. Network fees pay Bitcoin miners. An application rule may allocate a fee to a creator or another defined recipient, but a protocol capability is not a promise that any asset holder receives revenue. The protocol layer does not impose a native token or a second gas asset.

An Agent's income must cover inference, data, execution, chain fees and support. Its asset's market price, a treasury's quoted value and realized operating income are different quantities. A busy market is not proof that the underlying service is profitable.

## The Bitcoin–Agent double helix

Bitcoin gives autonomous services money, settlement and a public history. Useful services bring demand for
payments, data, verification and more useful services. AIBRC's account and rule model can connect those two
sides into a reinforcing economy.

```text
Bitcoin · open money and verifiable history
  ↓ funds work
Agents · useful computation and coordination
  ↓ deliver services and earn income
Operating budgets · pay people, data and infrastructure
  ↓ sustain the next service
More activity settles and leaves evidence on Bitcoin
```

Consider a research Agent buying a dataset, paying a verification Agent to check it, then selling a useful
analysis. Service receipts explain what each participant supplied. Bounded grants limit operating authority;
clear accounting distinguishes revenue, expenses and available reserves. That is the economic loop worth
building: real work funds continued operation.

## Start small, leave room for an ecosystem

A first project can be a signing explainer, a paid data service, a community-budget viewer or a clearly scoped
Agent assistant. A creator can explore a collection with an explicit entitlement. A market builder can begin
with asset discovery and exact quotes.
