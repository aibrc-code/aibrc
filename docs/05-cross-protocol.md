# 05 · Cross-protocol interaction and settlement

## Compatibility, not replacement. Aggregation, not fragmentation.

**Different Protocols. Shared Application Foundations.**

BRC-20, Runes and AIBRC can evolve under their own rules. AIBRC aims to help wallets, markets and Agents reuse
ways to identify, read and interact with assets, reducing the need to rebuild tools for every protocol.
Shared-root issuance and cross-protocol exchange are distinct application directions built on that common
foundation.

Shared tools give users and developers a consistent way to work with different assets. Optional shared-root
issuance establishes a common origin for assets issued under several standards. Exchange asks a different
question: what conditions establish that each side received the agreed asset? A shared issuance root is not
a prerequisite for a common interface.

The existing AIBRC–BTC block-exchange path provides an application example of coordinating payment and
asset delivery in one Bitcoin transaction. General cross-protocol conditional settlement is a proposed next
step; [AIP-0007](../proposals/AIP-0007-conditional.md) sets out its design questions.

## Identify the asset before discussing its price

### Independent asset identity · Live (AIBRC core)

AIBRC asset IDs, deployment identities and locators resolved in canonical-chain context. Applications can distinguish a readable name from an exact asset identity.

Matching names in two places do not make them the same asset.

`network + asset identity + current canonical context`.

The rules are in [§7 of the specification](../spec/AIBRC_PROTOCOL_V0.25.md). An integration with another protocol must also use that protocol's identifiers and validity rules. An AIBRC name cannot claim someone else's asset as an “official” version.

For AIBRC account abstraction, **balances live on script-derived accounts; authority is a protocol rule**. Other protocols may use different ownership and transfer models. A unified interface must preserve those differences rather than relabel them.

### Shared-root issuance

**Live application implementation.**

An application can derive issuance paths under different asset standards from a common Bitcoin root transaction. Projects can establish verifiable shared ancestry for otherwise distinct protocol artifacts.

Different protocol assets can begin from the same root while keeping their own rules.

`common root transaction → parallel issuance paths → independent protocol validity`.

```text
Bitcoin root transaction
  ├─ AIBRC Deploy → native asset and script account
  ├─ BRC-20 commitment → inscription reveal
  └─ Runes commitment → reveal and Runestone

Each path → its own protocol rules and confirmation
```

Each leg's actual construction, confirmation and protocol validity must be established separately. The shared process is not a mechanical link between balances. Common origin does not itself establish a common price, pooled liquidity, identical ownership rights, automatic exchange or unconditional redemption. Those require additional mechanisms and responsible parties.

## Online RFQ: define the exchange before signing

### Request-for-quote coordination · Proposed (general cross-protocol application)

Participants agree on assets, amounts, consideration, receiver scripts and validity conditions before preparing an exact transaction. Applications and agents can coordinate protocols without first acquiring unrestricted control over a user's assets.

Agree on what each side gives, receives and accepts as completion before signing.

`request → quote → transaction reconstruction → signatures → validation`.

RFQ is a coordination method, not an activated AIBRC opcode. If the quote expires, inventory changes or signature coverage is insufficient, a builder needs fresh explicit authorization. It must not silently change the promised exchange after the user has signed.

## PSBT: a coordination format, not a delivery guarantee

### Collaborative transactions · Live (application example)

Participants prepare and sign the same Bitcoin transaction while checking the inputs and outputs they are responsible for. Payment and delivery can be expressed within a shared transaction structure.

Everyone may be signing the same transaction, but every asset operation still needs to be valid.

`PSBT coordination + correct sighash coverage + protocol-leg validation`.

In the block-exchange application example, the user's BTC payment input uses SINGLE and the asset lane's authorization input uses DEFAULT. The payment input does not thereby become Transfer's authorization input; the latter still satisfies the core authority rules. These roles should not be described as a generic 2-of-2 or threshold-signature scheme. See the [core rules, §6](../spec/AIBRC_PROTOCOL_V0.25.md), [BIP174's PSBT format and roles](https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki), and [BIP341's signature-message commitments](https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#common-signature-message).

### Offline offers and conditional delivery · Proposed / Research

A direction in which one party signs constrained offer material and another party fills it later. Exchanges could depend less on continuously online counterparties.

An offer that remains signed is not enough; payment and delivery need conditions that remain valid together.

`conditional state transition + bounded signature template + exact settlement evidence`.

A protocol balance in a script account is not the same object as a pre-signed BTC input. A seller may transfer the asset through a different valid transaction before the old offer is filled. The old transaction may still be Bitcoin-valid while lacking the protocol balance required for delivery. Current AIBRC authorization also commits to full outputs, so another asset's established pre-signing template cannot simply be copied into this model.

[AIP-0007](../proposals/AIP-0007-conditional.md) explores conditional settlement. It does not claim that arbitrary cross-protocol atomic exchange already exists.

## Settlement conditions: four separate questions

1. **Is the Bitcoin transaction valid?** Check spendability, script satisfaction and membership in the current canonical chain.
2. **Is each asset leg valid?** Apply each protocol's asset identity, authority, balance and receiver rules.
3. **Is the consideration bound?** Check that signatures and rules prevent a participant from retaining only the favorable half of the exchange.
4. **What happens after reorganization or an unknown result?** Do not reuse stale chain context or treat uncertainty as permission for another payment.

```text
One Bitcoin transaction confirms
  ↓
Interpret each protocol asset leg
  ├─ All valid, consideration bound → exchange confirmed
  ├─ A leg invalid → no atomic-delivery claim
  └─ Indexing or evidence incomplete → outcome unknown
```

BRC-20 also retains its own first-transfer semantics: a transfer inscription is consumed on its first transfer rather than acting as a reusable authorization. The [original BRC-20 specification](https://domo-2.gitbook.io/brc-20-experiment) describes this behavior. Runes, inscriptions and other assets likewise require their own interpretations. AIBRC does not rewrite their rules.

## A practical starting point for builders

Start with read-only aggregation that presents exact asset identities, sources and data times. Next, support online RFQ while both parties can check current inventory and reconstruct the transaction they will sign. Consider long-lived offers without an online counterparty only after the consideration and every asset leg's validity have been established.

The value is a common path for users, with enough precision underneath to preserve each asset's real settlement conditions. It does not require converting every protocol into the same asset model.
