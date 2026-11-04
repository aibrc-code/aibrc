# Naming Policy

**Stage: Live reference rules.** This is a byte-level companion to [Wire §4 and
§4.1](AIBRC_PROTOCOL_V0.25.md#4-deploy-body), not an identity or trademark registry.

Name validation uses canonical bytes under a height-selected policy. Wallets and indexers apply the same rules across languages and operating systems to preserve asset identity.

`validateCanonicalNameBytes(bytes, explicitHeightPolicy)`.

## Bytes, not displayed characters

A Deploy name is 1–16 bytes under both policies. No case folding, trimming,
replacement decoding, Unicode normalization, compatibility mapping, locale
conversion or ASCII high-bit masking is allowed. Parse the body boundaries and
retain `canonicalNameBytes` before converting validated bytes to display text.

Name Policy V1 accepts only ASCII bytes `30–39`, `41–5a`, and `5f`: uppercase
Latin letters, digits and underscore. Lowercase letters and spaces are invalid.

Name Policy V2 retains that set and adds only canonical three-byte UTF-8 for:

| Inclusive range | Meaning |
| --- | --- |
| `U+4E00–U+9FFF` | Han unified ideographs |
| `U+AC00–U+D7A3` | Precomposed Hangul syllables |

The lead byte must be `e0–ef`, with two `80–bf` continuations. `e0` requires a
second byte of at least `a0`; `ed` requires a second byte no greater than `9f`.
After shortest-form and surrogate checks, the decoded code point must belong
to one of the exact two ranges. Two-byte/four-byte sequences, combining marks,
variation selectors, zero-width characters, fullwidth Latin characters,
compatibility ideographs and all other code points remain invalid.

Five allowed Han characters use 15 bytes; adding one ASCII character reaches
16. This is an explanation of the existing byte limit, not a six-character
guarantee for every input string.

## Explicit policy selection

The caller supplies current block height, manifest Name Policy version, and
the V2 activation height when applicable. A policy V1 schedule has no activation
height. A V2 schedule selects V1 below its activation and V2 at or above it.
Missing or invalid context fails closed; the name contents never select V2.

The public boundary H is `genesisHeight` in [config/release.json](../config/release.json).
For the current release, Name Policy V2 activation uses that same H; it is derived,
not entered a second time. A `null` height means the release boundary remains
unselected. Hosts publish and pin the concrete schedule before using it; local
environment variables or UI preferences must not override canonical interpretation.

## Uniqueness and display

The first valid Deploy in canonical height and original transaction order owns
the exact name bytes. A byte-identical later name is `DUPLICATE_NAME`; visibly
similar but byte-distinct names can coexist. Name uniqueness does not establish
an issuer's real-world identity, endorsement or intellectual-property rights.

Asset ID commits to the same validated bytes. Canonical State Hash sorts names
by those bytes, not by locale-sensitive display order. A reorganization rolls
back orphaned ownership and replays the replacement chain under its valid policy.

Implementation: [`validateCanonicalNameBytes`, `namePolicyContextForBlock`,
`deriveAssetId`, `serializeCanonicalState`](../packages/protocol/src/index.ts).
Executable positive, negative and height-boundary cases:
[`operation-vectors.json`](../vectors/operation-vectors.json).
