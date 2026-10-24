# 06 · Indexer implementation guide

An independent indexer turns Bitcoin history into an AIBRC ledger. Every result has a traceable context:
which chain, block, rule version and accepted instructions produced it. That shared calculation lets wallets
and applications choose a data provider without giving that provider the power to invent asset ownership.

**Don't trust, verify.** An independent indexer turns that conviction into a repeatable calculation.

This chapter describes how to connect an independent implementation. The public package supplies protocol rules and decoding, not an application's production storage, query projections, service orchestration or database configuration.

## 1. Establish the verification context

### Canonical-chain context · Live (rule requirement)

Interpretation based on Bitcoin-validated transactions, prevouts and block ordering. Protocol validation without trusting arbitrary script labels or balance claims supplied by a caller.

Establish which chain you are reading before applying its asset rules.

`verified Bitcoin context → exact scripts/witness → AIBRC validation`.

An implementation needs the network, published rule identity, protocol starting parameter `{GENESIS_HEIGHT}`, name policy and its activation context. The placeholder is not a runnable Mainnet height. Historical test cases do not select it. See the [specification, §§1, 4.1 and 6–8](../spec/AIBRC_PROTOCOL_V0.25.md).

A pure decoder can parse transaction structure and interpret fields. It does not verify Bitcoin signatures or prove that a prevout exists and is spendable. Passing a manually constructed `TransactionContext` into the rules establishes only what follows from those supplied inputs.

## 2. Preserve block, transaction and output ordering

### Deterministic scanning · Live

Processing by canonical height and original transaction position, inspecting each actual output for markers. Name ownership and balance changes independent of transaction arrival time.

A server seeing a transaction first cannot move it ahead of an earlier transaction in the block.

`block height → original txIndex → output extraction → classify → apply`.

See [§§2 and 7](../spec/AIBRC_PROTOCOL_V0.25.md). Do not renumber transactions after filtering for AIBRC: deployment locators retain their original Bitcoin transaction positions.

A suggested integration flow is shown below. Bracketed storage and coordination steps belong to the integrator; they are not a complete node included in the public package.

```text
[Obtain canonical block and parent identity]
  ↓
[Preserve pre-block state or recoverable undo data]
  ↓
Traverse transactions in original txIndex order
  ↓
Extract markers from all actual outputs
  ↓
Classify and decode using real authority context
  ↓
Call public validate/apply functions
  ↓
[Atomically persist state, outcomes and verified tip]
```

The package exposes `extractAibrcPayloadsFromOutputs`, `classifyExtractedAibrcTransaction`, `applyDeploy` and `applyTransfer`. Do not write a second approximate balance updater and use the vectors only to test encoding.

## 3. Separate invalid operations from conditions that require stopping

An ordinary `NO_OP` leaves the instruction's state unchanged and permits interpretation of later transactions in the block. `NEEDS_UPGRADE` requires retaining the previous verified height rather than committing the block. Any temporary effects from earlier transactions in that block must also be undone. See [§§8–9](../spec/AIBRC_PROTOCOL_V0.25.md).

Runtime errors must not be presented as valid empty blocks. Missing prevouts, incomplete transaction context and persistence failures leave an explicitly unfinished operation that must resume from the original block identity. A timeout alone does not prove that a commit failed.

Query responses should identify at least the network, verified height, block hash, rule identity and state hash. An indexer that is behind should report that context, rather than label an older balance as a current-tip result.

## 4. Construct authorization context correctly

### Script and witness interpretation · Live

Script classification from the actual prevout followed by witness-path and sighash interpretation. Authority checks without relying on a signature-shaped byte string or caller-supplied script label.

Bitcoin permitting a spend does not mean AIBRC accepts that authorization path.

`scriptPubKey → script classification → witness path → allowed sighash`.

P2TR interpretation must distinguish key-path from script-path spending and handle the annex according to BIP341's witness structure. P2WPKH uses its own shape. The support table and authority rules are defined in [§6](../spec/AIBRC_PROTOCOL_V0.25.md) and the public [`deriveInputSighashType`](../packages/protocol/src/index.ts).

Use the same interpretation for live scanning, historical replay and snapshot recovery. Fixing one live branch while a restore path retains an old authorization identity produces incompatible ledgers.

The account-abstraction definition is consistent across these paths: **balances live on script-derived accounts; authority is a protocol rule**. A display address or caller's classification does not override the rule.

## 5. Canonical state and its cost

### Whole-state comparison · Live

Deterministic bytes and hashes for four protocol state domains through `serializeCanonicalState` and `deriveStateHash`. Comparisons that expose differences in fields, ordering and numeric interpretation.

Compare the ledger fingerprint, then locate the records that differ.

`assets, names, locators, positive balances → sorted canonical bytes → SHA256`.

See [§6.1](../spec/AIBRC_PROTOCOL_V0.25.md). Big integers are decimal strings without leading zeroes; zero balances are omitted; names are ordered by their canonical bytes.

**Current canonical serialization traverses the complete state, with additional sorting work.** It is not a constant-time growth solution. Returning one hash does not mean only one small lookup occurred. An application can reuse materialization within an unchanged state generation, but must measure state size, memory and persistence costs. A cache cannot remain valid across a state change merely because a request uses the same URL.

