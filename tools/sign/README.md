# AIBRC Transfer reference page

A documentation page for Single and Batch AIBRC transfers.
Single uses UniSat or OKX Wallet to select coins, set the fee, build, sign and
broadcast. Batch prepares a multi-recipient PSBT plan locally using UniSat safe
BTC coins, then asks the wallet to sign and broadcast. Both modes read back the
original transactions. There is no platform account, backend or balance lookup.

Build the repository first (`npm ci --ignore-scripts && npm run build`).
Serve over HTTPS. The documentation build publishes the page at `/sign/`.
The protocol browser module is copied locally; no runtime CDN is used.

Prefill, without connecting or sending:

```text
/sign/?v=1&asset=<deploy-txid>&amount=1000&to=<mainnet-address>
```

`amount` means tokens (up to 8 decimal places), not base units.
The advanced input also accepts `height:txIndex` as the asset reference.
Only mainnet P2WPKH and key-path-capable P2TR wallets are supported.
The page does not establish protocol balance or deployment validity.

One successful UniSat transfer has been observed with the expected receiver
output and HEX memo. This does not establish compatibility with every wallet
version. OKX in-app `send` with `memo/memoPos` remains unverified.

In Single, 546 sats go to the recipient; your wallet sets the additional network fee.
OKX `send.value` uses BTC: `0.00000546`. UniSat uses integer satoshis: `546`.
Review the wallet's own transaction details before approving.

The page distinguishes broadcast, unavailable details, unconfirmed and confirmed
transactions. Its check/refresh action reads the original txid only and never
resends a payment. A confirmed matching instruction hides that action; it is
still not proof of an applied AIBRC transfer. Check your original transaction
before making a new draft if the wallet result is unknown.

There is no telemetry, but prefilled addresses and amounts can appear in browser
history and hosting access logs. Editing the Bitcoin API constant also requires
updating the `/sign/*` CSP `connect-src` header for the same endpoint.


## Batch: one transfer, many recipients

Single remains the default. Its memo request, helpers and regression assertions
are unchanged. Batch is a separate local PSBT flow: the page prepares a complete
plan, the wallet signs it, and the page asks the wallet to broadcast in order.

1. Select **Batch**, connect UniSat, and enter the asset's deploy transaction ID
   or `height:txIndex`.
2. Paste one `address amount` per line. Spaces, a comma or tabs separate fields;
   blank lines and `#` comment lines are ignored. Amounts use token units, with
   up to eight decimal places. Duplicate addresses are merged by default; turn
   merging off to retain separate allocations.
3. Set the network fee rate in sat/vB and choose **Review batch**. The plan shows
   recipients, transactions, payload sizes, upper-bound vsize, network fees,
   546-sat payments and total BTC spent. It shows expected transaction IDs too.
4. Check the complete plan, then review the wallet's signing requests. A single
   `signPsbts` call does **not** promise one approval: ordinary applications may
   require a separate wallet review for every transaction. If batch signing is
   unavailable, the tool calls `signPsbt` in order.
5. Read the result for every original transaction. If a broadcast result is
   unknown, stop and check that expected txid in your wallet. **Retry verification
   only** reads the original transactions; it never rebuilds or resends.

### Transfer sizes and layout

The tool uses the unchanged protocol encoder to greedily fit each transaction:
**at most 25 allocations and at most 80 payload bytes**, including the header.
There is no extended-payload option here. Larger payloads require your own
compatible node and its relay-policy checks.

For an ordinary one-token amount (`100000000` base units), 12 allocations encode
as 78 bytes; 13 encode as 83 bytes and must split. Thus 30 distinct one-token
recipients become 12 + 12 + 6, in three transactions. The count depends on amount
encoding; 100 such recipients become nine transactions. These are allocations,
not a universal promise of 25 addresses per transaction.

```text
Wallet-safe, confirmed BTC inputs (sender account)
  ↓ input 0 authorizes the AIBRC Transfer
Recipients 0 … k−1: 546 sats each
OP_RETURN k: one actual encoded Transfer
Sender change k+1, when at least 546 sats remain
  ↓ change funds the next prebuilt transaction
Next recipient group → same checks
```

A sub-546-sat remainder on the last transaction becomes network fee and appears
in the reviewed total. Every intermediate transaction needs sufficient change
for its successor. The complete chain is prepared before signing and is limited
to 24 transactions. Initial funding is checked against confirmed Bitcoin
outputs, so earlier unconfirmed ancestors do not silently consume that budget.
The read service never supplies coins for selection.

