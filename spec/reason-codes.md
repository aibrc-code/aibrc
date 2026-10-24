# Stable result and reason codes

**Stage: Live reference API.** The machine declaration is `ReasonCode` in
[`packages/protocol/src/index.ts`](../packages/protocol/src/index.ts).
These identifiers are compatibility contracts, not user-facing messages.

Classification returns `VALID`, `NO_OP` or `NEEDS_UPGRADE`. State execution
returns `APPLIED`, `NO_OP` or `NEEDS_UPGRADE`. A structurally `VALID` instruction
can still fail balance or authorization checks and produce state `NO_OP`.
`NEEDS_UPGRADE` retains the last verified block and forbids a claim of current
balances; it is not a malformed-transaction skip.

| Code | Meaning |
| --- | --- |
| `VALID` | The stage's required checks passed; interpret with its status. |
| `NOT_AIBRC` | No recognized marker, or bytes do not start with the magic. |
| `NON_MINIMAL_PUSH` | Recognized first-push marker uses a non-minimal script push. |
| `PUSH_LENGTH_MISMATCH` | Recognized marker's declared push exceeds available bytes. |
| `TRAILING_SCRIPT_OPERATION` | Additional script bytes follow the recognized first push. |
| `TRUNCATED_PAYLOAD` | A required payload field or encoded value is incomplete. |
| `PAYLOAD_TOO_LARGE` | Complete payload exceeds 480 bytes. |
| `LENGTH_MISMATCH` | Body length disagrees with decoded or declared length. |
| `UNKNOWN_NETWORK` | Network identifier is unknown or differs from execution context. |
| `UNKNOWN_VERSION` | Wire version is unimplemented; status depends on explicit activation context. |
| `UNKNOWN_OPCODE` | Opcode has no implemented meaning in wire version 1. |
| `DUPLICATE_STATE_INSTRUCTION` | Transaction has at least two recognized markers, including recognizable malformed markers. |
| `NAME_POLICY_CONTEXT_REQUIRED` | Required explicit Name Policy execution context is absent or unusable. |
| `INVALID_NAME_POLICY` | Explicit Name Policy schedule is invalid. |
| `INVALID_NAME` | Name bytes, length or validated text/byte consistency fail. |
| `DUPLICATE_NAME` | Exact canonical name already belongs to a valid earlier Deploy. |
| `ZERO_SUPPLY` | Deploy supply is not positive. |
| `INVALID_AUTH_INPUT` | Declared authorization input is absent or structurally out of range. |
| `INVALID_OWNER_OUTPUT` | Deploy's owner output is absent or is an invalid destination such as `OP_RETURN`. |
| `INVALID_RECEIVER_OUTPUT` | Transfer receiver output is absent or is an invalid destination such as `OP_RETURN`. |
| `RECEIVER_OUTPUT_INDEX_OUT_OF_RANGE` | Encoded/constructed receiver index is outside `u16`. |
| `UNSUPPORTED_SCRIPT` | Actual authorization or destination script is outside the supported script set. |
| `UNSUPPORTED_SIGHASH` | Authorization witness interpretation or sighash is not permitted. |
| `UNKNOWN_ASSET` | Asset locator does not resolve in the supplied canonical state. |
| `ZERO_AMOUNT` | A Transfer allocation is not positive. |
| `EMPTY_ALLOCATIONS` | Transfer has no allocations. |
| `TOO_MANY_ALLOCATIONS` | Transfer has more than 25 allocations. |
| `NON_CANONICAL_INTEGER` | Unsigned LEB128 uses a redundant representation. |
| `U128_OVERFLOW` | Amount or checked amount sum is outside its permitted `u128` range. |
| `INSUFFICIENT_BALANCE` | Sender's current balance is below total allocations. |

## Priority is part of the observable contract

Strict script extraction precedes envelope decoding. A duplicate recognized
marker wins before an individual marker's malformed-push or version result.
For a single well-formed payload, the order is magic, header/size, network,
version, opcode, body. Thus a foreign network cannot trigger `NEEDS_UPGRADE`,
and an unknown opcode is decided before its unused body is interpreted.

The result of a direct helper can differ from the result of the full transaction
classifier when the caller bypasses earlier stages. Integrators should run the
full context-based entry point and preserve its exact stage and reason.

Malformed prevout/witness context, missing expected network, invalid snapshot
identity and invalid API usage can throw adapter errors outside this union.
They are not a valid transfer, not an assumed zero balance, and not an excuse to
continue indexing without verified context. No raw error or stack trace needs
to be exposed to ordinary users to preserve the stable reason code.

Reference behavior: [Wire §2–§9](AIBRC_PROTOCOL_V0.25.md#2-marker-discovery) and
[official vectors](../vectors/README.md). Updating the meanings requires updated
specification and executable positive/negative vectors.
