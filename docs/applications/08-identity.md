# 08 · Identity, Credentials and Community Access

**Proposed**

A useful credential answers three questions: who issued it, whom it concerns and what it means. Typed
relationships and statements could let a person's or Agent's qualifications travel between applications,
with an identifiable source and a visible validity context.

For a community, that might mean membership. For an Agent, it might mean an attributable service history.
AIBRC's proposed binding and attestation rules explore a shared language for those relationships.

## Why it matters

Memberships, professional credentials and service histories are useful because a recognizable issuer stands behind a defined statement. Combining them into one universal score can erase the most important information: who made the judgment and what it actually means.

Portable credentials should make sources easier to inspect. They need not create a mandatory real-name registry or appoint a single institution as the protocol's identity administrator.

## A practical example

A community member proves eligibility to an application using a claim from an issuer that the application accepts. An Agent presents a history of work statements without requiring the new application to copy the original platform's entire account system.

The recipient checks issuance, scope, expiry and revocation, then applies its own access policy. A credential can be genuine but irrelevant to the requested service; the application still decides which claims it accepts.

## Who pays, who earns

Training, eligibility checks, community administration and specialized verification may be paid services. Public claims can also be maintained as shared infrastructure. Fees should reflect the service performed rather than an implied monopoly over identity.

Token ownership may serve as an admission criterion, but it is not automatically proof of expertise, legal identity or reliable behavior. A product should explain the relationship rather than let a familiar badge imply more than the issuer promised.

## How AIBRC fits

[AIP-0004](../../proposals/AIP-0004-bind.md) proposes relationships between accounts and objects; [AIP-0005](../../proposals/AIP-0005-attest.md) proposes typed statements and revocation. A binding needs rules for control, update and transfer. A credential needs an issuer, subject and scope. A display name is not an authority grant.

```text
Establish the relevant relationship
  → issuer makes a typed claim
  → application verifies its current status
  → application applies an access policy
  → expiry or revocation changes eligibility
```

## Building the first version

The binding and statement formats, their state transitions and wallet displays need to be specified. Applications must decide how to handle conflicting issuers and identity transitions. Current asset transfers do not automatically provide these identity operations.

Multiple identities, name squatting and false issuance remain possible. A transferable qualification may be inappropriate for a credential tied to a specific person. Sensitive information is not made confidential merely by hashing a guessable value; the privacy model must be designed separately.

**What it implements:** **Proposed.** Express identifiable account relationships and typed claims with validity and revocation context.\
**What it enables:** People and Agents can carry attributable credentials across applications.\
**In plain words:** Know who issued a claim, whom it concerns and whether it is still valid.\
**Technical line:** `subject account + issuer + typed claim + validity/revocation context`.

## Where it can lead

A first application can present signed, scoped claims and show exactly which issuers it accepts. Further
work can combine credentials with selective disclosure, so a service asks for the eligibility fact it needs.
The result could be more portable participation with less unnecessary data collection.
