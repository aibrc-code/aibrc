# AIP-0001 — Delegation v1 / Agent Key

**Stage: Proposed. No opcode, wire bytes or activation height assigned.**

Agent Key would let an owner authorize another script account to transfer one asset within a total allowance and a height interval. The Agent uses its own key while the owner retains the owner key.

`delegate → grantId; transfer_for(grantId); confirmed revoke`.

## Purpose

Add protocol-level delegated AIBRC transfer, independent of an application's
custodial ledger or co-signing lanes. First-version authority would permit
transfers to any supported recipient within the remaining total and lifetime.
It would not promise a minimum sale price, proceeds back to the owner, or power
to spend the owner's native BTC UTXOs. A compromised Agent key can misuse the
authority actually granted.

## Format direction

- `delegate`: explicit owner authorization input, asset locator, Agent account
  key, positive lifetime allowance, start/end heights, expected `ownerPermitNonce`.
- `revoke`: explicit owner authorization input, target `grantId`, expected owner
  generation nonce.
- `transfer_for`: owner account key, exact `grantId`, explicit Agent authorization
  input, asset locator, allocation list.

`grantId` must derive from the confirmed grant's unique identity with specified
domain separation and byte order. A renewed grant gets a new ID; pending old
Agent material must never consume the replacement grant. A successful owner
permission update advances a persistent generation nonce. The exact distinction
between owner-update sequencing and each grant's lifetime is still to be frozen;
unrelated grants must not accidentally acquire or lose authority.

## Validation direction

Verify actual owner/Agent authorization scripts and permitted sighash, asset
identity, grant instance, valid height, remaining allowance, owner balance and
receiver outputs. The revised minimal direction requires positive owner balance
when granting; allowance remains a permission limit, not reserved money. Check
everything before changing any state; failure makes the whole instruction a
no-op. Bitcoin fees are still paid for a confirmed no-op transaction.

Owner updates require the expected generation nonce; Agent spending requires
the exact active grant instance. Revoke becomes effective only after canonical
confirmation and according to original transaction order. A prior transfer in
the same block is not retroactively undone. There is no one-block confirmation
guarantee, and emptying the owner's balance is not revocation.

## State changes

Active grants, remaining allowance, persistent owner generation fences and a
deterministic expiry index enter versioned canonical state, cloning, snapshots,
undo and independent replay. Expiry may remove an active grant but must not erase
the fence that prevents old owner material from becoming valid again. An empty
block must still apply any height-based expiry rule at its specified position.
New fields do not enter existing serializers automatically.

## Open questions

Freeze grant ID preimage, nonce width/overflow, simultaneous owner updates,
revoking nonexistent grants, gross-versus-net self-transfers, exact start/end
inclusivity, expiry order, and height activation across reorganization. Finalize
payload size and query costs before claiming scale. V1 intentionally excludes
periodic allowance, re-delegation, recipient/price policies and native BTC
authority. Later restrictions require separate explicit rules rather than an
Agent's promise. See [current authorization](../spec/AIBRC_PROTOCOL_V0.25.md#6-account-and-authorization-rules).
