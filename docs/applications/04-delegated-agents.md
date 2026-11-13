# 04 · Bounded Agent Assistants

**Give Agents the Task. Put Boundaries in the Rules.**

A holder wants help comparing a trade with an LP adjustment. A community needs to pay contributors from
an approved budget. A researcher wants an assistant to find data, arrange a source check and prepare the
finished report. Each is a useful job for an Agent with a clear task and a visible cost.

Start with an assistant that gathers information, calculates applicable fees and prepares an action for
the user to review. A recurring service can then develop the explicit authority needed for routine work.
The owner keeps the owner key; a future authorized Agent operates through its own working key or scoped
application credential.

## Why it matters

Delegation makes sense when the work saved is worth more than the cost of supervising it. People already
give employees and service providers budgets and responsibilities. Software needs those permissions
expressed in a form its execution tools can check.

For an Agent, that means a task it can explain, spending authority its tools enforce, and records the
owner can inspect. Planning, approval and actual spending each have a clear place in the workflow.

## A practical example

A community approves a week's research budget. Its assistant compares data providers, prepares payments
for contributors and schedules a verification service for the final report. The budget owner sees the
supplier, deliverable, price and payment asset before approving the actions. Delivery records link each
payment to the work it funded.

The same pattern supports several first products:

| Job | What the assistant prepares | What the user reviews |
| --- | --- | --- |
| Trading or LP support | An exposure comparison, applicable fees and a proposed adjustment | The market, amount, expected effect and actual transaction |
| Community distribution | Contributor allocations tied to an approved budget | Recipients, amounts and the work being funded |
| Service procurement | Data, verification or research orders with defined deliverables | Suppliers, total cost and acceptance terms |

A later application mandate could let an Agent repeat defined purchases within an agreed budget and
expiry. The customer would retain a clear view of spending while routine work takes fewer manual steps.

## Who pays, who earns

An assistant can earn from preparing useful decisions, coordinating a distribution or delivering a
finished analysis. Data and verification providers receive the agreed price for their part of the work.
The assistant's revenue pays those suppliers, computation, execution and support costs.

For a customer, the value is the time saved and the quality of the result. For a service operator, a
sustainable product is one whose income covers the real cost of delivering it again.

## How AIBRC fits

The stages of authority are:

| Stage | Authority | Useful outcome |
| --- | --- | --- |
| Current tools and user approval | Public API/MCP reads and [local R1 calculations](../../reference/r1/README.md); the user signs the action in an application or wallet | Explain a purchase, trade or LP adjustment and prepare it for review |
| Future application authorization | An application-defined mandate checked at execution, using an Agent's working credential | Repeat specified actions within the application's budget and other agreed limits |
| Proposed Agent Key | A native grant for one AIBRC asset, a cumulative allowance, valid heights and confirmed revocation; the Agent signs with its own key | Transfer the specified asset under conditions shared protocol implementations can check |

R1 is the first-generation Smart Covenant rule template. It gives the assistant a public fee calculation
to reuse. R2 and R3 are possible later versions, each requiring its own published rules and reference
identity for new assets that select it. Existing assets keep their selected rules. The
[Smart Covenant chapter](../04-smart-covenant.md) explains the version path and its 15 future-topic directions.

[AIP-0001](../../proposals/AIP-0001-delegation-v1.md) develops the native Agent Key proposal. Its scoped
authority draws on the wallet-execution permission model discussed in
[ERC-7715](https://eips.ethereum.org/EIPS/eip-7715), adapted to AIBRC asset rules and Bitcoin block heights.

```text
Owner defines the asset, total allowance and valid heights
  → owner signs the grant
  → grant enters canonical state
  → Agent's own working key authorizes a delegated transfer
  → checks cover the exact grant, available balance and remaining allowance
  → confirmed execution reduces the balance and allowance
```

### Agent Key example · AIP-0001 proposal

| Permission | Example |
| --- | --- |
| **Who can act** | Address A grants authority to address B. B signs with its own key. |
| **Which asset** | Asset X |
| **Total allowance** | Up to 1,000 units of X across the grant |
| **Block window** | Heights 950,000–954,320 in this example |
| **Revocation** | A revokes the grant. The revocation takes effect when confirmed. |

## Building the first version

Keep permission checks at the actual execution boundary. An application mandate needs its defined action
scope, balance and budget checks, expiry, revocation and durable operation identities. When a payment result
is unknown, look up the original operation before deciding whether another payment is needed.

Native Agent Key's first proposal covers one asset and a total lifetime allowance. Each grant has a unique
identity and an owner permission-generation context; confirmed canonical state determines revocation.
The allowance is a spending limit rather than reserved funds, so a valid remaining grant can also apply
to later deposits. Periodic budgets, recipient or price restrictions, and a requirement to return sale
proceeds need separately specified rules. Application LP positions and native BTC wallets have their own
authority systems.

R1 calculates fees and plans. The application handles prices, trades and custody; the agreed reviewer or
acceptance check evaluates service delivery. Native grants additionally need consistent interpretation
across canonical state, hashes, snapshots, undo, replay, wallets and signing tools, including after a
restart or reorganization. These are the implementation responsibilities behind the permission model.

`grantId + ownerPermitNonce + remaining allowance + height bounds`.

## Where it can lead

Begin with one well-defined service: a trade or LP review, a community distribution, or a research order.
Establish the customer, delivery and payment records, then develop the authority needed to repeat that
workflow. An Agent that can pay useful specialists and earn from finished work becomes a participant in a
service economy with an explainable operating budget.
