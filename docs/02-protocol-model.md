# 02 · Covenant Inscription and account abstraction

## One Address, Multiple Assets

AIBRC records native asset balances on accounts associated with Bitcoin addresses. One address can hold
multiple AIBRC assets. A transfer states which asset to move, how much and who receives it. The assets are
not tied to individual satoshis, and an ordinary BTC payment does not automatically move the account's
token balances.

For an Agent, that is a practical starting point: query an account's holdings, calculate a payment or
distribution and prepare the recipients. Its user can review the same asset, amount and destination in a
wallet. The current account model supports Taproot (P2TR) and Native SegWit single-key (P2WPKH) scripts.

### From Account Balances to an Authorized Transfer

Drawing on the account-balance model and common asset interfaces familiar from other blockchain ecosystems,
including [ERC-20](https://eips.ethereum.org/EIPS/eip-20), AIBRC separates asset accounting from BTC coin
selection. The wallet constructs and signs a Bitcoin transaction. The protocol identifies the sender's
account through the designated authorization input, then applies the instruction to its balances.

There is no need to find a dedicated UTXO carrying the tokens. Developers can build reusable tools around
shared account and asset interfaces, while Bitcoin funding and AIBRC authorization retain their own rules.

Address balances also appear in BRC-20 and other asset systems. The useful foundation is the defined
interface: AIBRC publishes how to derive an account, identify an asset, authorize an operation and calculate
the resulting balances. Tools can reuse those definitions while preserving each protocol's transfer rules.

### Where the balance lives

| Standard | Where you hold the asset | How you transfer it | When you spend BTC or ETH |
| --- | --- | --- | --- |
| **AIBRC** | Fixed-supply tokens recorded against a Bitcoin address | Authorize a Transfer instruction in one Bitcoin transaction | A regular BTC payment leaves your AIBRC balance in place |
| **ERC-20** | A token contract tracks the balance for each holder address | Call the token contract's transfer function | Spending ETH leaves the token balance in place |
| **Runes** | Rune balances assigned to Bitcoin transaction outputs | Spend the outputs and allocate the runes to new outputs | Check which outputs carry runes before spending them |
| **BRC-20** | Balances tracked by Bitcoin address under the inscription rules | Inscribe the transfer, then send the transfer inscription | Keep track of active transfer inscriptions when spending their outputs |

AIBRC uses BTC inputs to fund the transaction and a designated input to authorize the transfer. The example network fee is about $0.38 at 1 sat/vB. The total depends on the transaction size and BTC price.

[ERC-20 token standard](https://eips.ethereum.org/EIPS/eip-20) · [Runes specification](https://docs.ordinals.com/runes/specification.html) · [BRC-20 transfer rules](https://domo-2.gitbook.io/brc-20-experiment/)

## Asset identity: names help people; identifiers distinguish assets

A Covenant Inscription is an AIBRC-native asset with a fixed supply, an exact identity and balances on script
accounts. Its name makes it recognizable; its Asset ID lets independent software identify the same asset.
AIBRC derives that ID from the network, deployment transaction, initial owner output index and canonical
name bytes. A valid deployment assigns the supply to the initial owner's script account.

### Fixed-supply assets · Live

Deploy creates an asset and establishes its name, identity and locator in the current canonical chain. Wallets can distinguish assets by identifier while presenting readable names.

A familiar name is not a substitute for checking which asset you are receiving.

`asset_id = TaggedHash("AIBRC/asset/v1", network || deploy_txid || owner_vout || name_bytes)`.

Exact byte order is defined in the [specification, §§4 and 7](../spec/AIBRC_PROTOCOL_V0.25.md). Transaction IDs are decoded from their ordinary RPC display order. An adapter reading or writing a raw Bitcoin outpoint is responsible for converting its serialized byte order.

Names contain **1–16 canonical bytes**, not 1–16 arbitrary characters. Name Policy V1 permits uppercase ASCII letters, digits and underscores. V2 adds specific Han and Hangul ranges under an explicit block-height context. Implementations must not apply case conversion, Unicode normalization or visual-character substitutions. The [name policy](../spec/naming-policy.md) gives the exact rules.

Amounts are unsigned 128-bit integers with a fixed display precision of 8. An amount of `100000000` base units is displayed as `1`; `1` base unit is displayed as `0.00000001`. Asset creators do not choose another decimals field. Encoding, validation and balance arithmetic use integers, not floating-point approximations of display amounts. See [§§1 and 4–6](../spec/AIBRC_PROTOCOL_V0.25.md).

## Account abstraction: assets belong to accounts

A Bitcoin address is a human-readable representation of a script. AIBRC derives the account key from the exact `scriptPubKey` bytes, not from the address text. A correct ownership calculation therefore starts with the actual script.

The common definition is: **balances live on script-derived accounts; authority is a protocol rule**.

### Script accounts · Live

The same supported script produces the same AIBRC account key. Wallets and indexers can derive account identity from shared script material.

A website registration does not determine who owns a protocol asset; the script account does.

`account_key = TaggedHash("AIBRC/account/v1", scriptPubKey)`.

```text
Bitcoin address
  ↓ corresponding scriptPubKey
AIBRC script account
  ↓
Covenant Inscription asset balances
```

### Supported mainnet addresses

| Address type | Familiar prefix | Required script type |
| --- | --- | --- |
| Taproot | `bc1p…` | P2TR |
| Native SegWit, single public key | `bc1q…` | P2WPKH |

Not every `bc1q…` address is supported: the same prefix can also represent other script types. The actual `scriptPubKey` determines compatibility. P2WSH and address types using `1…` or `3…` are outside the current support set.

The indexer identifies AIBRC instructions in Bitcoin transactions and updates the accounts involved in valid operations. It does not pre-create an AIBRC balance for every Bitcoin address.

For authorization, P2TR uses the supported key-path form; Taproot script-path spending and arbitrary multisig or custom-script authorization are not included. The authoritative rules are in [§6 of the specification](../spec/AIBRC_PROTOCOL_V0.25.md), with the [public classifier](../packages/protocol/src/index.ts) providing the reference implementation.

BTC remains a UTXO asset. An AIBRC balance is not attached to a particular satoshi or asset UTXO. Spending a BTC UTXO does not automatically transfer all AIBRC held by its script account: a valid protocol instruction is required. Conversely, script-account balances do not remove the BTC inputs, outputs or miner fees needed to construct a transaction.

## Authority: the payload identifies the authorizing input

A transaction may have several participants. One input can fund fees while another authorizes an asset transfer. An application can help assemble the transaction. The interpreter must not assume that input zero always represents the asset sender.

### Explicit authorization inputs · Live

Deploy and Transfer identify an authorization input index and check that input's actual script and sighash type. Fee funding and asset authority can be distinguished.

Paying your miner fee does not give someone permission to spend your assets.

`declared auth_input_index → spent prevout script → allowed authorization`.

P2TR authorization accepts DEFAULT or ALL; P2WPKH accepts ALL. SINGLE, NONE and all ANYONECANPAY variants are invalid for the authorization input under current rules. This restriction does not apply to separate BTC-only fee inputs. See [§6](../spec/AIBRC_PROTOCOL_V0.25.md).

The reference code interprets witness structure and sighash without reimplementing Bitcoin signature verification. Integrators must still obtain context from Bitcoin-validated transactions and their actual prevouts. A caller-provided `scriptType` label cannot replace the locking script. The public [`deriveInputSighashType` and `classifyScriptPubKey`](../packages/protocol/src/index.ts) implement this boundary.

## Transfers: one sender, several receiver outputs

A Transfer identifies one existing asset and a list of receiver output indexes with amounts. Each receiver account is derived from the actual output script. The operation updates state only after all amounts, scripts and the sender's balance have passed validation. Any failure makes the complete instruction a no-op.

```text
Sender holds 100 base units
  ↓
Instruction: output 1 receives 30; output 2 receives 20
  ├─ All checks pass → sender 50; receivers credited
  └─ Any check fails → all AIBRC balances unchanged
```

Repeated receiver output indexes accumulate. Transfers back to the sender are applied as net changes. A zero balance removes its entry; an absent entry reads as zero. The presence of an unnecessary zero row must not create another canonical state. See [§§5 and 6.1](../spec/AIBRC_PROTOCOL_V0.25.md).

## Locators and chain context

The compact Transfer locator contains the deployment block height and original transaction position. Its six-byte encoding saves payload space. It is not the full asset ID and does not establish a permanent identity independent of the canonical chain.

After a reorganization, an indexer must undo the old branch and recompute locators and subsequent transactions on the replacement chain. It must not reuse an old-branch cache and assume that the same height and position still identify the old asset. Each transaction is interpreted against the canonical state in which it executes. See [§7](../spec/AIBRC_PROTOCOL_V0.25.md).

### Canonical state hash · Live

Fixed fields, ordering and integer representations for a fingerprint of four protocol state domains. Independent indexers can compare the ledger result for the same chain context.

A hash is useful only after there is one unambiguous way to write the ledger.

`assets → names → locators → positive balances → canonical JSON → SHA256`.

The hash contains no clock, randomness or application database identity. A meaningful comparison also checks network, block hash, rule identity and verified height. Equal hashes alone do not establish that both results belong to the current canonical chain. See [§§6.1–8](../spec/AIBRC_PROTOCOL_V0.25.md).

## A shared ledger is not an anonymity guarantee

Script accounts make the ownership model explicit, but transaction inputs, outputs and protocol amounts remain observable. An account key is a hash of a script, not an anonymity system. Common spending, address use and application records can still provide links between activities.

Selective disclosure, confidential amounts and lightweight balance proofs have different design requirements. They are discussed in [extensions](08-extensions.md); they are not privacy features already provided by Deploy and Transfer.
