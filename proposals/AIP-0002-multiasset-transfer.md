# AIP-0002 — Multi-asset Transfer

**Stage: Proposed. No opcode, wire bytes or activation height assigned.**

A multi-asset transfer groups allocations of several AIBRC assets into one all-or-nothing operation. Bundles and composite payments apply every required asset leg together.

`validate(all asset groups) → apply(all deltas)`.

## Purpose

Extend current single-asset Transfer to explicitly bounded asset groups. It can
support multi-asset distribution. A two-party swap additionally needs complete
authorization for each sending account; a list of asset locators alone does not
create another party's consent or activate BRC-20/Runes legs.

## Format direction

A new operation would carry bounded groups of asset locator, authorization input
reference and allocations, with unambiguous lengths and canonical integers.
The single-marker-per-transaction rule remains; multiple current Transfer markers
must not be treated as a substitute. Exact group/allocation limits must be derived
from complete bytes and deterministic work, not assumed to be 25 per group.

## Validation direction

Resolve every asset against current canonical chain context, verify every sender,
and check all receiver scripts, positive amounts and checked aggregate debits.
Repeated assets, senders or destinations require one explicit merge-or-reject
rule. Validate aggregate debits against pre-state balances so order-dependent
intermediate credits cannot accidentally fund an otherwise unauthorized leg.
Apply all deltas only after every group passes; no partial credits on failure.

## State changes

Supply and asset identity remain unchanged. Balance changes for all included
assets commit atomically in canonical execution order. Receipts and vectors must
identify the complete result, while any application projection remains derived.

## Open questions

One sender versus multiple senders for the first version; signature coverage of
all legs; repeated-group canonicalization; limits within 80/480 bytes; allowed
self-transfers; and fee sponsorship. Atomic AIBRC state changes do not by
themselves prove validity or delivery under another protocol. Refer to
[current Transfer](../spec/AIBRC_PROTOCOL_V0.25.md#5-transfer-body) and
[AIP-0007](AIP-0007-conditional.md) for separate settlement conditions.
