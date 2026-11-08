# 05 · Cross-protocol interaction and settlement

## Compatibility, not replacement. Aggregation, not fragmentation.

**Different Protocols. Shared Application Foundations.**

An Agent working for a Bitcoin community may need to find its related assets, compare quotes and prepare
an exchange. Its user wants a clear view of the assets and the result. Common interfaces can make those
tasks familiar across wallets and markets while BRC-20, Runes and AIBRC retain their native rules.

AIBRC's direction is a shared application language for asset identity, account information, rules and
operations. This gives builders a way to reuse discovery and market tools across projects. Optional
shared-root issuance adds verifiable common ancestry; an external contract reference can connect an asset
with a related application on another network.

| Stage | Scope |
| --- | --- |
| Current reference | AIBRC asset identity and account rules; X1's external chain and contract coordinates |
| Application examples | Shared-root issuance and the specific AIBRC–BTC collaborative block-exchange path |
| Application direction | Common asset views, quote discovery and adapters that check each protocol's native operations |
| Proposed / Research | General cross-protocol conditional settlement and long-lived unattended offers; [AIP-0007](../proposals/AIP-0007-conditional.md) explores settlement conditions |

## Identify the asset before discussing its price

### Independent asset identity · Live (AIBRC core)

An Agent can resolve an AIBRC asset's ID, deployment identity and locator in canonical-chain context. A
wallet can pair its readable name with that exact identity, helping users distinguish assets with similar
names. An adapter for another protocol supplies that protocol's identifiers and validity rules.

`network + asset identity + current canonical context`.

The rules are in [§7 of the specification](../spec/AIBRC_PROTOCOL_V0.25.md). For AIBRC account abstraction,
**balances live on script-derived accounts; authority is a protocol rule**. Shared interfaces describe
those properties precisely so tools can work with each asset's actual ownership and transfer model.

### Shared-root issuance

An application can derive issuance paths under different asset standards from a common Bitcoin root
transaction. A community can give wallets and Agents a way to trace related assets to the same origin,
while keeping their individual identities visible.

`common root transaction → parallel issuance paths → independent protocol validity`.

```text
Bitcoin root transaction
  ├─ AIBRC Deploy → native asset and script account
  ├─ BRC-20 commitment → inscription reveal
  └─ Runes commitment → reveal and Runestone

Each path → its own protocol rules and confirmation
```

A community dashboard could present the family together, link each deployment and show the relevant
balances through native data sources. The benefit is a clearer provenance view and less repeated discovery
work across applications. Independently issued assets can also use a common interface.

## Shared interfaces for useful tasks

| Task | What an Agent can prepare | What the user gains |
| --- | --- | --- |
| Related-asset views | Resolve identities and shared ancestry, then collect each protocol's balances and source context | A recognizable asset family across wallets, community pages and markets |
| Quote discovery | Request exact asset pairs and amounts, compare costs and quote expiry | An exchange choice expressed in familiar terms |
| Transfer checks | Send each proposed operation to its protocol-specific validator and summarize the results | A clear account of what will be paid, delivered and checked |

These are useful adapter tasks in their own right. Common asset interfaces and execution conventions helped
public-chain wallets, libraries and application frameworks serve many projects. Bitcoin builders can reuse
that engineering approach: define the shared questions and supply the native interpretation underneath.

## External applications: follow a shared reference

X1 gives an asset an external application coordinate: a chain ID and a contract address. A builder can use
the pair to show the associated application and direct an Agent to the appropriate network tools. With the
relevant ABI and RPC access, the Agent can inspect the rules and state that the contract exposes and explain
how that application relates to the asset.

```text
AIBRC asset → X1 chain ID + contract address
                         ↓
                ABI and RPC tools
                         ↓
       Related application's exposed rules and state
```

This makes an external relationship discoverable and gives later application adapters a precise starting
point. Existing contract interfaces, developer libraries and chain tools provide an engineering foundation
for those adapters. The [X1 reference](../spec/covenants/X1.md) defines the recorded format.

## Online RFQ: define the exchange before signing

