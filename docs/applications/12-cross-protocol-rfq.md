# 12 · Cross-Protocol RFQ and Market-Making Agents

An Agent can help its user answer a practical question: “Where can I exchange this exact asset, at what
total cost, and how will delivery be checked?” A common request-for-quote interface would let it compare
providers across Bitcoin asset standards while presenting the user with one understandable choice.

Providers contribute inventory, quotes and execution service. Agents do the repeated work of finding
assets, comparing offers and checking native transfer requirements. Each participating protocol supplies
the rules that determine whether its asset was delivered.

| Stage | Scope |
| --- | --- |
| Current foundation | Public AIBRC asset and account rules, R1 calculations, X1 external references and the specific AIBRC–BTC collaborative exchange example |
| Application direction | Shared quote discovery, protocol-specific validation and controlled online RFQ workflows |
| Proposed / Research | Native Agent Key, general cross-protocol conditional settlement and long-lived unattended offers |

## Why it matters

In an RFQ market, providers quote a specific exchange and compete on price and execution. An Agent can
request offers for an exact asset and amount, include network costs and quote expiry in the comparison,
and present an actionable result. A user spends less time moving between markets and interpreting their
different workflows.

For providers, an operating Agent can keep a supported asset list, watch inventory, calculate quotes and
prepare fills within an application-defined policy. Common interfaces let a provider reuse that work
across more assets and let a new application connect to existing liquidity services.

## A practical example

Consider an Agent preparing to buy an AIBRC asset with BTC. It resolves the asset's identity, checks the
user's available BTC and requests expiring quotes. The user selects an offer; the participants prepare
and inspect the exact payment and asset delivery before signing. The existing AIBRC–BTC collaborative
block-exchange path provides a concrete application example for the transaction step.

```text
User sets the task
  → Agent identifies assets and requests quotes
  → Agent compares total cost, expiry and transfer requirements
  → user selects an offer
  → participants inspect and authorize exact material
  → native rules determine settlement
  → Agent reports the result and transaction
```

A related-asset view can make the request easier to form: show a community's AIBRC, BRC-20 and Runes assets
with their exact identities and any shared issuance origin. A common quote interface can also work with
independently issued assets. Each additional trading pair needs the native builders and validators for
its participating protocols.

## Who pays, who earns

The user pays a disclosed spread and relevant network costs. Providers earn from inventory availability
and execution service while carrying price, inventory and confirmation risk. Applications can charge for
quote aggregation, operating tools or support. These services have a concrete job: find counterparties,
price inventory and help complete a defined exchange.

An Agent operator can offer the same service to several communities. Its business depends on useful
quotes, controlled costs and reliable execution. A strategy treasury could fund the inventory and an
operating budget under a clear mandate for spending and proceeds.

## How AIBRC fits

Exact asset IDs, script-account balances and public Transfer rules give tools a common AIBRC interface.
The [R1 reference](../../reference/r1/README.md) lets an Agent calculate applicable rule fees locally.
Quotes can carry the asset identity, network, quantities, destinations, expiry and relevant state context
so discovery, transaction preparation and result reporting refer to the same exchange.

X1 records a chain ID and contract address for a related external application. A discovery tool can
use that reference with the relevant ABI and RPC tools to inspect the rules and state the contract exposes.
This helps an Agent explain an application relationship and gives later adapters an entry point into
existing contract tooling.

The shared-interface direction draws on how public-chain asset standards let wallets, libraries and
markets build on one another. Here, a common quote request is paired with native protocol interpretation
and an explicit signing path. The [cross-protocol chapter](../05-cross-protocol.md) explains that foundation.

## Building the first version

A useful first tool can focus on four tasks:

1. Resolve exact assets and show their source, balances and data freshness.
2. Request and compare quotes with all costs, expiry and destinations visible.
3. Prepare a supported online exchange for explicit review and authorization.
4. Track the original transaction and report each native settlement result.

Expose these tasks through small, defined tool interfaces that both Agents and application screens can
use. A provider can then add inventory policies, operating limits and isolated signing. The product gains
useful discovery and preparation tools before it supports autonomous execution.

## Where it can lead

Shared quote discovery can grow into controlled online execution across supported protocols. Native
[Agent Key](../../proposals/AIP-0001-delegation-v1.md) develops bounded outgoing authority, while
[conditional settlement](../../proposals/AIP-0007-conditional.md) develops the conditions linking payment
and delivery. Together with protocol-specific adapters, those directions can support more autonomous
providers and Agents purchasing services from one another.

## Settlement and operating conditions

Current AIBRC transfers follow [the specification, §§5–7](../../spec/AIBRC_PROTOCOL_V0.25.md). A PSBT
coordinates a Bitcoin transaction; each asset leg still needs its protocol's identity, authorization,
balance and receiver checks. BRC-20 transfer inscriptions have first-transfer semantics and cannot serve
as reusable order credentials. The AIBRC–BTC example does not establish general BRC-20/Runes delivery.

A signing component must check the exact transaction, current inventory and signature coverage. Native
Agent Key's outgoing allowance would bound spending; it would not establish profitability, reserve
inventory or enforce the return of exchange proceeds. A provider must define those application controls
and its response to expired quotes, partial results and price changes.

A long-lived unattended offer needs enforceable settlement conditions and continued inventory validity.
A signed PSBT alone does not reserve an AIBRC script-account balance. X1 supplies only the external chain ID
and address; reading or acting on an external contract needs the appropriate tools and application adapter.
It does not move assets between networks.

If indexing is incomplete or sources disagree, keep the original operation pending verification. Recover
its result before issuing another payment. See the chapter's
[settlement conditions](../05-cross-protocol.md#settlement-conditions-four-separate-questions).
