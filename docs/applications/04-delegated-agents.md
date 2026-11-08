# 04 · Bounded Agent Assistants

**Proposed · Agent Key**

**Give Agents the Task. Put Boundaries in the Rules.**

Agent Key proposes a way for a community to authorize an operating Agent to spend up to 1,000 tokens of one
asset within a defined block range. The Agent can organize payments and distributions, while the community
keeps its private key and can inspect the grant and transfers.

Its scoped authority draws on the wallet-execution permission model discussed in
[ERC-7715](https://eips.ethereum.org/EIPS/eip-7715). AIBRC's proposal uses a specified asset, cumulative
allowance and Bitcoin block heights, giving independent software explicit conditions to check.

## Why it matters

People delegate spending to employees, applications and service providers because approving every small action is inconvenient. Giving an automation tool a private key solves convenience by granting far more authority than many tasks require. A prompt saying “only use this for trading” does not constrain software that already holds an unrestricted signing key.

A protocol grant aims to make the relevant boundary deterministic. It is not an instruction to trust an AI model's intentions.

## A practical example

An owner chooses an asset, a delegate, a total allowance and a validity interval. The wallet explains the complete scope before the owner signs. Once the grant is confirmed, an Agent proposes actions and a controlled signing component checks each one against the grant.

The model can decide which request to make without reading the owner's private key. The application's interface should show the remaining allowance and the chain context in which a revocation takes effect.

## Who pays, who earns

An assistant can charge for a task that a user actually wants performed: distributing funds, preparing purchases or operating a limited workflow. Automation is valuable when the saved work exceeds its execution, network and support costs.

The Agent's name or token is not itself a revenue model. An allowance is a spending permission, not a profit guarantee or a promise that trading proceeds return to the owner.

## How AIBRC fits

[AIP-0001](../../proposals/AIP-0001-delegation-v1.md) proposes a unique grant identity, an owner permission-generation nonce, a remaining total allowance and block-height bounds. A delegated transfer must satisfy both the owner's available balance and the grant's remaining allowance. The grant identity prevents old material from being reinterpreted as a different authorization.

```text
Owner approves exact scope
  → grant confirms
  → Agent proposes an action
  → deterministic checks and signing
  → execution reduces balance and allowance
```

Revocation becomes effective through confirmed canonical-chain state. It is not a fixed-second emergency switch.

## Building the first version

The proposal requires specification, activation, all state consumers, snapshot and rollback handling, wallet displays and constrained signing tools. Version one does not add periodic allowances, price conditions, redelegation or authority over a platform's internal custody balance.

An Agent that may “sell only, with proceeds returning to the owner” needs a settlement rule beyond an outgoing transfer allowance. A later incoming balance can also be spent by a still-valid remaining grant; users must understand that scope rather than assume the grant refers only to today's holdings.

`grantId + ownerPermitNonce + remaining allowance + height bounds`.

## Where it can lead

Start with one task: a community distribution, a service budget or another limited transfer workflow.
Recipient restrictions and settlement conditions can extend the mandate through separate rules. As the
scope grows, keep the model's planning, the signing tool and the protocol's authority checks distinguishable.
