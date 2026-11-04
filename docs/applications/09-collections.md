# 09 · Collections and Distinct Digital Rights

**Proposed / Research**

A digital work carries a story, a creator and a community. A collection can make those relationships
inspectable by connecting an asset identity to content, provenance and a clearly described entitlement.
AIBRC's account model offers a different starting point for exploring those relationships.

The next step is to define what the holder receives: a collectible, access to a service, a licensed tool or
another explicit right. The asset becomes a recognizable part of a wider creative experience.

## Why it matters

Digital collectibles bring together content, provenance, transfer and community meaning. A mutable image link can undermine content identification; a similarly named asset can imitate a work; owning a token need not convey copyright. A collection standard should state what is identified and what is actually transferred.

Ordinals-style inscription relationships illustrate one way to identify digital content. AIBRC's script-account model is different and should not claim compatibility with every inscription or marketplace convention by changing a name.

## A practical example

A creator publishes verifiable content and an identifiable asset. A collection statement explains the relationship, while a separate rights description says whether the holder receives display permission, access to a service or another specific entitlement.

A buyer can inspect the content commitment and issuer relationship before transferring the asset. A creator community may then recognize the holder through its own clearly described access rules.

## Who pays, who earns

Sales, exhibitions, memberships and content access can generate revenue. A creator's royalty paid voluntarily by a marketplace is an application agreement. A protocol-enforced transfer charge would require its own defined rule and cannot be assumed from an ordinary Transfer.

The asset's price and its legal or service rights must not be conflated. A shared issuance origin does not promise equal prices, interchangeability or redemption across different protocols.

## How AIBRC fits

Current Deploy creates a fixed-supply asset. It does not define collection membership, NFT metadata or copyright transfer. With eight display decimals, a total supply of `1` is one smallest unit, displayed as `0.00000001`; a display quantity of `1` represented by `100000000` units is not automatically an indivisible NFT. See [the specification, §§1 and 4](../../spec/AIBRC_PROTOCOL_V0.25.md).

[AIP-0004](../../proposals/AIP-0004-bind.md) and [AIP-0005](../../proposals/AIP-0005-attest.md) offer directions for content and collection relationships.

```text
Publish checkable content
  → identify an asset
  → state collection and rights relationships
  → transfer the asset
  → apply the stated entitlement rules
```

## Building the first version

A minimal experiment should identify one work, one attributable source and one enforceable entitlement. Standardized collections still need metadata, unit semantics, relationship rules and wallet support. A content hash answers whether bytes match, not whether the issuer created them or has the right to distribute them.

Availability, infringement, duplicate issuance and misleading rights descriptions need clear handling. A token transfer cannot silently transfer credentials to an external content system.

`asset identity + content commitment + collection relation + explicit rights`.

## Where it can lead

Collections could develop into creator memberships, licensed tools, collaborative works or Living Assets.
Each adds a specific relationship to the common asset foundation. That gives communities room to create
new meanings for ownership while keeping content identity and the holder's actual rights clear.
