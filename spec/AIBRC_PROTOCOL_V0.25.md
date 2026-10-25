# AIBRC Protocol V0.25 Wire Format

**Status:** Current reference implementation; parameters defined by the release configuration
**Wire version:** `1`
**Operations active in this document:** Deploy and Transfer
**Scope:** Public wire rules, authorization interpretation, and deterministic state

This document defines bytes and deterministic state effects. Builder relay policy, dust values, fee selection, UI display, and application launch certification do not redefine consensus.

### Release identity and genesis boundary

The public genesis boundary **H** is the `genesisHeight` value in
[the release configuration](../config/release.json), the single maintained source
for that value. `null` means the boundary has not been selected. The current
release's Name Policy V2 activation is derived from the same H. At publication,
pin the configuration's network, H, rule identity and policy to the specification
and vector hashes. Changing a published file does not authorize an existing
network to restart from another height or erase chain history.

A conforming indexer starts at the published genesis boundary and ignores earlier
`AIBR`-shaped data for that network identity. Future operations require a published
activation design; they do not silently redefine that boundary. The current pure
classifier's explicit activated-version set is described in section 8; it is not
an implementation of a general height-based upgrade scheduler.

## 1. Encoding conventions

| Item | Rule |
|---|---|
| Byte order | Fixed-width unsigned integers are **big-endian**; Transfer allocation indexes and amounts use canonical unsigned LEB128 as defined below |
| Text | Name is 1-16 canonical bytes validated by the height-selected Name Policy; V1 is `[A-Z0-9_]`, while V2 additionally permits the exact Han and Hangul ranges below |
| Amount | Unsigned 128-bit integer (`u128`), no decimals field; display decimals are fixed at 8 |
| Input/output indexes | `u16` |
| Block height | `u32` |
| Transaction index | `u16` |
| Transaction ID in hashes | The 32 bytes represented by ordinary 64-character RPC/explorer hex order; do not reverse them |
| Protocol parsing limit | `MAX_AIBRC_PAYLOAD_BYTES = 480`, including the common header |
| Default compatible broadcast profile | `COMPAT_PAYLOAD_BYTES = 80` |
| Maximum Transfer allocation count | 25, also constrained by the 480-byte complete-payload limit |

`MAX_AIBRC_PAYLOAD_BYTES = 480` is a **protocol parsing limit**, not a promise that every Bitcoin node, wallet, relay, or miner will accept or forward the transaction. If a transaction containing an otherwise valid payload no larger than 480 bytes is confirmed in a canonical Bitcoin block, every conforming AIBRC Indexer must interpret it identically.

Bitcoin `OP_RETURN` acceptance and `-datacarriersize` are node relay/mining policy rather than AIBRC consensus. Bitcoin Core 30 increased its default policy limit, but operators can retain or restore more restrictive policy; AIBRC must not turn one implementation's default into a network-wide compatibility claim. See [Bitcoin Core 30 release notes](https://github.com/bitcoin/bitcoin/blob/v30.0/doc/release-notes/release-notes-30.0.md).

### 1.1 Broadcast profiles

| Profile | Complete AIBRC payload | Builder behavior |
|---|---:|---|
| Compatibility | `<= 80` bytes | Default; prefer compatibility with nodes and wallets retaining restrictive datacarrier policy |
| Extended | `81-480` bytes | Explicit opt-in; relay is conditional on the selected node's live policy |
| Invalid | `> 480` bytes | Do not construct, sign, parse as valid, or broadcast |

An Extended Profile transaction may be offered only when all of these are true:

1. the user explicitly selects extended single-transaction batching;
2. the Builder warns that some older or restrictively configured nodes may not relay it;
3. the selected broadcast node runs `testmempoolaccept` on the exact candidate transaction;
4. the pre-sign Decoder and post-sign Decoder both confirm that the payload and user intent are unchanged;
5. after an explicit preflight rejection before submission, or a definitive rejection before acceptance with no prior unknown submission, the Builder may propose new split transactions or PSBTs. Any changed transaction requires fresh user approval and signatures. It must not repeatedly submit a policy-rejected transaction as though the policy had changed.

A timeout, lost response or other unknown submission result does not establish rejection or non-acceptance. Keep the exact original signed bytes and transaction ID, and investigate that transaction before proposing another payment. Do not automatically split, re-sign or replace it while its result is unknown. When appropriate, rebroadcasting the byte-identical original transaction preserves its identity; it is different from constructing another transaction. A later node's rejection does not resolve an earlier unknown submission.

