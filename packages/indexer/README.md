# AIBRC reference indexer

Run the AIBRC ledger yourself. This Node.js package reads validated blocks from
your Bitcoin Core node, applies the public protocol rules, and stores a
recoverable local index in SQLite.

```text
Your Bitcoin Core → read-only RPC → AIBRC rules
                                    ↓
                           Your SQLite ledger
                                    ↓
                        Assets · balances · transfers
```

It shares the codec and state rules with `@aibrc/protocol`. It contains no
platform account database, trading engine, custody service or signer. Indexing
does not require a private key and does not submit transactions.

## Run from this repository

Use Node.js **22.16 or newer**; the indexer uses the built-in `node:sqlite` API.
The isolated walkthrough needs no Bitcoin node or credentials:

```sh
npm ci --ignore-scripts
npm run build
npm run indexer:demo
npm run test:indexer
```

The demo creates a temporary index, applies a synthetic Deploy and a transfer to
two accounts, closes and reopens SQLite, then replaces two blocks and replays.
It removes its temporary files afterward. Its block headers are not mined and
its witnesses are placeholders. Never broadcast these fixtures.

See [Run your own indexer](../../docs/run-indexer.md) for configuration, commands,
queries, recovery and the human/AI operator checklist.

## Local commands

```sh
node packages/indexer/dist/cli.js sync-once --config ./indexer.json
node packages/indexer/dist/cli.js follow --config ./indexer.json
node packages/indexer/dist/cli.js status --config ./indexer.json
node packages/indexer/dist/cli.js get-name --config ./indexer.json DEMO
node packages/indexer/dist/cli.js balances --config ./indexer.json ACCOUNT_KEY
node packages/indexer/dist/cli.js get-transfer --config ./indexer.json TXID
node packages/indexer/dist/cli.js incoming --config ./indexer.json ASSET_ID ACCOUNT_KEY FROM_HEIGHT TO_HEIGHT --limit 50
node packages/indexer/dist/cli.js balance --config ./indexer.json ASSET_ID ACCOUNT_KEY
node packages/indexer/dist/cli.js state-at --config ./indexer.json HEIGHT
node packages/indexer/dist/cli.js verify-state --config ./indexer.json
node packages/indexer/dist/cli.js serve --config ./indexer.json
```

Replace `ACCOUNT_KEY` and `TXID` with real 64-character hexadecimal identifiers.
Queries open SQLite read-only and do not call RPC. `status` describes a **local
checkpoint**; it is not proof that a stopped process is following the latest
block. A successful `sync-once` reports the tip observed in that run.
Asset, balance, tip and transfer queries return `{ context, result }`, so the
network, rule identity, local block and readiness accompany the answer.

`incoming` exposes the recipient allocation contract with `coverage`,
`nextCursor` and a canonical `--after` position. `balance` reads one asset's
balance. `state-at` returns the stored block hash and state hash for one height,
or `null` when that row is absent. `serve` binds to `127.0.0.1:8787` by default
and serves the same query output over GET. See the
[query commands and HTTP paths](../../docs/run-indexer.md#4-synchronize-and-query)
for parameters, error codes and operator configuration.

## Release context

Mainnet reads the build-time copy of the repository's single
[release source](../../config/release.json). The build copies that file byte for
byte into `dist/release.json`. A null `genesisHeight` returns
`MAINNET_GENESIS_NOT_SELECTED`; it never chooses a test height. Rebuild after
the official release context changes. Mainnet cannot use `testContext`.

Signet and Regtest use an explicit `testContext` in the local configuration.
Network, height, name policy and authorization-rule identity are pinned to the
database. An incompatible context requires a separate index, not relabeling an
existing one.

## Local distribution

Build first, then create local archives from the repository root:

```sh
npm pack --workspace @aibrc/protocol
npm pack --workspace @aibrc/indexer
```

Install both archives in the consuming Node.js project. This workflow does not
publish either package to npm. The `aibrc-indexer` executable then exposes the
same commands. The source archive and full guide remain in this repository.

The runtime, engine, storage, query and ingestion modules reuse the existing
reference implementation. [Reuse manifest](reuse-manifest.json) records source
hashes and packaging adaptations. Code is MIT; documentation is CC0.
