# 08 · Protocol evolution: from asset rules to open Agent economies

AIBRC begins with assets, script accounts and deterministic state. Its next chapters explore how the same
foundation can express limited authority, timed availability, identity relationships and settlement conditions.
The direction is composable: each new rule adds a building block that independent applications can use.

## Seven proposals, one shared foundation

| Proposal | New building block | What builders could create |
| --- | --- | --- |
| [AIP-0001 · Agent Key](../proposals/AIP-0001-delegation-v1.md) | Asset-specific delegated authority, total allowances and height bounds | Bounded assistants and community operating roles |
| [AIP-0002 · Multi-asset transfer](../proposals/AIP-0002-multiasset-transfer.md) | Several assets allocated in a defined operation | Richer distributions and same-protocol asset interactions |
| [AIP-0003 · Lock](../proposals/AIP-0003-lock.md) | Height-based availability and explicit release rules | Vesting, reserved budgets and scheduled commitments |
| [AIP-0004 · Bind](../proposals/AIP-0004-bind.md) | Typed relationships between accounts and objects | Community identities, collections and service ownership relationships |
| [AIP-0005 · Attest](../proposals/AIP-0005-attest.md) | Attributable statements and receipts | Credentials, delivery records and portable work histories |
| [AIP-0006 · Checkpoint](../proposals/AIP-0006-checkpoint.md) | Statements identifying a block, rules and state commitment | Contextual indexer comparison and checkpoint exchange |
| [AIP-0007 · Conditional settlement](../proposals/AIP-0007-conditional.md) | Asset transitions gated by defined evidence | Evidence-linked payment and conditional exchange designs |

These are **Proposed** capabilities. Their identifiers organize a common design process; the current wire
instructions remain Deploy and Transfer. Exact formats, state effects and activation belong to each proposal
and its eventual versioned specification.

## From an owner key to a useful mandate

Agent Key could let people authorize a task without handing an AI their owner key. The first proposal scopes
a grant by asset, total allowance and block heights. A controlled signing component and the protocol's
interpreter enforce the mandate, while the model handles planning and interaction.

That foundation can be combined with identity, receipts and separately specified settlement conditions.
A service Agent could purchase a dataset, leave a work receipt and operate from an explainable budget. The
[Smart Covenant chapter](04-smart-covenant.md) covers scope and revocation; the
[Agent guide](applications/04-delegated-agents.md) develops a concrete scenario.

```text
Read and understand
  → preview and prepare
  → obtain explicit authority
  → execute within the mandate
  → inspect the result and receipt
```

Existing application tooling already offers three read-only MCP tools: `list_markets`, `get_market` and
`get_recent_trades`. They expose public market data with source time and status. This is a useful first step
for Agent integration; protocol grants are the separate proposed step toward bounded asset operations.

## From a whole ledger to a local proof

The current canonical state hash is `SHA256(canonical_state_bytes)`. It gives independent implementations a
fingerprint of the complete state for the same network, block and rules. Canonical serialization currently
traverses that state and sorts its records.

The [Merkle reference](../merkle/STATE_PROOF_REFERENCE.md) proposes a different output: domain-separated sparse
trees for assets, names, locators and balances. A client accepting an appropriate state root could verify one
record with its authentication path rather than download the entire ledger.

```text
Canonical history + protocol rules
  ↓
Independent state calculation
  ├─ Current state hash → compare complete results
  └─ Proposed Merkle root → verify local records
```

The formats remain distinct. The reference's uncompressed 256 sibling hashes alone occupy 8,192 bytes.
Compression and aggregation are further work. A proof verifies a path to a root; the client also needs a
justified basis for accepting that root's chain and rule context.

## Independent verification, close to the person using it

Open code and shared vectors let builders create genuinely independent implementations. Wallets, data
services and user-side Agents could compare a block identity and state commitment, then locate the first
place their results diverge.

```text
Bitcoin history + applicable rules
  ├─ Independent indexer A
  ├─ Independent indexer B
  └─ User-side verifier
       ↓
Compare the same block and state commitment
       ↓
Locate and recompute a disagreement
```

This is verification through reproducible calculation, without a new committee voting asset state into
existence. Checkpoints may accelerate startup under an explicit acceptance policy. Continued chain checking,
available history and implementation diversity keep that comparison meaningful.

Timestamp anchors have another role: showing that committed bytes existed before an anchoring boundary.
OTS can support that record, while deterministic replay establishes asset-state interpretation. These are
complementary evidence, with the full distinctions in the [trust model](../TRUST_MODEL.md).

## Privacy: disclose what a service actually needs

A public account ledger can still support research into better data minimization. A community application
might need an eligibility result rather than a person's complete account history. A lightweight wallet might
need a single state record rather than a full download.

[Selective disclosure](applications/14-private-proofs.md) explores those possibilities. Merkle membership,
private property proofs and confidential amounts solve different problems. The current core is public;
privacy features remain **Research**, with their proof assumptions, freshness and revocation to be specified.

## Resident Agents and Living Assets

A [Resident Agent](applications/06-resident-agent.md) explores persistent identity, a bounded treasury,
versioned memory and a service that earns its operating budget. A [Living Asset](applications/10-living-assets.md)
explores a related question: can ownership and a defined handover let a new operator continue that service?

Both keep inference and large content off-chain. Bitcoin anchors the economic history; proposed AIBRC rules
could identify authority and relationships. A complete service also needs available content, licensed tools,
operator rotation and a workable handover. These research directions give the Agent economy a concrete
shape: services that can cooperate, account for their costs and continue beyond one interface.

## Open evolution

A new capability starts with a useful question, then becomes a precise rule others can implement.

```text
Concrete use and proposed rule
  → specification and positive/negative vectors
  → implementation and independent review
  → activation context and verifier releases
  → shared interpretation under the new version
```

State changes must carry through encoding, validation, hashing, rollback, snapshots and every consumer.
The existing name-policy schedule is one defined activation rule; generic extension activation needs its own
complete design. `activatedVersions` supplies classification context, not network coordination.

Use [CONTRIBUTING](../CONTRIBUTING.md) to propose an AIP, build another implementation or contribute test
vectors. GitHub holds the shared source for this whitepaper, its rules and reference code. Code is
[MIT](../LICENSE-CODE); documentation is [CC0-1.0](../LICENSE-DOCS). The next chapter belongs to the people and
Agents who turn these building blocks into something useful.
