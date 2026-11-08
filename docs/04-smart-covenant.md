# 04 · Smart Covenant: programmable rules for Bitcoin assets

Ask an Agent to find a useful dataset, compare its price, check the result and prepare the payment.
Or ask it to watch a market, explain the fees and bring you an action ready for approval.
Both tasks become easier when assets, rules and payments speak a common language.

**Let assets carry rules. Let Agents work together.**

AIBRC records native assets as balances on accounts derived from Bitcoin addresses. Software works with
an asset, an amount and a recipient. Smart Covenant connects that foundation with public rules that
applications can reuse and Agents can calculate locally.

| On this page | What it means |
| --- | --- |
| **Current foundation** | Native Deploy and Transfer, reproducible asset state and R1's public fee, destination and buyback-plan calculations |
| **Application example** | AiBTC, the first application infrastructure using these rules for trading and liquidity, with Instant and Block Swap paths |
| **Extension path** | Scoped application authorization, proposed native Agent Key and further rule templates, supported by the proposals and research below |

## From an intention to an explicit rule

An Agent should spend its effort on the task: which service to buy, which result to check or which action
to recommend. Common asset rules reduce the work of translating between wallets and applications.

- **Work from balances.** Name the asset, quantity and destination without locating a particular token-carrying UTXO.
- **Calculate before acting.** Reuse public mathematics to explain applicable fees and compare results with the inputs used.
- **Build on shared rules.** A wallet, service or independent application can implement the same calculation standard.
- **Reuse mature tools.** Developers can use ABIs, RPC interfaces and established EVM tools to build adapters for identified contracts.
- **Turn useful work into income.** Connect a customer's request to delivery, payment and the next service the Agent needs.

```text
Task -> asset and amount -> public rule -> prepared action
     -> user approval and signing -> result and receipt
```

An assistant can begin with existing read-only API and MCP tools, local calculations and an application or
wallet where the user reviews and signs. Each useful workflow can establish the mandate it needs next.

## Three ways to put an Agent to work

### A market and liquidity assistant

An Agent reads market data and information supplied by its user, compares an opportunity and calculates
the applicable R1 fees. It can explain an LP position's exposure or prepare a trade for review. The user
gets a clearer decision and less repetitive preparation; an operator can earn for analysis and useful tooling.

```text
Market information -> analysis and fee calculation -> user reviews an action
```

### A paid data or verification service

A wallet, merchant or another Agent buys a reproducible state check, a research result or a data
subscription. The supplier identifies the source, rule context and scope of its answer. Free public APIs
can supply shared inputs; customers pay for the additional analysis, check, delivery service or support.

```text
Customer request -> defined check or analysis -> accepted result -> service income
```

### An Agent that hires other Agents

A research Agent takes a customer's order, buys data from one service and pays another to check it.
It delivers the finished analysis and uses the customer's payment to pay its suppliers. Participants
accepting the same asset can group their payments into an AIBRC distribution for the user to review.

```text
Customer order -> data service + verification service -> finished work
               -> customer pays -> suppliers earn -> next job
```

These loops give computation, data and coordination a paying customer. The
[application guides](07-applications.md) develop the products; the
[task-market guide](applications/05-task-markets.md) follows delivery and receipts.

## R1: an identifiable Covenant Inscription rule template

R1 makes three calculations public: how much a trade pays in fees, where its rule fee goes and what
buyback plan follows from an available balance. At creation, an asset selects the R1 version, reference
address, fee rate `T` and destination `C`. Those parameters stay fixed for that asset.

An asset can select zero rule fee, allocate its rule fee to the creator, or allocate it to buyback and
permanent locking. The platform base fee is separate. Applications use the same mathematics locally,
so a calculation can be reused by developers, wallets and Agents without an EVM transaction for each trade.

AiBTC connects the rules to two trading paths. **Instant** supports continuous interaction through the
application ledger. **Block Swap** uses a transaction signed by the user's wallet and confirmed on Bitcoin.
Each path uses the calculation standard for the applicable fees and leaves execution records for inspection.

```text
Asset + fixed R1 version and parameters
  -> public calculation
  -> application execution
       |-- Instant -> execution and accounting
       |-- Block Swap -> wallet signs -> Bitcoin confirms
  -> execution records and rule results
```

The [R1 calculation reference](../reference/r1/README.md) gives builders a runnable starting point.
Its [frozen rule text](../spec/covenants/R1.md) preserves the exact public wording and identity.

<a id="x1-a-reference-not-remote-execution"></a>

## X1: connect a Bitcoin asset with an EVM application

An asset can select X1 when it needs an external application reference. A public chain ID and contract
address give its Bitcoin record a precise coordinate in the EVM ecosystem. An Agent can choose the right
network and contract to read an interface, inspect published rules or query available state. Developers can
reuse an ABI, RPC provider and familiar public-chain tools to build an adapter around that relationship.

