# AIBRC Transfer reference page

A documentation page for one AIBRC Transfer with UniSat or OKX Wallet.
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

One successful UniSat transfer has been observed with the expected receiver
output and HEX memo. This does not establish compatibility with every wallet
version. OKX in-app `send` with `memo/memoPos` remains unverified.

546 sats go to the recipient; your wallet sets the additional network fee.
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
