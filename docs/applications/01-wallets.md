# 01 · Wallets and Asset Management

**Live components**

A wallet is where an asset rule becomes a human decision. Choose a Covenant Inscription, name a recipient and
approve an exact quantity. The wallet handles transaction construction while showing what the signature
changes, what Bitcoin fees cost and how to check the result.

AIBRC's account abstraction lets that experience revolve around balances and authority. The wallet can use
the open codec and rules to explain the same operation that an independent indexer will interpret.

## Why it matters

A Bitcoin wallet already separates a payment's destination, amount and network fee. A protocol-aware wallet needs one additional explanation: BTC outputs and AIBRC balances are different records. A transaction can move BTC while its embedded asset instruction does nothing. A useful wallet makes both results understandable without asking the user to read raw bytes.

This is an extension of familiar wallet responsibilities, not a reason to replace the Bitcoin signing model. Coin selection, change and Bitcoin signature verification keep their own roles.

## A practical example

A user selects an asset and a recipient. The wallet displays the exact asset identifier, quantity, recipient script and network, then shows the BTC required to carry and pay for the transaction. The user should be able to distinguish the amount being transferred from the network fee.

After broadcasting, the wallet keeps the original transaction identity. A pending result stays pending; an unavailable indexer does not turn the user's balance into zero. Another compatible data source should be able to explain the same transaction.

## Who pays, who earns

Wallet developers may charge for hardware support, reliable data access, advanced workflows or services chosen by the user. Basic decoding and asset inspection can remain open public tools. None of these business models requires changing the asset supply or inventing a protocol fee.

For the user, the value is fewer signing mistakes, clearer recovery and less dependence on one interface. Convenience is meaningful when it reduces work while preserving the facts the user approves.

## How AIBRC fits

Balances live on script-derived accounts; authority is a protocol rule. The wallet derives the account key from the actual locking script, looks up balances by Asset ID, and constructs a Transfer that names its authorization input and allocation outputs. The input need not be the transaction's first input. Current rules are defined in [the specification, §§5–7](../../spec/AIBRC_PROTOCOL_V0.25.md).

```text
Choose asset and recipient
  → build and independently decode
  → approve the exact transaction
  → broadcast
  → check Bitcoin and asset results
```

The codec explains the instruction; the deterministic decoder explains serialized Bitcoin structure. Neither replaces Bitcoin signature verification or proof that the transaction is in the canonical chain.

## Building the first version

A complete product still needs a wallet bridge, BTC funding and fee handling, an index connection, transaction-state handling and clear errors. Start with scripts and operations the wallet can explain completely. Recheck actual prevouts and signature coverage instead of trusting a remote readable summary.

An unknown outcome must continue to be investigated by its original transaction identity. A new payment should not be created merely because the first query timed out. The shared boundaries are collected in [the trust model](../../TRUST_MODEL.md).

**What it implements:** **Live — protocol components.** A wallet can use the current issuance, transfer, script-account and decoder rules to explain AIBRC assets.\
**What it enables:** Users can understand an asset action before signing and check delivery after confirmation.\
**In plain words:** A wallet should explain what a signature changes, not merely ask for one.\
**Technical line:** `script account → decoded intent → wallet signature → canonical asset result`.

## Where it can lead

The same wallet can grow with the protocol: explain an Agent Key grant, show a height-based lock or request
a local state proof as those capabilities become specified and activated. Keep the sequence recognizable:
understand the intent, preview the transaction, authorize it and inspect the result.
