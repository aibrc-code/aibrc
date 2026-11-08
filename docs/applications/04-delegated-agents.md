# 04 · Bounded Agent Assistants

**Current read-only tools · Application authorization next · Proposed Agent Key**

**Give Agents the Task. Put Boundaries in the Rules.**

An assistant can read asset and market information, explain a budget and prepare purchases or distributions
for approval. Public API and MCP tools provide read-only inputs; the [R1 calculator](../../reference/r1/README.md)
gives it a reusable way to calculate applicable fees. The user reviews and signs the actual action through
an application or wallet.

The next step is a limited mandate for a particular application task. Native Agent Key develops that idea
into a protocol grant: one asset, a cumulative allowance and Bitcoin block-height bounds. Its design draws
on the wallet-execution permission model discussed in
[ERC-7715](https://eips.ethereum.org/EIPS/eip-7715), giving independent software explicit conditions to check.

## Why it matters

People delegate spending to employees, applications and service providers because approving every small action is inconvenient. Giving an automation tool a private key solves convenience by granting far more authority than many tasks require. A prompt saying “only use this for trading” does not constrain software that already holds an unrestricted signing key.

A protocol grant aims to make the relevant boundary deterministic. It is not an instruction to trust an AI model's intentions.

## A practical example

A research assistant prepares a week's data purchases: the supplier, deliverable, price, payment asset and
deadline for each task. The user reviews the plan and signs the payments. Suppliers return their results
with records that link the work to the agreed task.

A later application mandate can let the assistant repeat approved purchases within a budget and expiry.
The service can then spend less time asking for routine approvals while the owner keeps the main key.

## Who pays, who earns

An assistant can charge for a task that a user actually wants performed: distributing funds, preparing purchases or operating a limited workflow. Automation is valuable when the saved work exceeds its execution, network and support costs.

Paid data, verification and research give the assistant a reason to operate: customers receive a defined
result, suppliers earn for delivery and revenue covers continued computation and support.

## How AIBRC fits

[AIP-0001](../../proposals/AIP-0001-delegation-v1.md) proposes a unique grant identity, an owner permission-generation nonce, a remaining total allowance and block-height bounds. A delegated transfer must satisfy both the owner's available balance and the grant's remaining allowance. The grant identity prevents old material from being reinterpreted as a different authorization.

| Stage | Authority | Useful outcome |
| --- | --- | --- |
| Current tools and user approval | Read and analyze; the user signs the action | Explain a purchase and prepare its payment |
| Application authorization | A future credential checked by the application's executor | Repeat defined purchases within an explicit mandate |
| Proposed Agent Key | A native grant checked under shared protocol rules | Transfer the specified AIBRC asset using the delegate's own key |

The proposed native flow is:

```text
Owner approves exact scope
  → grant confirms
  → Agent proposes an action
  → deterministic checks and signing
  → execution reduces balance and allowance
```

Revocation becomes effective through confirmed canonical-chain state. It is not a fixed-second emergency switch.

## Building the first version

Application authorization belongs at the actual execution boundary, with balance and budget checks,
revocation and durable operation identities. A retry should query the original result before attempting
another payment.

Native grants require consistent interpretation across canonical state, hashes, snapshots, undo and replay,
along with wallet displays and signing tools. The first proposal uses a total allowance. Periodic budgets,
recipient or price restrictions and authority over a platform balance or BTC wallet need their own rules.

An Agent that may “sell only, with proceeds returning to the owner” needs a settlement rule beyond an outgoing transfer allowance. A later incoming balance can also be spent by a still-valid remaining grant; users must understand that scope rather than assume the grant refers only to today's holdings.

`grantId + ownerPermitNonce + remaining allowance + height bounds`.

## Where it can lead

Start with one task: a data subscription, a paid analysis or a community distribution. Establish the
customer, delivery and payment records, then add the authority needed to repeat that useful workflow.
The model plans the work; signing tools and execution rules define what it may spend.