For example, a community could associate its Bitcoin asset with a game's EVM membership contract. A wallet
could show the associated game service; an Agent could read membership terms or expiry information and
explain them to the user. An adapter could then prepare a membership action for review, with eligibility,
execution and any payment conditions defined for that service.

```text
Bitcoin asset -> X1: chain ID + contract address -> Agent reads the EVM service
              -> application adapter -> service view or action for user review
```

The [X1 specification](../spec/covenants/X1.md) defines the current reference format. The coordinate is the
starting point; adapters connect it to a useful service and the conditions that service requires.

## Different Bitcoin programmability routes

The comparison starts with an Agent's task. The first two route groups describe native protocol mechanisms;
the final column combines AIBRC and R1 with the AiBTC application example.

| An Agent needs to... | [Runes](https://docs.ordinals.com/runes.html) / [ARC-20](https://github.com/atomicals-community/atomicals-guide/blob/main/arc20-tokens/README.md) native routes | [BRC2.0](https://github.com/bestinslot-xyz/brc20-proposals/blob/main/000-programmable-module/index.md) / [Alkanes](https://github.com/kungfuflex/alkanes-rs/blob/main/README.md) contract routes | AIBRC + R1 / AiBTC |
| --- | --- | --- | --- |
| Manage assets and payments | Track asset-carrying UTXOs and output-allocation rules | Work with the contract or module's asset state and interfaces | Use account balances, asset, amount and recipient; reduce tracking of specific token carriers |
| Use economic rules | Applications define service and trading policies around the asset rules | Express policies through contract interfaces and VM execution | Reuse R1 locally for fees, fee destinations and buyback plans; calculate applicable amounts before acting |
| Interact continuously | Native writes use Bitcoin transactions | Native contract writes use Bitcoin transactions and indexed execution | Native Transfer uses Bitcoin; AiBTC adds Instant interaction without a chain transaction per fill, alongside wallet-signed Block Swap |
| Extend operating authority | Wallet and application policies organize delegated actions | The chosen contract design defines permissions | Start with user-reviewed actions, develop scoped application mandates, then proposed native Agent Key |

Runes and ARC-20 provide defined asset rules; BRC2.0 and Alkanes offer broader contract execution.
AIBRC focuses on common asset interfaces and reusable rules that applications can turn into useful Agent
workflows.

## Built to evolve: R1, R2 and beyond

**R1 is the first fixed rule template.** Future templates such as R2 or R3 can develop new behaviors with
their own version, reference address and explicit parameters. Each template keeps a clear identity that
applications and Agents can recognize and reuse.

The immutable R1 reference published on EVM chains includes a frozen text naming **15 extension directions**.
`inscriptionText()` exposes that text, and its published hash identifies the exact bytes. This directory
gives builders a visible starting point for the next generation of applications.

**Expansion directions · proposals and application research**

### Agents and services

[AI Agents](../proposals/AIP-0001-delegation-v1.md) ·
[Language-model integration](applications/06-resident-agent.md) ·
[x402 payments](applications/05-task-markets.md) ·
[External receipts](../proposals/AIP-0005-attest.md) ·
[External wallet claims](../proposals/AIP-0004-bind.md)

### Markets and communities

[Governance](applications/07-treasuries.md) ·
[Dividends](applications/03-payments.md) ·
[Automatic liquidity](applications/12-cross-protocol-rfq.md) ·
[Airdrops](applications/03-payments.md) ·
[Mission vault](applications/07-treasuries.md)

### Application connections

[Stocks / RWA](applications/08-identity.md) ·
[Certified external contracts](applications/08-identity.md) ·
[Satellite tokens](applications/09-collections.md) ·
[Bridges](05-cross-protocol.md) ·
[Oracles](applications/03-payments.md)

The [proposal index](../proposals/README.md) collects the seven AIPs. The
[extensions chapter](08-extensions.md) connects those proposals with current components and research.

## Agent Key: give an Agent a clear mandate

**Give Agents the Task. Put Boundaries in the Rules.**

The development path starts with useful analysis and user-approved actions, then adds scoped application
authority. The native Agent Key proposal makes a mandate part of shared AIBRC rules: the owner selects an
asset, a cumulative allowance and a valid block range; the Agent acts with its own working key.

```text
Read and prepare -> user reviews and signs
  -> scoped application mandate
  -> proposed native Agent Key and defined settlement conditions
```

A community could give an operator a limited service budget while retaining its main key. Independent
software could check each delegated transfer against both the available balance and remaining allowance.
The [bounded-assistant guide](applications/04-delegated-agents.md) follows this path from a practical task.

### Conditions: connect payment with delivery

A service purchase links spending with something the customer wants to receive. An agreed dataset,
reproducible result or explicitly evaluated deliverable gives that relationship a concrete meaning.
[AIP-0007](../proposals/AIP-0007-conditional.md) explores deterministic settlement conditions; the
[task-market guide](applications/05-task-markets.md) explains acceptance and receipts.

## Technical details and source

### A fee calculation anyone can repeat

Consider a fully executed user buy of **100,000 sats**, with the asset already graduated at the start of
the trade, `T100` (1%) and `C0` (buyback and locking):

| Calculation | Result |
| --- | --- |
| Platform base fee | 500 sats |
| Rule fee | 1,000 sats |
| Total fee | 1,500 sats |
| Buy principal after fees | 98,500 sats |
| Rule-fee destination | 0 sats to the creator; 1,000 sats to the application's buyback route |

For a user sell with the same gross amount and starting conditions, the net amount is also 98,500 sats.
These three lines come from the reference contract's `_fees` function. `ceilBps` rounds up using integer
arithmetic; the rule fee is the difference after calculating the total fee.

```solidity
platformFee = ceilBps(base, 50);
totalFee = ceilBps(base, 50 + (postAtTradeStart ? T : 0));
ruleFee = totalFee - platformFee;
```

The [calculation package](../reference/r1/README.md) contains the
[Solidity source](../reference/r1/artifacts/AIBTCInscription.sol),
[ABI](../reference/r1/artifacts/abi.json), [vectors](../reference/r1/artifacts/vectors.json) and
[local JavaScript implementation](../reference/r1/index.mjs). The
[example](../reference/r1/example.mjs) and [vector runner](../reference/r1/check-vectors.mjs) run offline.
`planBuyback` uses an executor-supplied available balance and event sequence to return a plan.

### Reserved directions in the frozen text

R1 section 08 assigns `RESERVED_DOCUMENTATION_ONLY` to these exact entries, in this order:
`X402` (x402 payments); `AGENT` (AI Agent); `LLM` (language-model integration); `DAO` (governance);
`STOCK` (stocks/RWA); `EXTERNAL_RECEIPT` (external receipts); `EXTERNAL_WALLET_CLAIM` (external wallet claims);
`CERTIFIED_EXTERNAL_CONTRACT` (certified external contracts); `DIVIDEND` (dividends);
`AUTO_LP` (automatic liquidity); `AIRDROP` (airdrops); `MISSION` (mission vault); `ORBIT` (satellite tokens);
`BRIDGE` (bridges); `ORACLE` (oracles).

They name future topics rather than executable R1 functions or valid extra parameters. The linked AIPs
propose shared protocol building blocks; application guides explore products that can use them. Each new
capability needs its own defined rules and implementation.

<a id="agent-key-delegate-authority-without-handing-a-model-the-owner-key"></a>

### Delegation: grant identity and confirmed authority

[AIP-0001](../proposals/AIP-0001-delegation-v1.md) defines the proposed grant identity, owner
permission-generation context, total remaining allowance and height bounds. Its scoped-delegation design
draws on the wallet-execution permissions discussed in [ERC-7715](https://eips.ethereum.org/EIPS/eip-7715),
expressed through AIBRC rules and Bitcoin heights. Canonical confirmation determines when a grant or
revocation becomes effective.

### Security constraints

- **Execution responsibility:** R1 calculates fees, their destinations and buyback plans. Applications supply
  the actual inputs and handle AMM pricing, trading, custody and locking. Necessary inputs and execution
  records let others assess whether an application followed the selected rules; each executor maintains
  its own state and responsibilities.
- **Version identity:** R2 and R3 describe possible future rule templates. AIP numbers identify protocol
  proposals, a separate sequence. Future templates and protocol instructions can work together through
  explicit specification and activation. R1 and its selected asset parameters stay fixed; existing assets
  retain their declared rules.
- **External integration:** R1 and X1 are alternative reference modes. X1 records and displays a chain/address
  relationship; an adapter supplies external lookups, code and interface checks, eligibility and execution.
  Cross-chain asset movement and settlement require their own arrangements. Bitcoin Core validates Bitcoin
  transactions while metaprotocol implementations interpret the asset rules.
- **Authority scope:** current public API and MCP tools are read-only. Application authorization and native
  Agent Key govern different state and asset scopes. The first grant proposal uses a total allowance and
  leaves funds in the owner's balance; a valid remaining grant can cover later deposits. Periodic budgets,
  recipient restrictions and control of LP positions or native BTC require separately defined authority.
- **Signing and recovery:** the core authorization input rejects SINGLE; the application's block exchange
  may use SINGLE on a separate BTC payment input and DEFAULT on the asset authorization input. Grant and
  revocation effects must remain consistent across state, hashes, snapshots, undo and replay. Unknown
  outcomes retain the original operation identity while they are resolved.
- **Delivery and evidence:** a record commitment identifies the committed material. Full business checking
  requires the relevant inputs and rules; service quality follows an agreed acceptance method. Conditional
  delivery and cross-protocol settlement require their own specified conditions.

The [trust model](../TRUST_MODEL.md) collects these shared assumptions. The
[frozen R1 reference](../spec/covenants/R1.md) remains the source for exact wording and identifiers.
