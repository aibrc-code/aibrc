# R1 public calculation reference

R1 gives applications, developers and Agents a common way to calculate asset-rule
fees, fee destinations and buyback plans. Supply the same inputs to this JavaScript
reference or the frozen Solidity reference and compare the results locally.

This folder contains the complete frozen `AIBTCInscription` release, its ABI,
English and Chinese rule text, build context, bytecode, hashes and 68 golden cases.
The JavaScript interface uses native `BigInt` and the current **T/C** parameters.

## Run locally

Use Node.js 22+. No installation is needed. From the repository root:

```sh
node reference/r1/example.mjs
node reference/r1/check-vectors.mjs
node --test reference/r1/r1.test.mjs
```

You can also copy this whole `r1` folder into another project. From that folder:

```sh
node example.mjs
node check-vectors.mjs
node --test r1.test.mjs
```

The example, checker and tests run offline. They use only Node built-ins and files
in this folder.

## Files

| Resource | Open |
| --- | --- |
| Frozen Solidity reference | [AIBTCInscription.sol](artifacts/AIBTCInscription.sol) · [embedded rule text](artifacts/InscriptionText.sol) |
| Complete rule text | [English](artifacts/inscription.en.txt) · [Chinese](artifacts/inscription.zh-CN.txt) |
| Contract interface | [ABI](artifacts/abi.json) |
| Expected inputs and results | [68 golden cases](artifacts/vectors.json) |
| Release identity | [Build manifest](artifacts/build-manifest.json) · [deployment manifest](artifacts/deployment-manifest.json) · [file hashes](artifacts/artifact-hashes.json) |
| Reproducible compiler context | [Standard input](artifacts/standard-input.json) · [recorded output](artifacts/standard-output.json) · [metadata](artifacts/metadata.json) |
| Frozen bytecode | [Creation](artifacts/creation.hex) · [runtime](artifacts/runtime.hex) |
| Local JavaScript | [Pure calculation interface](index.mjs) · [runnable example](example.mjs) |
| Local verification | [Artifact and vector checker](check-vectors.mjs) · [tests](r1.test.mjs) |

## A 100,000-sat example

```js
import { quoteUserBuy, routeRuleFee } from './index.mjs';

// Graduation occurred before this trade started. T100 = 1%; C0 = buyback route.
const quote = quoteUserBuy(100_000n, 100_000n, 100n, true);
const route = routeRuleFee(quote.ruleFee, 0n);
```

| Result | Satoshis |
| --- | ---: |
| Total debit | 100,000 |
| Platform fee, 0.5% | 500 |
| Rule fee, 1% | 1,000 |
| Total fee | 1,500 |
| BUY principal | 98,500 |
| Rule fee assigned to the buyback route | 1,000 |

Fees are included in the supplied total. Before graduation, only the 0.5%
platform fee applies. The trade that triggers graduation still uses that earlier
stage; the next ordinary trade activates the rule fee.

Rounding is part of the standard: with `base=1201`, `T10` and graduation already
complete, the platform fee is 7 sats and the total fee is 8 sats. The rule fee is
their difference, **1 sat**. Round the total once, determine the platform fee,
then allocate the difference. Rounding each charge separately would give a
different result. `example.mjs` prints both examples.

## Interface

All integer inputs must be JavaScript `bigint` values from `0n` through
`UINT256_MAX`. The stage input must be a JavaScript boolean. Convert external
decimal strings explicitly with `BigInt` before calling; numbers and strings are
rejected by these functions.

| Function | Returns |
| --- | --- |
| `isValidRule(T, C)` | Whether the T/C combination is valid |
| `ceilBps(amount, bps)` | The integer ceiling of `amount × bps / 10000` |
| `quoteUserBuy(requestedTotal, executedTotal, T, postAtTradeStart)` | `platformFee`, `ruleFee`, `totalFee`, `principal`, `totalDebit` |
| `quoteUserSell(G, T, postAtTradeStart)` | `platformFee`, `ruleFee`, `totalFee`, `net` |
| `routeRuleFee(ruleFee, C)` | `creatorAmount`, `buybackAmount` |
| `planBuyback(V, N)` | `shouldExecute`, `spend`, `nextSequence`, `platformFee`, `ruleFee` |

`T` is 0 or a multiple of 10 through 500. `C0` assigns the whole rule fee to the
buyback route; `C10000` assigns it to the creator. `T0` requires `C0`. This choice
applies to the rule fee, while the platform fee remains separate.

`postAtTradeStart` is supplied by the caller. BUY requires a requested total of at
least 1,000 sats and a positive executed total within that request. After
graduation, those totals must match. SELL requires gross output `G ≥ 1000`;
the resulting net can be below 1,000.

`planBuyback` accepts a supplied available balance `V` and current event sequence
`N`. Below 1,000 sats it returns an inactive plan with zero fields, including when
`N` is `UINT256_MAX`. At the threshold it plans one purchase using all of `V` and
returns `N + 1`; that addition rejects overflow only when the plan needs it.

Rejected calls throw `R1Error` with a `code`: `InvalidUint256`, `InvalidBoolean`,
`InvalidBasisPoints`, `InvalidTax`, `InvalidBuy`, `MinimumGross`,
`InvalidDestination` or `ArithmeticOverflow`. These are local JavaScript error
labels; `ArithmeticOverflow` corresponds to the contract's checked `N + 1`.

## Frozen release and verification

The reference address is `0xed976e7b95d099c60318ef848c73d584ee5eb08a`.
The English rule text has SHA-256
`3c0b91af6cbfce5ea8eb8c6d1174c117ff34233695f480f5e6c9b3db7ddaa73b`.

`check-vectors.mjs` checks the 17-file release, its SHA-256 file digests, embedded
text, source/build identities and all **68 golden cases**, including **18 rejected
calls**. The tests add explicit rounding boundaries, integer conservation,
type/range rejection and finite generated cases with a fixed seed. These checks
compare the JavaScript implementation with frozen expected results.

The original bytes in `artifacts/` are preserved. `standard-input.json` contains
both Solidity sources and the exact compiler settings; `standard-output.json`
contains the recorded output. `build-manifest.json` pins compiler
`0.8.36+commit.8a079791.Emscripten.clang`, compiler SHA-256 and settings identity.
To reproduce compilation, pass the unchanged standard input to that exact pinned
compiler and compare its ABI and creation/runtime bytecode with the release.
The compiler is not bundled, and the local checker does not recompile Solidity.

The ABI is the authoritative Solidity interface. The build and deployment
manifests retain their original compatibility field names, including
`statuteTextSha256`; the published rule text is `inscription.en.txt`.

Keep this release and existing asset rules fixed. A future rule version needs
its own reference identity and explicit asset parameters. Code is MIT; the
permission notice is included in `LICENSE`.

## Execution boundary

R1 supplies public calculations. Applications supply actual parameters, stage,
balances and execution evidence, and handle pricing, trades and custody. A quote,
fee destination or buyback plan reports a calculation; it does not transfer funds,
complete a trade or lock assets. The 15 reserved topics, including Agent, are
documentation entries rather than executable R1 business functions. The examples
require no wallet, RPC connection, database, signing or broadcasting.