### Request-for-quote coordination · Proposed (general cross-protocol application)

An Agent can turn a request into exact assets, amounts and destinations, ask providers for expiring quotes
and compare the total cost. The participants then prepare the transaction and protocol material for the
selected offer. The [RFQ application guide](applications/12-cross-protocol-rfq.md) follows this workflow.

`request → quote → transaction reconstruction → signatures → validation`.

RFQ gives applications a reusable coordination pattern. Asset-specific builders and validators supply the
native transfer details; signers check the exact exchange they authorize.

<a id="psbt-a-coordination-format-not-a-delivery-guarantee"></a>

## PSBT: coordinate a signed exchange

### Collaborative transactions · Live (application example)

The AIBRC–BTC block-exchange application illustrates payment and asset delivery coordinated in one Bitcoin
transaction. Participants prepare and sign the same transaction, checking their inputs, outputs and asset
effects. PSBT provides a familiar format for that collaboration.

`PSBT coordination + correct sighash coverage + protocol-leg validation`.

The example has distinct input roles: the user's BTC payment input uses SINGLE, while the asset lane's
authorization input uses DEFAULT. The core Transfer authority rules still apply to that authorization
input. See the [core rules, §6](../spec/AIBRC_PROTOCOL_V0.25.md),
[BIP174's PSBT format and roles](https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki), and
[BIP341's signature-message commitments](https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#common-signature-message).

### Offline offers and conditional delivery · Proposed / Research

Constrained offer material could let a provider quote an exchange that another party fills later. This
would reduce the need for continuously online counterparties. It requires conditions that keep inventory,
payment and delivery valid together, including expiry and cancellation behavior.

`conditional state transition + bounded signature template + exact settlement evidence`.

[AIP-0007](../proposals/AIP-0007-conditional.md) develops the settlement questions behind this direction.

## A practical starting point for builders

Begin with an asset view and quote-discovery tool: identify the assets, show data sources and freshness,
and compare exact requests. Add validation for each protocol and an online signing workflow for supported pairs.
The specific AIBRC–BTC collaboration is one application path; additional protocol pairs need their own
builders and validators.

An Agent can help find an exchange and explain its conditions before it is entrusted with execution.
Shared interfaces let those capabilities improve across applications, while users keep a readable view of
the task and its outcome.

## Settlement conditions: four separate questions

1. **Is the Bitcoin transaction valid?** Check spendability, script satisfaction and membership in the current canonical chain.
2. **Is each asset leg valid?** Apply each protocol's asset identity, authority, balance and receiver rules.
3. **Is the consideration bound?** Check that signatures and rules prevent a participant from retaining only the favorable half of the exchange.
4. **What happens after reorganization or an unknown result?** Keep the operation tied to its original transaction, revalidate its chain context and resolve its result before another payment.

```text
One Bitcoin transaction confirms
  ↓
Interpret each protocol asset leg
  ├─ All valid, consideration bound → exchange confirmed
  ├─ A leg invalid → no atomic-delivery claim
  └─ Indexing or evidence incomplete → outcome unknown
```

A shared issuance root establishes ancestry. Common price, pooled liquidity, ownership rights and redemption
need their own application mechanisms. Each issuance and transfer leg must satisfy its native rules.
BRC-20's transfer inscription is consumed on its first transfer; it is not reusable order authority. The
[original BRC-20 specification](https://domo-2.gitbook.io/brc-20-experiment) describes those semantics.
A changed or expired quote needs new review and authorization of the exact material.

For a long-lived AIBRC offer, the seller's script-account balance can change before a later fill. A fully
signed Bitcoin transaction alone cannot reserve that balance or guarantee delivery. Current AIBRC
authorization commits to full outputs and rejects SINGLE on the asset authorization input; another asset's
pre-signing template therefore needs its own analysis and adaptation.

X1 currently records only the chain ID and address. External lookups and ABI interpretation are work for
application tools; the reference carries no bytecode hash and does not execute the external contract or
move assets between chains. Linking an existing lending or market contract calls for an application
adapter, explicit authority and settlement rules in the relevant environments.