Fees use the actual serialized input/output structure, with a conservative
witness-size allowance (P2WPKH DER signature or P2TR key-path signature). A wallet
may produce a slightly shorter witness; that changes the realized sat/vB, not
the already reviewed fee or recipient amounts. There is no later deduction or
fee bump. Insufficient safe BTC, unavailable confirmation data or excessive
transaction weight stops preparation before signing.

### Wallet support

| Wallet | Single | Batch |
| --- | --- | --- |
| UniSat | Existing memo flow | Documented `getBitcoinUtxos`, public key, PSBT signing and push APIs |
| OKX Wallet | Existing memo flow | Disabled: a documented safe BTC funding-UTXO provider contract was not established |

Batch uses **only** the wallet's documented safe BTC UTXO interface. It does not
fall back to an address-UTXO API, which cannot reliably identify inscriptions,
Runes or other asset-bearing coins. The wallet service's asset filtering is a
wallet dependency; this tool does not independently index those protocols.
Other wallets were considered; no wallet-specific adapter or API-key service
was added merely to expand the list.

P2WPKH uses `witnessUtxo` and `SIGHASH_ALL`. Standard P2TR key-path inputs also
include the wallet's original public key in x-only `tapInternalKey` form;
`toSignInputs.publicKey` retains the exact public key returned by the provider.
The ordinary tweaked signer is used, without a script-path or disable-tweak
shortcut. No private key or seed is requested, generated or stored.

### Checks and failure handling

The page checks the encoded instruction before signing, then validates every
returned signed PSBT against the prebuilt transaction **before broadcasting the
first one**. It rejects changed inputs, outputs, amounts, fees or authorization.
After broadcast, it reads the original txid and checks all intended allocations,
546-sat outputs, authorization input and the one OP_RETURN payload.

At the first broadcast failure or unknown result, subsequent transactions are
not sent. The result lists broadcast, unknown and not-broadcast transactions by
expected txid and exact source lines, including non-adjacent lines merged together. Wallet rejection, account/network changes and delayed callbacks
cannot authorize a replacement draft automatically. Starting a new batch draft retains the previous results as a read-only snapshot
in the same open page. It does not remove recipients from the text or resume
sending. Copy the results before reloading or leaving; this reference tool has
no persistent/server-side history or automatic resend queue.

A matching transaction structure proves what bytes were broadcast. Whether the
Transfer took effect still depends on the sender's AIBRC balance and protocol
validity at execution. This tool does not query an AIBRC balance service.

### Build and offline tests

The minimal BIP174 v0 serializer and transaction parser are local source files;
no runtime PSBT library, external script or CDN was added. `bitcoinjs-lib` is a
pinned **development-only** oracle. The tool-local lockfile keeps these test
dependencies out of the protocol package's runtime dependencies.

```sh
# Repository root
npm ci --ignore-scripts
npm run build
npm run test:sign

# Build the actual documentation frame used by the browser suite
python3 -m venv .docs-venv
.docs-venv/bin/pip install -r site/requirements.txt
.docs-venv/bin/mkdocs build --strict -f site/mkdocs.yml

# Tool-local test dependencies; no wallet or network transaction is needed
npm ci --prefix tools/sign --ignore-scripts
node --test tools/sign/batch.test.mjs tools/sign/psbt.test.mjs
BATCH_SITE_DIR=./site-build node --test tools/sign/batch.browser.test.mjs
```

The browser suite uses Playwright and injected mock providers. Its witnesses are
synthetic non-signatures. It never connects to a real wallet, signs an actual
transaction or broadcasts. Use an existing compatible Chromium installation
for the browser suite. The static-site hook publishes only the required local
runtime modules, not tests, dependency directories or wallet evidence.

### Owner's five live-wallet checks (not run by Codex)

1. On a small-value account, select Batch and compare the connected mainnet
   address with the wallet. Prepare three recipients and verify amounts, fees,
   outputs and change in the plan. A live test is a separate funds decision.
2. Open the wallet review. Compare every recipient, 546-sat payment, fee and
   sender change before approval; verify the wallet accepts the P2WPKH/P2TR
   fields used by that account.
3. If approved by the account owner, complete that small transfer. Check the
   original Bitcoin txid and the AIBRC result using the owner's chosen indexer.
4. Separately review a 30-recipient plan. Confirm three prebuilt transactions,
   wallet review behavior, chained change and in-order wallet broadcast. Batch
   confirmation count and unbroadcast parent/child signing remain live-wallet
   compatibility checks, not mock-test results.
5. Exercise a wallet rejection or read failure without deliberately spending
   twice. Confirm the displayed original txids and that verification retry
   performs reads only. Do not retry an unknown broadcast as a new payment.
