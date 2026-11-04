# 10 · Living Assets: Services That Can Change Hands

**Research**

A Living Asset explores ownership of something that keeps doing useful work. Its relationship to a service
includes a versioned package, an operator, a budget and an explicit handover process. A buyer receives a
clearly described entitlement, and a successor has a way to continue the service.

This connects AIBRC's transferable asset foundation with the emerging world of Agents, digital tools and
ongoing creative services.

## Why it matters

Dynamic works and AI services often rely on their original maintainers. An asset may change hands while the model, running account, content and keys remain with the old operator. The word “ownership” becomes ambiguous unless those dependencies are explained.

A Living Asset explores continuity across that gap. It does not assume that a token transfer automatically moves every external right or credential.

## A practical example

A user acquires an asset linked to a specialized service. The service package identifies the current operator, content version, budget and permitted actions. As it operates, it publishes attributable updates and receipts.

When ownership changes, an explicit process determines what follows the asset, which authority must be replaced and which terms need a new approval. The successor should be able to demonstrate continued operation using the documented package.

## Who pays, who earns

Users may pay for interaction, professional tools, data or content. Those payments can fund maintenance and delivery. Trading the ownership asset changes ownership; it should not be the service's only source of operating funds.

A transferable entitlement must explain whether the buyer receives service access, governance authority, operating responsibility or something else. These rights may have different owners and cannot be collapsed into a single balance without defining their relationship.

## How AIBRC fits

Asset identity supplies a transferable foundation. [AIP-0001](../../proposals/AIP-0001-delegation-v1.md) can inform bounded authority, while [AIP-0004](../../proposals/AIP-0004-bind.md) and [AIP-0005](../../proposals/AIP-0005-attest.md) can inform versioned relationships and statements. The current core has no general service-state or automatic-handover instruction.

```text
Create a service package
  → identify operator and budget
  → publish versions and receipts
  → authorize an explicit handover
  → successor continues the service
```

The [Resident Agent](06-resident-agent.md) is a related research direction focused on identity and economic continuity; a Living Asset focuses on the relationship that changes hands.

## Building the first version

A first prototype can have one service and one operator role. It needs versioned content, authority replacement, budget policy and a defined stopping condition. A handover test lets an authorized third party resume the service under the replacement authority.

A hash does not ensure download availability, and downloadable code does not establish model or data licenses. An old operator may retain copies, while a buyer may not automatically gain control of external accounts. The handover terms cover content availability, licenses, retained copies and control of external accounts.

`asset owner + operator authority + versioned content + operating budget`.

## Where it can lead

An early example could be a specialized research tool or a community service with one replaceable operator.
Demonstrate the handover, keep the service package available and show how the new operator acquires its
mandate. A network of such assets could let useful services continue across changes of owner and interface.
