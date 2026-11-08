# 12 · Cross-Protocol RFQ and Market-Making Agents

**Proposed / Research**

One community can hold assets under several standards. A shared request-for-quote experience could help its
members discover a precise exchange without learning a different trading workflow for every protocol.
Providers contribute inventory and executable quotes; Agents can help find and compare them.

AIBRC's role is a common interaction foundation with exact asset identity and explicit settlement
conditions. Each participating protocol keeps the rules that determine whether its own asset was delivered.

The aim is reusable market tooling across protocols. A quote interface can work with assets that were
issued independently; a shared issuance root is optional. Exact asset identity, fresh inventory and each
protocol's settlement rules remain part of the exchange.

## Why it matters

In an RFQ market, competing providers quote a specific exchange rather than require every order to sit indefinitely in one public order book. A provider earns a spread for making inventory and execution available. The same model is relevant to assets whose transfer preparation and confirmation differ between protocols.

A market-making Agent is an operating tool within that business. It can read data, prepare quotes and manage a limited inventory policy, but software automation does not remove market risk or supply missing settlement guarantees.

## A practical example

A user requests an exchange between a BRC-20 asset and an AIBRC asset. Providers identify the exact assets and quantities, check their inventories and return expiring quotes. The user selects an offer, and the participants prepare the precise Bitcoin transaction and the required protocol material.

```text
Request a specific exchange
  → providers check inventory and quote
  → participants rebuild and inspect
  → authorize the required inputs
  → broadcast exact material
  → verify each settlement leg
```

A separate LP risk assistant might simply inspect a user's pool exposure and recommend a change for approval. It can be useful before an Agent is permitted to place orders autonomously.

## Who pays, who earns

The user pays a disclosed spread and relevant network costs. Providers earn from inventory availability and execution service while carrying price, inventory and confirmation risk. An application may charge for quote aggregation, tooling or support. None of those revenues is guaranteed by issuing an Agent token.

A bounded strategy treasury could fund a quote provider, but the owner must understand what the operator may spend, what happens to proceeds and when authority ends. An outgoing allowance alone cannot enforce a profitable strategy or ensure that exchange proceeds return to the intended account.

## How AIBRC fits

Current AIBRC transfers are checked under [the specification, §§5–7](../../spec/AIBRC_PROTOCOL_V0.25.md); each external protocol retains its own validity rules. A PSBT is a collaboration format for a Bitcoin transaction, not a universal protocol validator. A BRC-20 transfer inscription is consumed on its first send and cannot be treated as a reusable order credential.

Quotes should name the asset identity, network, quantities, destinations, expiry and relevant state context. A maker's signing component must check the exact transaction rather than accept an Agent's natural-language assurance. Bitcoin transaction atomicity does not make an invalid asset leg valid.

[AIP-0001](../../proposals/AIP-0001-delegation-v1.md) explores bounded outgoing authority, while [AIP-0007](../../proposals/AIP-0007-conditional.md) explores explicit settlement conditions. Long-lived unattended orders require a proof of continued inventory and enforceable conditions; the current script-account balance model does not acquire that property merely because a PSBT is fully signed.

## Building the first version

A first application can aggregate read-only asset information and prepare online, explicitly approved exchanges. It still needs asset-specific validators, fresh inventory, quote expiry, signer isolation and recovery of the original transaction. A production maker additionally needs an operating budget, monitoring, risk limits and a defined response to partial or uncertain results.

Checking independent index sources can help detect disagreement. Agreement between two sources is not a substitute for the protocol's rule set. If an indexer has not caught up, the product should show an unresolved result rather than send another payment.

An exchange must state which conditions make all legs safe together and what happens if those conditions cannot be established. “No bridge” describes the absence of one mechanism; it does not prove that the exchange is atomic, permissionless or safe for indefinite offline posting. See [the cross-protocol chapter](../05-cross-protocol.md).

`asset-specific validity + bounded inventory + RFQ + exact transaction + settlement checks`.

## Where it can lead

Build from asset discovery to exact quotes and controlled online execution. Activated grants and separately
defined settlement conditions could support more autonomous providers. The enduring advantage is a shared
path between markets, with inventory, authority and delivery visible to the people using it.
