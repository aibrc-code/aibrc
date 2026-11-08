# 04 · Smart Covenant: programmable rules for Bitcoin assets

An asset standard gives software a common way to identify and transfer an asset. Smart Covenant takes the
next step: identify the rules attached to an application relationship, the authority they require and the
results an independent program can check.

This is AIBRC's route to native programmability. Compact instructions carry intent; deterministic rules
define asset effects; applications execute the commitments that belong to their services. EVM rule extensions
can connect through identified external references, with each execution environment keeping its own responsibilities.

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

An application can support several asset behaviors while keeping each one's rules recognizable. AIBTC Covenant Inscription R1 supplies
a fixed template and identity for the economic parameters selected by an asset. A client can inspect the
chosen version and parameters, then compare them with the application's execution records.

For example, creator allocations and buyback configurations express different destinations and triggers.
Their base fee, rule fee, recipients and activation conditions belong in the rule interpretation, rather than
being hidden behind a label.

```text
Asset selects R1 and its parameters
  ↓
Application identifies the matching execution version
  ↓
Operation applies the selected rule
  ↓
Result records support independent comparison
```

The [published AIBTC Covenant Inscription R1 reference](../spec/covenants/R1.md) preserves the complete frozen text and its binding
explanation. It is the source for exact wording and identifiers. R1 application execution is separate from
the two core wire instructions.

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

- **Core and application execution:** R1 is a fixed application template, not a third core opcode. X1 records a
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
