# Merkle State Proof Reference

**Stage: Proposed. Candidate reference format, not an activated AIBRC rule.**
This document makes one complete set of interoperability choices so builders
can review the design. The choices are not Owner-frozen parameters. There is no
Merkle implementation, executable Merkle vector suite or production proof service
in this package. The current State Hash remains SHA256 of canonical JSON, as
specified in [Wire §6.1–§6.2](../spec/AIBRC_PROTOCOL_V0.25.md#61-canonical-zero-balance-state).

- **What it implements:** Provide membership and non-membership proofs for canonical state at an identified block.
- **What it enables:** Let a wallet check whether a stated balance belongs to an identified state commitment.
- **In plain words:** Check which ledger a number belongs to without downloading the whole ledger.
- **Technical line:** `SparseMerkle256(namespace || logicalKey, value, context)`.

## 1. What a proof establishes

A valid proof establishes that a value, or an empty slot, belongs to a supplied
root. It does not by itself establish that the root came from correct AIBRC
replay, that its block is still canonical, that the source is independent, or
that any custodian holds corresponding assets. A checkpoint signature establishes
who made a statement; a Bitcoin timestamp establishes a commitment's existence
within its timestamp assumptions. Neither makes Bitcoin validate AIBRC rules.

The trust path is explicit:

```text
Verified Bitcoin chain + agreed rules
  → deterministic AIBRC replay
  → canonical State Hash + candidate Merkle root
  → context-bound checkpoint
  → account proof against that root
```

## 2. Candidate tree and domain separation

Use one depth-256 sparse binary Merkle tree for all four current state maps.
Root depth is 0 and terminal leaf depth is 256. A 32-byte path is read most
significant bit first; bit 0 chooses left, bit 1 right.

Let `SHA256` be the 32-byte digest and `TH` the BIP340-style tagged construction:

```text
TH(tag, m) = SHA256(SHA256(UTF8(tag)) || SHA256(UTF8(tag)) || m)
```

All concatenations below are raw bytes, not hexadecimal text. Integers are
unsigned big-endian. Hashes and transaction IDs use the public specification's
display-byte convention, without reversal. Use these exact, distinct tags:

| Purpose | Candidate tag |
| --- | --- |
| Key path | `AIBRC/merkle-key/v1` |
| Nonempty leaf | `AIBRC/merkle-leaf/v1` |
| Empty terminal leaf | `AIBRC/merkle-empty/v1` |
| Internal node | `AIBRC/merkle-node/v1` |
| Checkpoint statement | `AIBRC/merkle-checkpoint/v1` |

Existing `AIBRC/account/v1` and `AIBRC/asset/v1` hashes retain their original
meanings. A Merkle root is never substituted for a current `deriveStateHash`
return value or for an asset/account identifier.

## 3. Namespaces, logical keys and value bytes

Each record belongs to exactly one namespace. `path = TH(keyTag, ns:u8 || key)`.
The namespace prevents a name, locator or account key from sharing a logical key
space. Record payloads use the following complete binary layouts:

| Namespace | Logical key | Value |
| --- | --- | --- |
| `01` assets | `assetId:32` | `network:u8 || deployTxid:32 || ownerOutputIndex:u16 || nameLength:u8 || canonicalNameBytes || totalSupply:u128 || deployHeight:u32 || deployTxIndex:u16` |
| `02` names | `nameLength:u8 || canonicalNameBytes` | `assetId:32` |
| `03` locators | `deployHeight:u32 || deployTxIndex:u16` | `assetId:32` |
| `04` balances | `assetId:32 || accountKey:32` | `positiveAmount:u128` |

Names satisfy the height-selected policy and 1–16 byte bound of the underlying
state. Balance zero is represented by absence, never a stored zero leaf. The
asset key commits its own Asset ID, so the value does not duplicate it. The full
set is derived from the same validated four maps used by canonical JSON.
Unknown namespaces, overflow, trailing bytes, duplicate logical keys, invalid
asset relationships and noncanonical values are rejected before root creation.

Sort paths lexicographically by unsigned bytes for deterministic construction,
export and review. Tree location is determined by path bits, not insertion
order. Distinct logical keys mapping to the same 256-bit path must fail the
candidate format; they must not silently overwrite. Cryptographic collision
resistance is an explicit assumption, not a substitute for this check.

## 4. Leaf, empty and branch construction

For a present record with path `K` and encoded value `V`:

```text
L(K,V) = TH(leafTag, K || byteLength(V):u32 || V)
E[256] = TH(emptyTag, emptyByteString)
B(d,l,r) = TH(nodeTag, depth:u16 || l:32 || r:32)
E[d] = B(d, E[d+1], E[d+1])   for d=255 down to 0
```

At each level combine the left and right child using `B` with that level's
depth. Unoccupied subtrees use their corresponding `E[d]`, not 32 zero bytes.
The root of the empty state is `E[0]`. No duplicate-last-leaf rule, sorted-pair
hashing, variable depth, implicit padding or compressed path is permitted in
this reference version. Only nonempty paths need materialization in storage;
the semantics remain those of the full 256-level tree.

## 5. Proof serialization and verification

The candidate transport is UTF-8 compact JSON in the exact property order below.
No whitespace, extra keys, duplicate keys, floating-point heights, leading-zero
decimal strings or noncanonical hex forms are accepted. Hash/key/value hex is
lowercase without `0x`. Network and namespace are two-digit byte hex strings;
heights are unsigned decimal strings within `u32`. This avoids cross-language
numeric ambiguity without changing underlying integer bytes.

```text
version                = "aibrc-state-proof/1"
scheme                 = "smt256-sha256-tagged/1"
network                = two-digit hex byte
genesisHeight          = decimal string from chosen release
manifestHash           = 64 hex characters
height                 = decimal string
blockHash              = 64 hex characters
protocolStateHash      = 64 hex characters (current canonical JSON hash)
root                   = 64 hex characters
namespace              = "01" / "02" / "03" / "04"
logicalKey             = hex of namespace-specific key bytes
value                  = hex value bytes, or null for absence
siblings               = array of exactly 256 hashes
```

`siblings[0]` is the sibling at terminal depth 256 and is combined at branch
depth 255. `siblings[255]` is the child of the root and is combined at depth 0.
For a present value, decode and validate its namespace form and compute `L`.
For absence, begin from `E[256]`. For step `j=0..255`, let `d=255-j`; use path
bit `d` to order the accumulator and `siblings[j]`, then compute `B(d,...)`.
The final accumulator must equal `root` byte for byte.

The client must separately match the entire proof context to an accepted
checkpoint and current canonical Bitcoin chain. Do not accept a correct proof
for another network, genesis selection, manifest, block or stale root. A proof
for an empty balance slot shows absence under that root; it says nothing about
another account, asset or later block.

This deliberately simple proof has 8,192 bytes of raw sibling hashes. Hex JSON
roughly doubles that portion, plus context and leaf data. A short proof size,
compression ratio or mobile verification performance is not claimed. Compressed
proofs and multiproofs require separate canonical formats and vectors.

## 6. Root and checkpoint statement

A root is published with the complete interpretation context. Candidate binary
checkpoint preimage:

```text
formatVersion:u8 (=1)
network:u8 || genesisHeight:u32 || manifestHash:32
height:u32 || blockHash:32
protocolStateHash:32 || merkleRoot:32
```

`checkpointId = TH(checkpointTag, preimage)`. The manifest hash identifies the
agreed rule version, authorization interpretation, activation schedule and
vector/specification identities. Its actual public schema must be finalized
before activation. The public genesis placeholder is `{GENESIS_HEIGHT}`; this
document supplies no real release height or manifest hash.

An optional signed statement must bind `checkpointId`, signer identity, signature
scheme and key-rotation policy. This reference does not select a signer set,
quorum, reward or finality rule. Putting a checkpoint in `OP_RETURN` creates a
Bitcoin commitment, not automatic protocol acceptance of its root. The proposed
[checkpoint instruction](../proposals/AIP-0006-checkpoint.md) must distinguish
publication from trusted bootstrap acceptance.

## 7. Snapshot startup and reorganization

A candidate snapshot contains the context above, exact canonical state bytes,
all nonempty typed tree records, and format identifiers. Before installing it:

1. Validate network/genesis/rule identity and the Bitcoin block's canonicality.
2. Verify the canonical bytes' current SHA256 State Hash, parse the four maps,
   and check their invariants; no uncommitted auxiliary index is authoritative.
3. Derive every typed tree record from those same maps and recompute the root.
4. Compare both hashes and the block context with the chosen checkpoint source.
5. Record the bootstrap trust decision, then replay subsequent canonical blocks.

Snapshot hash equality proves byte integrity, not historical correctness. A
full genesis replay offers a different trust basis from checkpoint bootstrap;
the UI should distinguish them. An authenticated transport, signatures and
multiple sources may improve integrity and accountability, but cannot prove
omitted historical execution by themselves.

On reorganization, invalidate statements tied to orphaned block hashes, restore
the common ancestor's complete compatible state, and replay the new branch.
Publish replacement roots with new block context; do not overwrite history in a
way that makes an orphaned proof appear current. If undo data is unavailable,
halt current-state claims and use an explicitly validated recovery source.

## 8. Multiple indexers and disagreement

Only compare statements sharing network, genesisHeight, manifestHash, height
and blockHash. Then compare State Hash and Merkle root. Different block hashes
may reflect chain-tip lag or competing branches; different manifests are a rule
identity mismatch. Neither should be presented as a simple balance disagreement.

For matching context but different roots, preserve both statements and compare
earlier block checkpoints to find the first divergence. Recompute that block
from the same parent state and verified transactions. Independent implementations
and independent chain sources matter; several endpoints sharing one backend do
not count as independent witnesses. A majority of matching roots is evidence of
agreement, not a new consensus mechanism or proof of correctness.

## 9. Before this can become a usable format

Publish independent empty/single/multiple-leaf roots and inclusion/absence
proofs, insertion-order equivalence, each namespace, name-policy boundaries,
key/value mismatch, wrong sibling order/depth/context, malformed serialization,
snapshot tampering, activation and reorganization vectors. Independently check
the hash implementation and cross-language bytes. Measure update/storage cost,
proof size and verification time under a declared workload.

No such Merkle-specific validation has run as part of this documentation. Future
state fields such as grants or locks require a versioned namespace and complete
snapshot/undo/serialization integration; adding a map does not automatically add
it to either current State Hash or this candidate tree. Final parameter and
activation choices remain proposal decisions.