A compatible Builder dynamically chooses a profile from the actual encoded byte count. It must not advertise “25 allocations” as a guarantee that every combination of 25 amounts and output indexes fits one relayed transaction. More than 25 allocations is always split; 25 or fewer allocations is also split when the selected profile or 480-byte hard limit requires it.

## 2. Marker discovery

An AIBRC state instruction is carried in a Bitcoin output script with this logical shape:

```text
OP_RETURN <one pushed byte string beginning with 0x41494252>
```

`0x41494252` is ASCII `AIBR`.

Indexer processing for each transaction:

1. Inspect only the first data-push instruction immediately following
   `OP_RETURN` in each output. Its declared data must be at least four bytes and
   its available data must begin with `AIBR` to be a recognized marker.
2. Minimal direct pushes cover lengths through 75; `OP_PUSHDATA1` is minimal
   above 75 through 255, and `OP_PUSHDATA2` is minimal above 255. Their script
   length fields follow Bitcoin script encoding, independently of the payload's
   big-endian fields. `OP_PUSHDATA4` is non-minimal for this profile.
3. Count both well-formed and recognizable malformed markers. Two or more
   recognized markers make the entire transaction `NO_OP /
   DUPLICATE_STATE_INSTRUCTION`, before decoding any individual payload.
4. Zero recognized markers gives `NO_OP / NOT_AIBRC`. A marker in a second push,
   arbitrary witness, `scriptSig`, or non-`OP_RETURN` output is never discovered.
5. A single malformed recognized marker is a no-op with `NON_MINIMAL_PUSH`,
   `PUSH_LENGTH_MISMATCH`, or `TRAILING_SCRIPT_OPERATION`, according to extraction
   order. A single well-formed marker proceeds to payload classification.

An unrelated `OP_RETURN` output is not an AIBRC marker. Extra script operations
following an otherwise recognizable first push make that marker malformed;
extra bytes inside the pushed payload are instead checked by body decoding.
These rules are implemented by `extractAibrcPayloadFromScript`,
`extractAibrcPayloadsFromOutputs`, and `classifyExtractedAibrcTransaction` in
[`op-return.ts`](../packages/protocol/src/op-return.ts).

## 3. Common header

| Offset | Size | Field | V0.25 value |
|---:|---:|---|---|
| 0 | 4 | magic | `41 49 42 52` (`AIBR`) |
| 4 | 1 | version | `01` |
| 5 | 1 | network | table below |
| 6 | 1 | opcode | table below |
| 7 | 2 | body length | number of bytes after this 9-byte header |

The complete pushed payload length must equal `9 + body_length`. A mismatch is `LENGTH_MISMATCH`; an incomplete field is `TRUNCATED_PAYLOAD`.

Envelope classification order is frozen and observable:

```text
1. magic
2. base/header length and hard payload limit
3. network
4. version
5. opcode
6. declared body length and operation body
```

An invalid/foreign network returns `UNKNOWN_NETWORK` before version handling and can never trigger `NEEDS_UPGRADE`. On a recognized network, an activated unknown version triggers `NEEDS_UPGRADE` before opcode or body inspection. For wire version 1, an unknown opcode returns `UNKNOWN_OPCODE` before body validation.

### Network identifiers

| Byte | Network | Namespace |
|---:|---|---|
| `00` | Bitcoin mainnet | mainnet names |
| `01` | Bitcoin testnet | testnet names |
| `02` | Bitcoin signet | signet names |
| `03` | Bitcoin regtest | local/regtest names |

Other values are `UNKNOWN_NETWORK` and have no state effect.

### Operation codes

| Byte | Operation | State effect |
|---:|---|---|
| `01` | Deploy | create one fixed-supply asset |
| `02` | Transfer | atomically move one asset from one sender to one or more receiver outputs |

V0.25 assigns no other opcode a state effect. An unknown opcode in wire version 1 is `UNKNOWN_OPCODE` and a complete no-op.

Reserved opcode bands for future versions:

| Range | Reservation |
|---|---|
| `00-1f` | core asset operations |
| `20-3f` | registry/bind claims |
| `40-5f` | agent/memory commitments |
| `60-7f` | checkpoint/proof operations |
| `80-ef` | future version work |
| `f0-ff` | experimental/permanently reserved |

