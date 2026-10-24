# 03 · From an intention to Bitcoin bytes

## A compact instruction inside a Bitcoin transaction

AIBRC instructions are carried in an `OP_RETURN` data push in a Bitcoin transaction output. The marker bytes are `41 49 42 52`, ASCII `AIBR`. An interpreter does not search arbitrary witness data, annotations or non-OP_RETURN outputs for text that changes asset state.

### Instruction discovery · Live

Extraction of one complete AIBRC marker from actual outputs, with checks on push structure and payload boundaries. Independent implementations share the same definition of an instruction.

Writing “AIBRC” somewhere in a transaction does not authorize an asset transfer.

`OP_RETURN → minimal data push → AIBR header → one instruction`.

No marker means no AIBRC state change. Two or more recognized markers make the AIBRC effects of the transaction a no-op with `DUPLICATE_STATE_INSTRUCTION`. Recognizable malformed markers participate in duplicate counting: an interpreter must not discard one and then accept another. See [§2 of the specification](../spec/AIBRC_PROTOCOL_V0.25.md) and the [public extractor](../packages/protocol/src/op-return.ts).

The first nine payload bytes are:

```text
magic       version network opcode body_length
41 49 42 52 | 01   | byte  | byte | u16be
```

Fixed-width integers are big-endian. Transfer receiver indexes and amounts use the shortest unsigned LEB128 representation; a longer encoding of the same integer is invalid. See [§§1, 3 and 5](../spec/AIBRC_PROTOCOL_V0.25.md).

## Deploy: one issuance, a fixed supply

### Fixed-supply issuance · Live

An explicit deployment authorization input, initial owner output, name and total supply. The deployment initiator and initial asset recipient can be distinct participants.

You can initiate an issuance while explicitly assigning the initial assets to another script account.

`auth_input:u16 + owner_output:u16 + name_length:u8 + name + supply:u128`.

The rules are in [§§4 and 4.1](../spec/AIBRC_PROTOCOL_V0.25.md). Deploy does not grant an additional issuance operation; the current core has no separate Mint opcode.

These bytes come from `deploy-valid-01` in the [official operation vectors](../vectors/operation-vectors.json). This is a **Signet offline test case**, not a broadcast transaction or a Mainnet issuance record.

```text
41494252010201001600000001014100000000000000000000000000000001
```

The fields are:

```text
41494252  AIBR
01        wire version 1
02        Signet
01        Deploy
0016      body length: 22 bytes
0000      authorization input 0
0001      initial owner output 1
01 41     name length 1; name A
00000000000000000000000000000001
          total supply: 1 base unit
```

A readable presentation of the decoded fields is shown below. **This JSON is a decoded view, not the wire payload.**

```json
{
  "kind": "DEPLOY",
  "version": 1,
  "network": 2,
  "deployAuthInputIndex": 0,
  "ownerOutputIndex": 1,
  "name": "A",
  "totalSupply": "1"
}
```

Decoding these bytes does not establish a valid deployment. Execution also needs the actual authorizing input and owner output, the applicable name policy, supported scripts and sighash, a valid supply, and a name not already claimed by an earlier valid Deploy. Only then does the operation create the asset and credit its owner.

```text
Raw payload
  ↓ decode
Deploy fields
  ↓ check transaction context and pre-state
  ├─ Valid → asset, name and initial balance created
  └─ Invalid → NO_OP; protocol state unchanged
```

## Transfer: several allocations of one asset

### Single-asset batch transfers · Live

One sender can allocate one asset through up to 25 allocation entries in one instruction. Several payments can share a Bitcoin transaction without becoming several independent AIBRC instructions.

State who receives how much; if one required allocation is invalid, none is applied.

`auth_input + allocation_count + asset_locator + (output_index, amount)[]`.

See [§§5–6](../spec/AIBRC_PROTOCOL_V0.25.md). The complete byte limit also applies, so 25 arbitrary large amounts are not guaranteed to fit a particular broadcast profile.

The same [vector file](../vectors/operation-vectors.json) includes `sixRecipientCompatibilityVector`, a 30-byte payload:

```text
414942520102020015000006000cd1400007010a0214031e04280532063c
```

It specifies Signet, Transfer, authorization input 0 and the asset deployed at height 840000, original transaction index 7. Outputs 1–6 receive `10 / 20 / 30 / 40 / 50 / 60` base units. The checked total is 210, which the sender must hold before execution. See [§§5 and 7](../spec/AIBRC_PROTOCOL_V0.25.md).

```text
Declared authorization input
  ↓ derive sender script account
Canonical asset locator
  ↓ resolve asset ID
Actual receiver outputs and amounts
  ↓ validate all fields
Debit total; apply receiver credits
```

A BTC output value is not an AIBRC amount. Satoshis assigned to an output belong to the Bitcoin transaction; base units assigned by Transfer belong to the protocol instruction. An interface should explain both without substituting one for the other.

## Invalid instructions: no state effect, a clear explanation

### Deterministic rejection · Live

Stable outcomes for malformed data, wrong networks, unknown versions, unsupported authority and invalid balances. Wallets and indexers can distinguish an invalid operation from a rule version they must understand before proceeding.

“it reached a block” is not an adequate explanation of asset delivery.

`APPLIED / NO_OP / NEEDS_UPGRADE + stable reason code`.

`NO_OP` means the AIBRC instruction has no state effect. It does not reverse a BTC payment in the same transaction or refund miner fees. `NEEDS_UPGRADE` requires retaining the previous verified state rather than reporting current balances after skipping an activated rule the implementation does not understand. See [§§8–9](../spec/AIBRC_PROTOCOL_V0.25.md).

| Condition | Protocol outcome | Meaning for an integration |
| --- | --- | --- |
| No AIBRC marker | NO_OP / NOT_AIBRC | An ordinary BTC transaction does not automatically move protocol assets |
| Wrong network | NO_OP / UNKNOWN_NETWORK | Do not apply state across networks |
| Malformed amount or boundary | NO_OP / corresponding format code | Do not partially allocate |
| Unsupported script or sighash | NO_OP / corresponding authority code | A valid BTC spend need not satisfy AIBRC authorization |
| Insufficient asset balance | NO_OP / INSUFFICIENT_BALANCE | The transaction may confirm without delivering this asset |
| Activated but unimplemented version | NEEDS_UPGRADE | Do not advance the verified height past that block |

The complete codes are in [reason codes](../spec/reason-codes.md).

## Payload limits and broadcast profiles

The complete protocol payload is limited to 480 bytes. The default Compatibility Profile is at most 80 bytes. Exceeding the compatibility threshold does not necessarily make an instruction invalid, and protocol validity does not mean every relay will forward it. Check the chosen node's policy against the exact transaction. See [§§1 and 1.1](../spec/AIBRC_PROTOCOL_V0.25.md).

Splitting belongs to construction and explicit authorization. A builder cannot silently replace one signed transaction with several new ones. Repeatedly sending the same rejected bytes does not establish that relay policy has changed.

## Where extensions belong

Delegation, multi-asset transfers, locks, bindings, attestations, checkpoints and conditional transfers are not current Deploy/Transfer semantics. Their purposes, format directions, validity rules, state effects and open questions are in the [proposal directory](../proposals/README.md). A reserved opcode band alone creates none of those capabilities.
