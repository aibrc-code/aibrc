# AIP-0003 — Height-based Asset Lock

**Stage: Proposed. No opcode, wire bytes or activation height assigned.**

Height-based locks make a defined asset quantity unavailable until a specified Bitcoin height. Vesting, team allocations and task bonds use the same independently checkable availability rule.

`spendable = balance − activeLocks(height)`.

## Purpose

Provide a simple cliff lock before considering linear releases, schedules or
conditional escrow. This is an AIBRC asset rule, not a Bitcoin script change:
it does not lock native BTC or prevent the relevant BTC UTXO from being spent.
It must be enforced by every AIBRC spending path, not just a wallet's UI.

## Format direction

An explicit owner authorization input, asset identity, positive amount, absolute
unlock height and unique lock identity. A deterministic release rule needs no
wall clock or periodic off-chain authority. Cancellation or early release is not
implicitly allowed; any such ability must appear in the declared policy.

## Validation direction

Verify authorization and available unlocked balance. Define boundary-height
inclusivity and check amount sums without overflow. Direct Transfer, delegated
transfer and future conditional operations must all use the same spendability
rule. Multiple locks may not reserve the same available balance twice.

## State changes

Keep total ownership unchanged while tracking unavailable quantity and its
deterministic unlock condition. Alternatively, a dedicated locked-balance
namespace could make custody explicit; the two representations must not be
mixed. Every retained lock and required anti-replay identity enters canonical
state, snapshot and rollback. Release must occur in a specified order even in
blocks with no asset instruction.

## Open questions

Lock-in-place versus escrow account; fungibility of locked portions; owner
transfers after unlock; expiry indexing and concentrated release cost; interaction
with delegation; and whether an extension can ever shorten a prior lock. Rollback
below unlock must restore the earlier lock rather than leave funds freely
spendable. A time estimate such as “30 days” remains an estimate of Bitcoin
heights, not a guaranteed calendar deadline.