Reservation alone creates no parser or state semantics.

## 4. Deploy body

| Relative offset | Size | Field |
|---:|---:|---|
| 0 | 2 | `deploy_auth_input_index` (`u16`) |
| 2 | 2 | `owner_output_index` (`u16`) |
| 4 | 1 | `name_length` (`u8`, 1 through 16) |
| 5 | `name_length` | canonical name bytes |
| `5 + name_length` | 16 | `total_supply` (`u128`) |

The Deploy body length is `21 + name_length`, so a valid complete Deploy payload is 31 through 46 bytes.

Deploy validity requires:

- the declared indexes exist;
- the authorization input spends a supported account script and uses an allowed signature-hash type;
- the owner output is a supported spendable account script and is not `OP_RETURN`;
- structural decode reads `name_length`, captures the original `canonical_name_bytes`, and rejects invalid body boundaries, truncation, or trailing bytes without selecting a Name Policy;
- `name_length` is 1 through 16 bytes under both Name Policy versions;
- policy validation checks the original bytes before any display-string conversion according to the explicit Manifest and block-height context in section 4.1;
- no 7-bit ASCII masking, Unicode normalization, case conversion, locale conversion, compatibility mapping, or replacement decoding is permitted;
- `total_supply` is greater than zero;
- the exact canonical name bytes do not already belong to an earlier valid Deploy in canonical order.

The deployer is the authorization input's spent prevout `scriptPubKey`. The initial owner is the owner output's `scriptPubKey`. They may differ. The deployer gets no supply or protocol privilege unless it is also the owner by explicit output choice.

### 4.1 Height-selected Name Policy

Deploy consensus execution requires all three explicit inputs: current Bitcoin block height, Manifest `namePolicy` version, and the Manifest's Name Policy activation height when version 2 is declared. Missing or invalid context fails closed with `NAME_POLICY_CONTEXT_REQUIRED` or `INVALID_NAME_POLICY`; a Decoder may surface the transaction as `UNCLASSIFIED`. The payload, name contents, locale, environment variables, and caller preference never select or override the policy.

| Manifest policy | Height rule | Active validation |
|---|---|---|
| version 1 | all heights | Name Policy V1 |
| version 2 | `height < activationHeight` | Name Policy V1 |
| version 2 | `height >= activationHeight` | Name Policy V2 |

Name Policy V1 accepts only bytes `0x30-0x39`, `0x41-0x5A`, and `0x5F`.

Name Policy V2 preserves that ASCII set and additionally accepts only canonical three-byte UTF-8 sequences whose decoded code point is in one of these exact ranges:

- `U+4E00-U+9FFF` (Han unified ideographs);
- `U+AC00-U+D7A3` (precomposed Hangul syllables).

The V2 byte parser operates left to right. A non-ASCII lead byte must be `0xE0-0xEF`, followed by exactly two `0x80-0xBF` continuation bytes. `E0` requires its second byte to be at least `A0` (shortest form), and `ED` requires its second byte to be at most `9F` (no surrogate). The decoded code point must then be in one of the two ranges above. Two-byte and four-byte UTF-8, isolated continuations, truncation, overlong encodings, surrogate encodings, and every unlisted code point are `INVALID_NAME`.

Both allowed non-ASCII ranges are in the BMP. For the complete allowed set, current TypeScript string ordering and UTF-8 byte ordering are equivalent; canonical state serialization nevertheless states and implements ordering by canonical name bytes. Asset ID continues to commit those same bytes, without normalization or case folding. Visually similar but byte-distinct names may coexist; byte-identical names return `DUPLICATE_NAME`.

## 5. Transfer body

| Relative offset | Size | Field |
|---:|---:|---|
| 0 | 2 | `auth_input_index` (`u16`) |
| 2 | 1 | `allocation_count` (`u8`, 1 through 25) |
| 3 | 4 | Deploy block height (`u32`) |
| 7 | 2 | Deploy transaction index (`u16`) |
| 9 | variable | `allocation_count` repeated canonical variable-width allocations |

Each allocation is:

| Field | Logical range | Wire encoding |
|---|---|---|
| `receiver_output_index` | `u16` | canonical unsigned LEB128, 1-3 bytes |
| `amount` | `u128` | canonical unsigned LEB128, 1-19 bytes |

