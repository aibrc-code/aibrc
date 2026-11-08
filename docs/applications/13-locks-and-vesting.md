# 13 · Locks, Vesting and Scheduled Payments

**Proposed**

An asset balance says what an account owns. A lock adds a time or condition governing when a defined amount
becomes available. That distinction can support vesting, community commitments and service budgets with
terms every compatible implementation can calculate.

AIBRC's lock proposal uses Bitcoin block heights to express those conditions. Interfaces can turn them into
a readable schedule while retaining the exact chain-based rule underneath.

## Why it matters

Vesting and reserved budgets express future commitments. An ordinary balance tells a user what belongs to an account; it does not necessarily explain which part has been committed to another time or purpose.

Different products need different restrictions. A time lock, a revocable budget and a conditional payment are not the same agreement and should not be displayed as one generic countdown.

## A practical example

A team member receives an entitlement with clearly stated release heights. The interface shows total ownership, the currently available amount and the conditions affecting the remainder. An application reserving a task budget similarly explains whether the owner may cancel it and what happens at the deadline.

A community research service could release operating funds in stages. Its assistant would check the
currently available amount before preparing the next data purchase or contributor payment. This separates
money committed to later work from the budget the current task may use. Acceptance of the work would use
its own agreed evidence and any separately specified settlement conditions.

When the chain advances, the same rule determines availability for every implementation. The user should not have to wait for an operator to remember to press a release button unless the product explicitly requires that additional action.

## Who pays, who earns

Applications may earn from allocation, accounting and schedule-management services. A lock's value is the
explicit timing or availability commitment it makes possible. Any interest, income or price protection
would need its own economic source and terms.

Terms must distinguish the asset's ownership from its permitted use. A reserved amount cannot simultaneously be counted as freely spendable by another product unless the rules explicitly establish that relationship.

## How AIBRC fits

[AIP-0003](../../proposals/AIP-0003-lock.md) explores height-based locks and release as an extension to the
current core. It must define the asset, locked amount, calculation order, rounding, transfer and delegation
interactions, and rollback behavior.

```text
Approve amount and height conditions
  → confirm the lock
  → calculate availability for each action
  → reach the specified release condition
  → make the defined amount available
```

The implementation need not create a new release transaction for every block. Whether availability is derived lazily or represented by another deterministic mechanism belongs in the final specification, with equivalent recovery behavior.

## Building the first version

A usable extension needs specification, positive and negative vectors, state representation and every affected consumer. A minimal version can start with simple height release. Complex curves, refunds and cross-asset conditions need their own definitions.

Block height is not exact calendar time. Reorganization across a release point, partial-release rounding, restart recovery and delegated spending all need explicit outcomes. AIBRC asset locks cannot directly restrict BTC outputs controlled by unrelated Bitcoin scripts.

`locked amount + release conditions → available balance at height H`.

## Where it can lead

A simple height release is a useful first building block. Staged budgets and evidence-linked service
payments can follow when their additional conditions are specified. Each step should make the commitment
easier to understand and its availability reproducible from the same chain context.
