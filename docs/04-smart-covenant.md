# 04 · Smart Covenant: programmable rules for Bitcoin assets

AIBRC records native assets as balances on accounts derived from Bitcoin addresses. Wallets, applications
and Agents share a way to identify an asset, name a recipient and specify an amount. Smart Covenant connects
that foundation with public rules that applications can reuse and independent programs can calculate.

R1 is the first rule template on this route. An asset selects its version, fee rate and fee destination at
creation; applications apply the fixed mathematics to their actual inputs. AiBTC is the first application
infrastructure to connect these rules with trading and liquidity. Other applications can use the same rules
in their own execution systems.

The path continues from assets and public rules to useful Agent cooperation: read the relevant state,
understand a rule, prepare an action and work within an explicit mandate. EVM rule extensions can connect
through identified external references, with each execution environment keeping its own responsibilities.

Three relationships make the framework easier to follow: **R1** identifies an application's rule template;
**X1** identifies an external contract relationship; proposed **Agent Key** introduces bounded authority
to transfer a native asset. They connect rules, applications and permissions in different ways.

## From an intention to an explicit rule

Imagine an asset whose application allocates a selected fee to a creator, or an Agent allowed to spend only a
specified asset within a limited budget. “This is our policy” is difficult for another program to evaluate.
A versioned rule, defined parameters and an observable execution result give it something precise to inspect.

```text
Asset or service intention
  ↓
Rule identity + fixed parameters
  ↓
Authorized operation + explicit executor
  ↓
State change + checkable result
```

The current core already follows that pattern for Deploy and Transfer. R1 and X1 identify application-layer
relationships. Agent Key and further AIPs develop new protocol authority and settlement capabilities.

| Building block | What it connects | Stage |
| --- | --- | --- |
| Deploy / Transfer | Asset instructions, account authority and deterministic state | Live core |
| R1 | An identified asset rule template, selected parameters and application execution | Live application template |
| X1 | An asset and an external network/contract reference | Live application reference |
| Agent Key | Owner authorization and bounded delegated transfers | Proposed · AIP-0001 |
| Conditional settlement | A transfer and the evidence required for delivery | Proposed · AIP-0007 |

## R1: an identifiable Covenant Inscription rule template

R1 makes three calculations public: how much a trade pays in fees, where its rule fee goes and what buyback
plan follows from an available balance. At creation, an asset selects the R1 version, reference address,
fee rate `T` and destination `C`. Those parameters stay fixed for that asset.

The available configurations are no rule fee, a rule fee allocated to the creator, or a rule fee allocated
to buyback and permanent locking. The platform base fee is separate. Developers can reuse the calculation
locally, and users or Agents can compare its results with execution records without an EVM transaction for
each trade.

```text
Bitcoin asset + fixed R1 version and parameters
  |
  v
Public calculations
  |
  v
Application execution
  +-- Instant: execution and accounting
  +-- Block Swap: wallet signs -> Bitcoin confirms
  |
  v
Execution records + independently calculated rule results
```

The two paths above are an application example. Instant trading supports continuous interaction through
the application ledger; Block Swap uses a transaction signed by the user's wallet. The public rule
calculation gives both paths an explicit reference for the applicable fees.

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
The following three lines are taken from the reference contract's `_fees` function. `ceilBps` rounds up
using integer arithmetic; the rule fee is the difference after calculating the total fee.

```solidity
platformFee = ceilBps(base, 50);
totalFee = ceilBps(base, 50 + (postAtTradeStart ? T : 0));
ruleFee = totalFee - platformFee;
```

The [R1 calculation reference](../reference/r1/README.md) provides the Solidity source, ABI, frozen text,
vectors and a local JavaScript calculator, with commands to run the example and check the vectors.
`planBuyback` takes the available buyback balance and event sequence to calculate the next plan.

The [published AIBTC Covenant Inscription R1 reference](../spec/covenants/R1.md) preserves the complete frozen text and its binding
explanation. It is the source for exact wording and identifiers.

### Different Bitcoin programmability routes