Unsigned LEB128 emits the least-significant seven-bit group first and uses bit 7 as the continuation bit. The final byte has bit 7 clear. The shortest possible form is mandatory: redundant terminal zero groups are `NON_CANONICAL_INTEGER`. Decoders must reject values outside the declared logical range.

The body length is dynamic. A Transfer is valid only when `allocation_count <= 25` **and** the complete header plus body is no larger than 480 bytes. Small indexes and amounts can remain inside the 80-byte Compatibility Profile; large `u128` values can require Extended Profile or transaction splitting. There is no `sender_account_id`, nonce, ticker, decimals, second asset, or mandatory/optional `intent_hash` in V0.25 Transfer.

A published reference vector is one sender transferring one asset to six distinct receiver outputs with six custom amounts, one AIBRC `OP_RETURN`, and a complete 30-byte payload. It is therefore inside the 80-byte Compatibility Profile.

Transfer validity requires:

- the authorization input exists, spends the sender account, and has an allowed signature-hash type;
- the asset locator resolves on the current canonical chain;
- every amount is non-zero;
- every receiver output exists and is a supported spendable account script;
- an encoded or constructed receiver index outside `u16` returns `RECEIVER_OUTPUT_INDEX_OUT_OF_RANGE`, not an amount-overflow code;
- checked sum and per-receiver accumulation do not exceed `u128`;
- the sender balance covers the checked total.

Repeated receiver output indexes are valid and accumulate. Any failure makes the complete instruction a no-op; no receiver is partially credited.

## 6. Account and authorization rules

```text
account_key = TaggedHash("AIBRC/account/v1", scriptPubKey)
```

`scriptPubKey` is the exact Bitcoin script byte string, not an address text encoding.
This account-abstraction model means: balances live on script-derived accounts;
authority is a protocol rule.

| Authorization script | Enabled in V0.25 | Allowed auth sighash |
|---|---|---|
| P2TR key-path | Yes | `SIGHASH_DEFAULT (00)` or `SIGHASH_ALL (01)` |
| P2WPKH | Yes | `SIGHASH_ALL (01)` |
| P2SH-P2WPKH | No | none |
| Legacy P2PKH, P2WSH, multisig, Taproot script-path, custom | No | none |

Script support is derived only from exact `scriptPubKey` bytes through `classifyScriptPubKey`:

```text
P2TR   = 0x51 0x20 <exactly 32 bytes>
P2WPKH = 0x00 0x14 <exactly 20 bytes>
other  = UNSUPPORTED
```

Caller-provided `scriptType` labels are non-authoritative metadata and cannot enable or disable a script. The same classifier is used for Deploy auth prevouts, Deploy owner outputs, Transfer auth prevouts, and Transfer receiver outputs.

`SIGHASH_NONE`, `SIGHASH_SINGLE`, and every `ANYONECANPAY` variant are invalid for the authorization input. These restrictions do not apply to separate BTC-only fee inputs.

P2SH-P2WPKH remains disabled in this implementation. There is no runtime boolean or activation-height switch that enables it in this implementation. A later version requires a separately reviewed activation ruling and vectors.

### Authorization witness interpretation

The authorization input is selected by the payload; it is not implicitly input
zero. `deriveInputSighashType` interprets a **Bitcoin-validated** witness together
with that input's actual resolved prevout script:

- For P2TR, remove a final annex only when the witness originally has at least
  two elements and the final element starts with byte `50`. Exactly one element
  must remain. A 64-byte signature means `SIGHASH_DEFAULT`; a 65-byte signature
  takes its nonzero final byte as the explicit sighash. A 65-byte form ending in
  `00`, malformed key-path shapes and script-path witnesses are unsupported.
- For P2WPKH, take the final signature byte as the sighash type after Bitcoin has
  verified the witness. AIBRC then requires `01`. Reading this byte is not a
  replacement for Bitcoin signature/script validation.
- Malformed hexadecimal or missing prevout/witness context is an adapter error,
  never permission to invent an account or silently assume `SIGHASH_ALL`.

The interpretation identity is
`aibrc-input-authorization/bip341-keypath-v1`. Restored indexer state must retain
compatible rule identity; changing authorization interpretation is not justified
merely by retaining the same economic State Hash. Refer to
[BIP341](https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki).

### 6.1 Canonical zero-balance state

The canonical balance table contains positive balances only:

- a Transfer result of zero deletes the balance entry;
- an absent entry is read as balance zero;
- canonical state serialization omits zero-balance entries;
- State Hash commits only to positive balance entries.

