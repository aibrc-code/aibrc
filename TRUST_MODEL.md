# Trust model

Open verification starts with a clear chain of evidence. This reference explains what Bitcoin validates,
what AIBRC interprets and what an application must establish about its own service. These responsibilities
let independent builders reproduce results and make informed choices about the systems they use.

## The verification chain

AIBRC state calculation starts from transactions and a canonical chain validated
under Bitcoin's rules. Bitcoin validates signatures, script spending, UTXOs and
block consensus. This package recognizes instructions, checks protocol-level
authorization forms and computes asset state. These are distinct layers.

```text
Validated Bitcoin chain
  ↓ canonical order, inputs, actual previous outputs
AIBRC recognition and authorization rules
  ↓ valid instruction or explicit no-op
Asset and script-account state
  ↓ canonical serialization
State Hash
```

**Account abstraction:** balances live on script-derived accounts; authority is a protocol rule.

A witness supplied by an application is not proof of a valid Bitcoin spend.
`deriveInputSighashType` interprets structure and signature flags; it does not
cryptographically verify signatures. A reliable Bitcoin verifier must establish
spend validity and supply the actual prevout scripts and amounts. Successful
encoding or decoding is not evidence that the protocol pre-state permits an
operation.

## Known boundaries

Application examples such as R1, X1 or trading tools are not services provided by
this SDK. Their execution evidence belongs to the application. Passing core
vectors does not validate an application's custody, economics or market behavior.

- Script accounts and Bitcoin transactions are public. Pseudonyms do not create
  anonymity or a privacy protocol.
- Current `stateHash` is SHA-256 of canonical JSON, not a balance Merkle proof.
  The [Merkle reference](merkle/STATE_PROOF_REFERENCE.md) is Proposed.
- Several indexers can agree on the same wrong input, rule version or chain
  view. Agreement is a comparison point, not a substitute for correct replay.
- Reorganization changes canonical history. Implementations must undo the old
  branch and replay the new one; changing only the tip pointer is insufficient.
- A compact asset locator resolves in the current canonical chain. It is not a
  permanent substitute for a full Asset ID or frozen transaction identity.
- Atomic Bitcoin inclusion does not guarantee that every protocol accepts its
  asset leg. Each leg and its consideration must be checked. A presigned Bitcoin
  transaction does not reserve an AIBRC script account's future balance.
- A root, checkpoint, timestamp and independent recomputation establish
  different facts. None alone proves reserve coverage, application compliance
  or the reliability of an external service.
- The SDK holds no keys and implements no wallet, custody, broadcasting, funds
  ledger or production index service. Its structural parser does not validate
  arbitrary Bitcoin scripts.

Bitcoin confirmation is probabilistic, not unconditional finality. Missing data,
an unknown submission result or an orphaned block must not be presented as a
completed payment, a safe refund or permission to sign a replacement.

Integrators own their resource limits. Bound untrusted transaction size and
processing time before parsing; the protocol payload limit is not a limit on
all witness, transaction or historical-data costs. The in-memory vector harness
is not a production storage or public-service architecture.

## Public discussion and versioned correction

The protocol has no team and no private channel; issues are discussed in public
Issues and AIPs; rule defects can only be corrected by a new version.

Do not post private keys, seed phrases, credentials or personal account data.
Describe the affected rule/version, assumptions and a minimal public example.
Public discussion is not an emergency-response service or a guarantee that a
maintainer will resolve a report. A corrected rule requires an explicit version
and activation decision; silently changing historical interpretation is not a
repair process. Individual applications retain responsibility for their own
service support and incident handling.

AIBRC remains an open experiment. Public vectors and self-tests help expose
inconsistency; they are not a complete audit or a claim that all risks have been
eliminated.
