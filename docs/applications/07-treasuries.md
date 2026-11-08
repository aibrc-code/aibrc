# 07 · DAO and Community Treasuries

**Research**

A community treasury is more than a balance. It connects a shared purpose with budgets, operating authority
and the work paid for. Members should be able to follow that relationship from an approved decision to an
actual transfer and its receipt.

AIBRC's common asset accounts provide the base. Agent Key, locks and attestations offer proposed building
blocks for a treasury with bounded operators and an inspectable operating history.

## Why it matters

Community treasuries often sit between two unsatisfactory extremes. One hot key is convenient but powerful; requiring a new approval for every small invoice can make ordinary operations slow. Multisignature control, budget approvals and public accounting address different parts of this problem.

A DAO voting interface is only the start. The practical question is how an approved decision becomes a constrained payment, how unused authority expires and how members can inspect what happened afterward.

## A practical example

A community plans a development budget and asks an assistant to prepare contributor payments and orders
for data or verification. Members review the costs and deliverables before approving the payments. They
can then compare the approved budget with canonical transfers and the supporting delivery records.

A later treasury design could reserve future commitments and give an operating Agent a smaller total
allowance. The Agent would use its own working key for the asset transfers permitted by that grant. Any
additional requirement to pay a particular vendor or category of work belongs in separately defined policy
and execution rules.

```text
Community approves a budget
  → reserve future commitments
  → authorize a bounded operator
  → pay for actual work
  → inspect spending and delivery
  → renew, expire or revoke authority
```

For illustration, a 50,000-unit budget might reserve 30,000 units and propose a 5,000-unit operating grant.
The reserve expresses a commitment; the grant sets the operator's spending authority. Keeping them distinct
makes both the available funds and the permission easy to inspect.

## Who pays, who earns

A treasury may receive donations, income from a useful application or other explicitly identified funding.
It pays contributors, infrastructure operators and service providers. Report actual income and spending
alongside asset valuation, and connect each expense with the work delivered.

A BTC capital service could earn fees from actual activities such as inventory management or operating liquidity infrastructure. Its BTC signing and custody arrangements remain external to an AIBRC asset grant. Yield claims must identify who pays the yield, the capital at risk and the obligation being undertaken.

Governance software, accounting tools and professional review can charge for service. The protocol does not need a native governance token or a universal treasury fee to support those businesses.

## How AIBRC fits

Current balances provide an inspectable asset base. [AIP-0001](../../proposals/AIP-0001-delegation-v1.md) proposes a total spending allowance, [AIP-0003](../../proposals/AIP-0003-lock.md) explores unavailable or reserved amounts, and [AIP-0005](../../proposals/AIP-0005-attest.md) explores receipts. These building blocks have different jobs.

A grant defines an operator's permission while ownership remains with the treasury. A separately specified
lock determines which amounts remain spendable. A receipt attributes a statement to its issuer, with
delivery evaluated through the agreed evidence. Recipient whitelists, governance thresholds and
policy-limited spending require separately specified authority rules.

## Building the first version

Start with a bounded operating budget rather than the entire reserve. A product needs a governance decision format, an accounting policy, authority rotation, revocation handling and a recovery procedure. Confirmed canonical state determines protocol effects; an unconfirmed vote or application approval cannot override it.

Legal rights and operational control must match the product. A contributor's entitlement, a token holder's vote and a signer's ability to move BTC are not the same permission. Application ledgers and on-chain assets need their own reconciliation. The current delegation proposal does not include periodic allowances or a general rule that payments may go only to approved vendors.

`owned balances + bounded operator grants + explicit accounting + receipts`.

## Where it can lead

Begin with a budget-versus-spend view linked to ordinary transfers and work receipts. Activated authority
rules could then automate a narrow operating role, while the community retains control over its larger
reserve. That creates room to replace an operator without losing the meaning of prior decisions.