This is a state representation rule and does not change Transfer wire bytes.

Canonical State Hash is `SHA256(UTF8(canonical_json))`, where `canonical_json` has fixed property order `assets`, `names`, `locators`, `balances` and:

- assets sort by lowercase hexadecimal `asset_id` bytewise;
- names sort by validated canonical name bytes;
- locators sort numerically by block height, then transaction index;
- balances sort by the bytewise `asset_id:account_key` key and include positive values only;
- every bigint is an unsigned base-10 string with no leading zeroes;
- transaction IDs, asset IDs and account keys in canonical state use their specified byte lengths encoded as lowercase hexadecimal without a prefix;
- serialization contains no time, randomness, database identifier, environment value, or insertion-order dependency.

### 6.2 Exact canonical JSON layout

`serializeCanonicalState` produces compact UTF-8 JSON without whitespace:

```text
{
  "assets": [assetRecord, ...],
  "names": [[name, assetId], ...],
  "locators": [["height:txIndex", assetId], ...],
  "balances": [["assetId:accountKey", "positiveInteger"], ...]
}
```

The displayed indentation is explanatory only. Each `assetRecord` has this exact
property order: `assetId`, `name`, `network`, `totalSupply`, `deployTxid`,
`ownerOutputIndex`, `locator`. `network` and `ownerOutputIndex` are JSON numbers;
`locator` is `[height, txIndex]` with numeric elements; `totalSupply` is a decimal
string. IDs and `deployTxid` are lowercase hexadecimal strings. Transaction-context
txid input may use either hex letter case; Deploy stores the existing codec's
lowercase display encoding of those same 32 bytes. Imported state must satisfy
the canonical representation and its declared chain/rule identity before it is
accepted. A snapshot reader must not silently rewrite an already committed
snapshot's text and describe its old hash as verified. The canonical empty state is exactly:

```json
{"assets":[],"names":[],"locators":[],"balances":[]}
```

State import must validate the record relationships and rule context; hashing
well-formed JSON does not prove that its balances were obtained by valid replay.

## 7. Asset identity and locator

```text
asset_id = TaggedHash(
  "AIBRC/asset/v1",
  network_id || deploy_txid || owner_output_index || canonical_name_bytes
)
```

Tagged hash is BIP340-style:

```text
tag_hash = SHA256(UTF8(tag))
TaggedHash(tag, message) = SHA256(tag_hash || tag_hash || message)
```

The txid bytes are defined without shorthand:

```text
txid_display_bytes = hex_decode(
  the 64 hexadecimal characters returned by Bitcoin RPC or an Explorer,
  decoded from left to right into exactly 32 bytes
)
```

Exact Asset ID inputs are one network byte, `txid_display_bytes` without reversal, two-byte big-endian owner output index, and the already-validated `canonicalNameBytes`. Asset ID derivation does not reconstruct bytes from a display string. AIBRC encode, decode, Asset ID derivation, JSON APIs, and documentation all preserve this order. Only an adapter parsing or serializing the 32-byte hash inside a raw Bitcoin outpoint converts to or from Bitcoin's internal serialized byte order. See [Bitcoin transaction reference](https://developer.bitcoin.org/reference/transactions.html).

The compact Transfer locator is exactly six bytes:

```text
deploy_block_height:u32be || deploy_tx_index:u16be
```

It is resolved only against the canonical chain. A reorg that removes a Deploy removes its asset, name, locator, and downstream state. A locator is a position on the current canonical chain, not a permanent Asset ID. After a reorganization, the asset at that position may differ; consumers must revalidate the canonical block context and resolved Asset ID rather than trusting a stale locator-to-asset cache. Canonical blocks are replayed in block height and then the **original Bitcoin transaction order inside each block**. Arrival time, local receive time, and mempool observation time never decide name ownership.

A reorganization requires rollback to the common ancestor and replay of the
replacement canonical chain. This applies to asset creation, name ownership,
locator resolution and all affected balances. A Bitcoin confirmation count is
not irreversible finality. Indexer undo depth and application settlement policy
are implementation choices, not fields in the Transfer wire instruction.

## 8. Version and activation behavior

| Encounter | Result |
|---|---|
| Unknown version absent from the explicit activated-version context | `NO_OP / UNKNOWN_VERSION` |
| Version included in that context but not implemented by the Indexer | do not commit the block: `NEEDS_UPGRADE / UNKNOWN_VERSION` |
| Unknown opcode inside implemented wire version 1 | `NO_OP / UNKNOWN_OPCODE` |

