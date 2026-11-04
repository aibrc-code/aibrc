# AIBRC Transfer reference page

A static page for one AIBRC Transfer with UniSat or OKX Wallet.
The wallet selects coins, sets the fee, builds, signs and broadcasts.
The page encodes the instruction and checks the returned Bitcoin transaction.
No platform account, backend, indexer, balance lookup, MCP or PSBT library.

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

Three live-wallet checks remain: UniSat receiver output order, its exact
HEX memo encoding, and OKX in-app support for `send` with `memo/memoPos`.
Test mode does not certify these wallet behaviors. Start with a small test.

546 sats go to the recipient; your wallet sets the additional network fee.
OKX `send.value` uses BTC: `0.00000546`. UniSat uses integer satoshis: `546`.
Review the wallet's own transaction details before approving.

Verification failure or timeout never resends a payment. Retry verification
only; check the original transaction in your wallet before making a new draft.
Structure verified is not proof of an applied AIBRC transfer.

There is no telemetry, but prefilled addresses and amounts can appear in browser
history and hosting access logs. Editing the Bitcoin API constant also requires
updating the `/sign/*` CSP `connect-src` header for the same endpoint.