| Route | Native protocol approach | What builders can work with |
| --- | --- | --- |
| [Runes](https://docs.ordinals.com/runes.html) | Runestones allocate rune balances across Bitcoin transaction outputs | Defined issuance and asset-allocation rules |
| [ARC-20](https://github.com/atomicals-community/atomicals-guide/blob/main/arc20-tokens/README.md) | Asset units are associated with sats and follow the protocol's output-allocation rules | Satoshi-linked assets and their transfer rules |
| [BRC2.0](https://github.com/bestinslot-xyz/brc20-proposals/blob/main/000-programmable-module/index.md) | Bitcoin inscriptions submit operations to an indexer-executed EVM module | General contract state and application logic |
| [Alkanes](https://github.com/kungfuflex/alkanes-rs/blob/main/README.md) | Bitcoin carries program data and calls interpreted by a WASM indexer runtime | Programmable assets and contracts |
| AIBRC + R1 | Native account balances and public asset rules; R1 supplies a reusable calculation reference | Common asset interfaces and application execution, illustrated by AiBTC's Instant and Block Swap paths |

The first four entries describe native protocol approaches. The AiBTC paths illustrate an application
built on AIBRC. Application trading speed and native Bitcoin confirmation time describe different layers.

## X1: a reference, not remote execution

Bitcoin-native assets can participate in wider application relationships. X1 identifies an external network
and contract address, giving tools a precise reference for the EVM side of that relationship.

```text
AIBRC asset
  ↓ X1 reference
External network + contract address
  ↓
External application's rules and execution
```

A wallet or Agent can follow that reference, identify the relevant environment and inspect the contract there.
The [X1 reference](../spec/covenants/X1.md) defines its format and interpretation. Further execution or
settlement integration can build on that identity with its own verified conditions.

## Agent Key: delegate authority without handing a model the owner key

**Give Agents the Task. Put Boundaries in the Rules.**

An assistant can begin with read-only API and MCP tools, calculate R1 fees locally and prepare a plan for
the user to review and sign through an application or wallet. Scoped application authorization is the next
step; native Agent Key develops a permission that independent protocol implementations can share. The
[bounded-assistant guide](applications/04-delegated-agents.md) follows this sequence.

Agent Key proposes a way for a community to give an operating Agent permission to spend up to 1,000 tokens
of a specified asset within a defined block range. The Agent can organize payments and distributions, while
the community keeps its private key and can inspect the grant and resulting transfers.

A grant identifies one asset, a cumulative allowance and valid heights. The Agent uses its own working key
to prepare authorized transfers through a controlled signing tool. Each delegated transfer must still
satisfy the owner's available balance and the grant's remaining allowance.

The scoped-delegation design draws on the wallet-execution permissions discussed in
[ERC-7715](https://eips.ethereum.org/EIPS/eip-7715), expressed through AIBRC asset rules and Bitcoin block
heights. The model handles planning; the permission boundary is defined by rules that independent software
can check.

```text
Owner defines asset, allowance and valid heights
  ↓ signs the grant
Grant enters canonical state
  ↓
Agent proposes an action
  ↓ controlled tool checks and signs
Delegated transfer confirms
  ↓
Owner balance and grant allowance decrease
```

[AIP-0001](../proposals/AIP-0001-delegation-v1.md) defines the proposal. Each grant has a distinct `grantId` and
an owner permission-generation context. Confirmed revocation prevents stale authority from being revived;
remaining allowances and height limits make the mandate visible to independent software.

This opens a path to service assistants, bounded community operators and Agents buying work from other
Agents. [Application guides](07-applications.md) explore those uses and their economics.

## Conditions: connect payment with delivery

An allowance answers “how much may this Agent transfer?” A service contract also asks “what must it receive
in return?” Conditional settlement develops that second relationship: define the required payment, output,
height or other specified evidence before allowing a state transition.

[AIP-0007](../proposals/AIP-0007-conditional.md) is the proposal entry point. It can support designs for exact
exchanges and evidence-linked service payments when the relevant conditions are fully specified. The
[cross-protocol chapter](05-cross-protocol.md) explains why each asset leg and its consideration must be covered.

## Security constraints

These definitions keep Smart Covenant's responsibilities precise:

- **Core and application execution:** R1 is an immutable pure calculation reference for fees, their destination
  and buyback plans. Applications supply the actual state and handle AMM pricing, trading, custody and locking.
  Fixed parameters identify the rule to check; the necessary inputs and execution records let others assess
  whether the application followed it. R1 is separate from the two core wire instructions. X1 records a
  chain and address, not an external code hash, code-existence proof or instruction for Bitcoin to run the EVM.
  Neither reference alone establishes redemption rights, contract safety or application reserve coverage.
- **Grant scope:** the first Agent Key proposal uses a total allowance, not periodic budgets. An allowance
  authorizes spending; it does not reserve funds. Later deposits can be spent under a still-valid remaining
  grant. Price guarantees, restricted recipients, redelegation and return-of-proceeds conditions need their
  own rules. Emptying a balance is not revocation.
- **Confirmed authority:** a revocation takes effect through canonical-chain confirmation. Signing tools and
  interfaces must preserve the distinction between a pending revocation and an effective one.
- **Input roles:** the core authorization input rejects SINGLE. The application's block exchange may use
  SINGLE on a separate BTC payment input and DEFAULT on the asset lane's authorization input. Collaborative
  signing, 2-of-2 and threshold signing are different mechanisms; collaborative lanes are not Agent Key grants.
- **State consumers:** an authority extension must cover canonical state, hashes, snapshots, undo, replay,
  version selection and every execution consumer. The same chain and rule context must yield the same authority
  after a restart or reorganization.
- **Evidence:** exact execution records are needed to assess whether an application followed a rule. A text
  hash or an AI explanation alone cannot establish that result. Unknown outcomes stay tied to the original
  operation; they are not permission to pay again.

The [trust model](../TRUST_MODEL.md) collects the shared verification assumptions. The protocol's strength
comes from making rules explicit enough for others to implement and challenge.