An Indexer in `NEEDS_UPGRADE` must retain the previous block as `last_verified_height` and must not claim current balances.

The current pure classifier accepts a caller-supplied set of activated version
numbers and defaults to the implemented version. This is not a general
height-indexed activation manifest. A new feature requires a separately
specified schedule and complete startup, block, replay and restore integration;
changing a constant or clearing application data does not provide that design.

## 9. Stable result codes

The pure package exposes stable codes for valid, malformed, unknown, authorization, account, amount, duplicate, balance, and upgrade paths. The machine authority is the exported `ReasonCode` union in [`packages/protocol/src/index.ts`](../packages/protocol/src/index.ts); changing a code or its meaning requires updated official vectors.

The stable code `RECEIVER_OUTPUT_INDEX_OUT_OF_RANGE` is used for a receiver field outside its `u16` range. `U128_OVERFLOW` remains reserved for amount arithmetic and `u128` encoding.

Core classification outcomes are:

```text
VALID
NO_OP
NEEDS_UPGRADE
```

State application outcomes are:

```text
APPLIED
NO_OP
NEEDS_UPGRADE
```

## 10. Official fixtures and deterministic API

The pure TypeScript API provides:

```text
encodeDeploy / decodeDeploy / validateDeploy / applyDeploy
encodeTransfer / decodeTransfer / validateTransfer / applyTransfer
deriveAssetId / deriveAccountKey
encodeAssetLocator / decodeAssetLocator
classifyProtocolPayload
extractAibrcPayloadsFromOutputs / classifyExtractedAibrcTransaction
deriveInputSighashType / serializeCanonicalState / deriveStateHash
```

It uses no clock, randomness, database, HTTP, NestJS, Prisma, or production configuration.

Executable public fixtures:

- [`vectors/operation-vectors.json`](../vectors/operation-vectors.json);
- [`vectors/bitcoin-transaction-fixtures.json`](../vectors/bitcoin-transaction-fixtures.json);
- [`vectors/chain-vectors.json`](../vectors/chain-vectors.json);
- [`vectors/op-return-vectors.json`](../vectors/op-return-vectors.json);
- [`vectors/authorization-vectors.json`](../vectors/authorization-vectors.json).

The Bitcoin fixtures are structurally serialized offline transactions with deterministic placeholder signatures. They must never be broadcast. They separately label AIBRC amounts, BTC output values, BTC change, and miner fees, and provide stripped size, witness size, weight, vsize, and fees at 1/5/10/20/50 sat/vB.

## 11. Context and implementation boundaries

A decoded instruction is not proof of a successful transfer. The complete path is:

```text
Bitcoin-valid canonical transaction
  → raw outputs + resolved authorization prevout + witness
  → marker extraction and envelope classification
  → name policy / authorization / current state validation
  → APPLIED or complete NO_OP
```

Bitcoin verifies its own signatures and scripts; AIBRC interprets asset rules.
The pure package accepts transaction context and does not independently verify
Bitcoin consensus or fetch prevouts. An adapter must provide verified context,
network, original transaction position and Name Policy selected for that height.
Mempool observation alone never applies confirmed protocol state.

The two recognized operations are fixed-supply Deploy and single-asset Transfer.
There is no current mint-after-deploy operation, delegation, lock, alias registry,
conditional order, VM, automatic cross-protocol asset leg, or Merkle-state proof
rule in this wire version. Candidate extensions live in
[`proposals/`](../proposals/README.md). Merkle proofs are described only as
[Proposed](../merkle/STATE_PROOF_REFERENCE.md), separate from the State Hash above.

### Reference implementation anchors

- Encoding, Name Policy, account/asset identity, validation and canonical State
  Hash: [`packages/protocol/src/index.ts`](../packages/protocol/src/index.ts).
- Strict output marker extraction:
  [`packages/protocol/src/op-return.ts`](../packages/protocol/src/op-return.ts).
- Contextual transaction decoding:
  [`packages/protocol/src/decoder.ts`](../packages/protocol/src/decoder.ts).
- Stable result meanings: [reason-codes.md](reason-codes.md).
- Byte-level names: [naming-policy.md](naming-policy.md).

These are code and vector references, not claims about a deployed application,
Bitcoin node relay acceptance, independent audit, or production capacity.