The Merkle reference is a separate Proposed output. It neither replaces the current `stateHash` nor establishes that incremental updates or lightweight verification have been implemented. The [proof reference](../merkle/STATE_PROOF_REFERENCE.md) defines its own identity and format.

## 6. Reorganization: undo the old branch, then interpret the new one

### Reorganization recovery · Live (protocol state semantics)

Removal of orphaned deployment and transfer effects, restoration of a common ancestor, and replay of the replacement canonical branch. Current state without retaining an old branch's names, assets or balances as present facts.

Undo the replaced pages before continuing with the new ledger pages.

`common ancestor → rollback descendants → replay canonical branch`.

See [§7](../spec/AIBRC_PROTOCOL_V0.25.md). These are required state semantics, not a promise that every implementation handles reorganizations of arbitrary depth automatically. Insufficient undo data, incompatible snapshots or an unverifiable ancestor require stopping current-state claims and restoring from a verified source.

```text
A processed block leaves the canonical chain
  ↓
Establish a trusted common ancestor
  ↓
Undo all affected old-branch state
  ↓
Replay the replacement branch in original order
  ├─ Original transaction returns → reinterpret it
  ├─ Original transaction absent → exclude it
  └─ Evidence or rules missing → retain verified state
```

Do not roll back balances while preserving stale names, locators or query projections. Do not resolve a new branch using cached old-branch interpretations. Equal heights do not establish equal block identities, and a six-byte locator is not a permanently bound full asset ID across branches.

## 7. Snapshots and startup

A snapshot must contain sufficient canonical state, chain identity, rule identity, numeric encoding and integrity material to recompute its hash. A matching hash detects inconsistent content; it does not by itself establish the correctness of the supplied history.

Replaying validated history from `{GENESIS_HEIGHT}` is one route to independently deriving state. Starting from a trusted checkpoint is another route with additional trust assumptions. Identify who supplied the checkpoint, which block and rules it covers, and what the new instance verifies afterward.

A production storage file is not automatically an interoperable standard. Canonical state, transport snapshots, query indexes and process caches serve different purposes. Unpublished platform storage is not a format that every independent indexer must copy.

## 8. Versions and activation

### Recognizable upgrade boundaries · Live / Proposed

The current classifier distinguishes unknown-version NO_OP from an activated-but-unimplemented NEEDS_UPGRADE; future extensions also require a complete height-based activation design. An implementation that does not understand new rules can stop explicitly instead of silently publishing another current balance.

Say when you cannot verify the next rule rather than pretend the calculation is complete.

`network → version classification → height-selected rule context`.

Current classification is defined in [§§3 and 8](../spec/AIBRC_PROTOCOL_V0.25.md). Name-policy height selection is a specific implemented rule. Delegation and other extensions must additionally cover old and new state formats, empty activation blocks, snapshot identities, reorganizations across activation and every actual caller. [AIP-0001](../proposals/AIP-0001-delegation-v1.md) identifies these dependencies.

An announcement cannot automatically upgrade third-party software. Builders must publish versions and vectors; users need to know whether their implementation can continue verifying.

## 9. Use the official vectors by evidence layer

The vectors cover operations, chain ordering and reorganization, OP_RETURN extraction, authorization witnesses and offline Bitcoin transaction structure. They answer different questions:

| Vector file | Main purpose |
| --- | --- |
| [operation-vectors.json](../vectors/operation-vectors.json) | Encoding, decoding, names, validity and post-state |
| [chain-vectors.json](../vectors/chain-vectors.json) | Block order, state hashes, rollback and recovery |
| [op-return-vectors.json](../vectors/op-return-vectors.json) | Marker discovery, malformed pushes and duplicates |
| [authorization-vectors.json](../vectors/authorization-vectors.json) | Authorization scripts, witness paths and sighash |
| [bitcoin-transaction-fixtures.json](../vectors/bitcoin-transaction-fixtures.json) | Offline serialized transactions, size and fee examples |

Follow the [package instructions](../packages/protocol/README.md) to build and test **from the repository root**. Then have an independent implementation consume the same JSON and compare reason codes, asset IDs, account keys, state and hashes. Final balances alone do not cover intermediate invalid outcomes or whole-block rollback.

This example decodes existing vector bytes. It performs no network requests and broadcasts nothing:

```js
import {
  Buffer,
  decodeDeploy,
  NAME_POLICY_V1_SCHEDULE,
  namePolicyContextForBlock,
} from './packages/protocol/dist/index.js';

const hex = '414942520102010016000000010141' +
  '00000000000000000000000000000001';
const decoded = decodeDeploy(
  Buffer.from(hex, 'hex'),
  namePolicyContextForBlock(NAME_POLICY_V1_SCHEDULE, 840000),
);
console.log(decoded.name, decoded.totalSupply.toString());
// A 1: a Signet offline vector, not a Mainnet transaction.
```

Run it from the repository root after building the package. Offline Bitcoin fixtures contain placeholder signatures and must never be broadcast. Passing rule tests does not establish live relay acceptance, node signature validation, wallet behavior or production throughput.

## 10. Before serving state to another application

An independent implementation should clearly identify its network, processed block, rule version, freshness, and behavior after reorganization or unknown versions. Preserve both the BTC transaction identity and protocol outcome for each operation. A failed lookup is not a zero balance.

This context lets applications use indexer results correctly and lets independent implementations investigate disagreements. Open verification is more than an HTTP endpoint: it is a path back to the inputs and rules behind the answer.
