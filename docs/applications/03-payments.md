# 03 · Payments, Distribution and Stable-Value Assets

**Live distributions · Proposed multi-asset operations · Research stable-value finance**

A community payment should be easy to express: these recipients receive these amounts. AIBRC's current
Transfer groups allocations of one asset into a compact instruction, giving payroll tools, creators and
service providers a common way to prepare and reconcile a distribution.

The same payment foundation can support reference-currency budgets and research into stable-value assets.
Those applications add their own financial commitments on top of the asset rules.

## Why it matters

Payroll tools, community distributions and service payments share a basic need: tell each recipient how much is due and prove which payment completed. Stable-value assets add a different need. Fiat-backed instruments, overcollateralized designs and hedged synthetic dollars all try to reduce price volatility, but they do so through different reserve, legal and market arrangements.

These designs are not interchangeable. A fiat-backed claim depends on an issuer and redemption rights. A collateralized design needs valuations and liquidation. A hedged design depends on the continued operation of its hedge and counterparties. A name or ticker does not supply any of those mechanisms.

## A practical example

For a distribution, an organizer prepares one list of recipients and quantities, checks it once, and follows each batch to a definite result. An Agent purchasing services may instead want a dollar-denominated budget so that the meaning of its spending limit does not change with the BTC price.

A sensible early product can show a USD reference value while settling an existing asset. That is a pricing feature, not a USD redemption promise. If an issuer later offers a stable asset, the interface should explain who owes what, how redemption works and which event can interrupt it.

## Who pays, who earns

Payment software can earn revenue from preparation, reconciliation, accounting exports or API service. The current protocol does not create an extra fee merely because an application offers those conveniences.

For a stable asset, the economic relationship starts with the issuer's obligations. Issuance and redemption fees may pay for operations; reserves or collateral must support the actual claim. In a liquidation design, participants purchasing discounted collateral take real execution and market risk. Their return is not a guaranteed interest rate supplied by the token format.

A fixed-supply AIBRC asset could represent a capped inventory distributed from an issuer-controlled account. It would not become elastically mintable or redeemable simply because the application calls it stable. The supply and claim model must agree before a product is offered.

## How AIBRC fits

The current Transfer supports one asset, one authorizing sender account and multiple allocations, within the 25-allocation and payload-size limits. If an allocation is invalid, the instruction does not partially execute. See [the specification, §5](../../spec/AIBRC_PROTOCOL_V0.25.md). [AIP-0002](../../proposals/AIP-0002-multiasset-transfer.md) proposes multi-asset allocation; multiple AIBRC markers cannot be used to bypass the current rule.

```text
Payment list
  → validate quantities and scripts
  → encode and measure actual bytes
  → split and reauthorize if necessary
  → confirm and reconcile each batch
```

For stable-asset research, [AIP-0005](../../proposals/AIP-0005-attest.md) could express a reserve statement, while [AIP-0003](../../proposals/AIP-0003-lock.md) and [AIP-0007](../../proposals/AIP-0007-conditional.md) provide directions for explicit collateral restrictions and conditional settlement. A reserve statement identifies what its issuer claims; it does not make an incomplete reserve complete. BTC collateral remains governed by Bitcoin scripts or an independently specified custody or contract arrangement, not by an AIBRC asset lock.

## Building the first version

Single-asset distribution can start with current components. Applications still need recipient validation, exact transaction fees, signing, original-transaction recovery and duplicate-payment prevention. An unknown batch stays tied to its original transaction rather than being paid again.

A stable asset requires substantially more than transfer support: an issuer or explicit decentralized liability model, reserves, redemption, data sources, exception handling and any necessary legal rights. There is no general oracle or liquidation engine in the current codec. A price signed by a chosen publisher is that publisher's statement; its schedule, freshness and trust must be defined separately.

For both uses, recipient outputs and Bitcoin transaction bytes have costs. The maximum allocation count is not a promise that every 25-recipient transaction fits every relay policy.

`asset + allocations[]`; stable value additionally needs `issuer + reserves or collateral + redemption + risk controls`.

## Where it can lead

Begin with reliable distributions, invoices and service budgets. A builder can then study a stable-value
instrument with explicit backing, liabilities and redemption. The opportunity is to make the complete
financial relationship inspectable, using the protocol's common asset model as its starting point.
