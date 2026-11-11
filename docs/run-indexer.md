# Run your own AIBRC indexer

**Your node. Your ledger. The same public rules.** An independent indexer lets a
person, wallet or Agent reconstruct AIBRC assets and balances from Bitcoin
history instead of depending on one application's answer.

This guide uses the runnable [reference package](../packages/indexer/README.md)
in this repository. For the rules behind each step, read the
[indexer implementation guide](06-indexer-guide.md).

For scanning deposits, posting credits and handling reorganizations, use the
[exchange integration guide](exchange-integration.md).

For an Agent, this is a local source of asset IDs, balances and transfer history. It can build a payment
plan from a known ledger view, check a completed distribution or compare its result with another provider.
The returned block and rule context travel with the answer, giving the application the information it
needs to decide whether the view is fresh enough for the task.

## 1. Try the isolated walkthrough

Use Node.js 22.16 or newer. In your local copy of this repository:

```sh
npm ci --ignore-scripts
npm run build
npm run indexer:demo
npm run test:indexer
```

The demo runs against a temporary loopback RPC fixture and a real temporary
SQLite database. It produces three JSON lines:

| Step | What you should see |
| --- | --- |
| `sync` | `READY`, canonical height 3 and a 64-character state hash |
| `read-after-restart` | Asset `DEMO`, supply `1000`; Alice `700`, Bob `100`, Carol `200` |
| `two-block-reorg` | Alice `700`, Bob `250`, Carol `50`; the removed transfer is `null` |

These are raw protocol units in a synthetic Regtest-shaped example, not real
coins. No Bitcoin process, real signatures, transaction broadcast or external
API is used. The test suite also exercises restart after process death,
writer exclusion, read consistency, shorter chains, unavailable RPC and
fail-closed block mismatches. It does not test Bitcoin consensus or throughput.

## 2. Connect to a Bitcoin node you control

For actual chain verification, use a fully validating Bitcoin Core node with
the relevant block history available. The reader uses `getblock` verbosity 0
and 3; provide undo/prevout data or a synchronized `txindex` for the fallback
`getrawtransaction` reads. A pruned node missing required blocks or prevouts
cannot reconstruct that history. The indexer checks the node's chain identity
and the raw block/transaction identities before applying protocol rules.

Keep RPC private. Use local cookie authentication or a local tunnel to your
node. Do not publish RPC, upload its cookie, give an Agent a wallet private key,
or commit credentials to GitHub. A remote RPC operator remains a trust
dependency; the package does not independently validate Bitcoin proof of work.

The transport permits only chain-reading RPC methods. There is no wallet,
signing or broadcast command. It writes only the local index and a small
SQLite writer-lease file next to it.

## 3. Set the network and rule context

### Mainnet

Copy [indexer.example.json](../packages/indexer/indexer.example.json) to
`indexer.json` at the repository root. Set `rpc.cookieFile` to your node's
existing cookie location; all relative paths are resolved from the config
file's directory. Keep local configuration and database files out of Git.

```json
{
  "network": "mainnet",
  "databasePath": "./data/aibrc.sqlite",
  "rpc": {
    "url": "http://127.0.0.1:8332",
    "cookieFile": "./bitcoin.cookie"
  },
  "pollIntervalMs": 3000,
  "rollbackRetentionDepth": 144
}
```

The official Mainnet context comes from
[config/release.json](../config/release.json), copied into the package by the
build. **When its height is null, Mainnet indexing stops with
`MAINNET_GENESIS_NOT_SELECTED`.** Do not replace it with a demo height. Once the
official value is published, update your checkout and rebuild. The name policy
and authorization rule are pinned alongside the network and starting height.
An already running process must restart to adopt a changed configuration.

### Signet or Regtest

For your own test chain, use an explicit local test context. This example
starts at height 1 on Regtest with Name Policy V1:

```json
{
  "network": "regtest",
  "databasePath": "./data/regtest.sqlite",
  "rpc": {
    "url": "http://127.0.0.1:18443",
    "cookieFile": "./regtest.cookie"
  },
  "testContext": { "genesisHeight": 1, "namePolicyVersion": 1 },
  "rollbackRetentionDepth": 144
}
```

For Signet, select `signet`, its RPC URL and cookie, and your test deployment's
actual starting height and name policy. This does not activate Mainnet.
Mainnet rejects `testContext`. A database cannot be reopened under a different
network, starting height, name-policy identity or rollback-retention setting.

## 4. Synchronize and query

From the repository root:

```sh
node packages/indexer/dist/cli.js sync-once --config ./indexer.json
node packages/indexer/dist/cli.js follow --config ./indexer.json
```

`sync-once` catches up to the observed chain tip and exits. `follow` keeps one
session open, checks for new blocks every 3 seconds by default, and resumes
after retryable RPC outages. It does not reapply an unchanged committed tip.
Use Ctrl+C to stop between iterations. A second writer for the same local
database is rejected; process death releases its operating-system lock.

In another terminal, read the committed local view:

```sh
node packages/indexer/dist/cli.js status --config ./indexer.json
node packages/indexer/dist/cli.js get-tip --config ./indexer.json
node packages/indexer/dist/cli.js get-name --config ./indexer.json DEMO
node packages/indexer/dist/cli.js verify-state --config ./indexer.json
```

`status` includes network, rule identity, processed tip and canonical state hash.
`liveChainChecked: false` identifies an offline checkpoint query. A locally
stored `READY` does not prove that a currently stopped indexer is up to date.
`verify-state` rechecks stored canonical state and its hash; it does not
revalidate all Bitcoin history or authenticate someone else's snapshot.

Use the returned `assetId`, account key or transaction ID for exact reads:

```sh
node packages/indexer/dist/cli.js get-asset --config ./indexer.json ASSET_ID
node packages/indexer/dist/cli.js balances --config ./indexer.json ACCOUNT_KEY
node packages/indexer/dist/cli.js get-transfer --config ./indexer.json TXID
```

The uppercase identifiers are placeholders, each replaced by 64 hexadecimal
characters. Query output pairs `context` (network, rules, status and local tip)
with `result`. An unknown asset or transfer has `result: null`; an account
without positive balances has `result: []`. Always inspect the context: results
from a stopped or non-ready index are checkpoint facts, not current-state claims.
Failed reads exit nonzero and do not pretend to be zero.
Amounts are decimal strings in raw units, with 8 protocol display decimals.
`get-transfer` returns applied transfers only: `null` means this local view has
no applied record, not that Bitcoin rejected, canceled or never saw the txid.

### Scan a recipient and compare checkpoints

```sh
node packages/indexer/dist/cli.js incoming --config ./indexer.json ASSET_ID ACCOUNT_KEY FROM_HEIGHT TO_HEIGHT --limit 50
node packages/indexer/dist/cli.js balance --config ./indexer.json ASSET_ID ACCOUNT_KEY
node packages/indexer/dist/cli.js state-at --config ./indexer.json HEIGHT
```

`incoming` returns the existing `snapshot`, `scope`, `coverage`, `items` and
`nextCursor` fields. The interval includes both endpoints, spans up to 1,000
heights and ends at or below the verified tip. The default page size is 50 and
the maximum is 100. Items are applied allocations in block, transaction and
allocation order. Confirmation requirements belong to the caller.

Continue a page with `--cursor NEXT_CURSOR` and the same query scope while its
snapshot remains current. Save a durable position as
`HEIGHT:BLOCK_HASH:TX_INDEX:ALLOCATION_INDEX` from an item. To resume with
`--after POSITION`, include its height in the interval. The block at that
position must still match the verified projection. A replaced or unverified
position returns `STALE_QUERY_POSITION`. A cursor from a different snapshot or
scope returns `INVALID_QUERY_CURSOR`. Review the chain change and rescan from
the appropriate position before advancing a deposit checkpoint.

Coverage is per height. A canonical replay from the configured start retains
its query projection beyond the undo window. Pre-activation heights and gaps
in older query projections can report `UNKNOWN`. Keep the returned coverage
and allocation evidence fields when deciding what the index has established.

`balance` returns the indexed amount for one asset and account in raw units.
`state-at` returns `{ height, blockHash, stateHash }` from the stored canonical
checkpoint history. It returns `null` for a height without a stored row.
Compare the block hash at the same height before comparing state hashes.

### Read the same queries over local HTTP

```sh
node packages/indexer/dist/cli.js serve --config ./indexer.json
curl http://127.0.0.1:8787/status
curl "http://127.0.0.1:8787/incoming/ASSET_ID/ACCOUNT_KEY/FROM_HEIGHT/TO_HEIGHT?limit=50"
curl http://127.0.0.1:8787/state-at/HEIGHT
```

The optional `http` member in `indexer.json` accepts a literal IP address
`host` and a `port`. Defaults are `127.0.0.1` and `8787`. Port `0` selects an
available port. `serve` prints its bound `address` and `port` on startup.
This interface is intended for trusted local use. Operators who bind outside
loopback are responsible for access control.

| GET path | CLI query |
| --- | --- |
| `/status`, `/get-tip`, `/verify-state` | `status`, `get-tip`, `verify-state` |
| `/get-name/NAME`, `/get-asset/ASSET_ID` | `get-name`, `get-asset` |
| `/balances/ACCOUNT_KEY`, `/get-transfer/TXID` | `balances`, `get-transfer` |
| `/balance/ASSET_ID/ACCOUNT_KEY` | `balance` |
| `/incoming/ASSET_ID/ACCOUNT_KEY/FROM_HEIGHT/TO_HEIGHT` | `incoming` with optional `limit`, `cursor` and `after` query parameters |
| `/state-at/HEIGHT` | `state-at` |

Encode path arguments and query parameter values for URLs. For the same
checkpoint and arguments, the response body matches CLI stdout byte for byte,
including its trailing newline. Data queries use `{ context, result }`.
`status` and `verify-state` carry their context at the top level as in the CLI.
Each query reads a committed SQLite snapshot and releases it after the read.
Run `follow` in a separate process to advance the checkpoint.

Errors return `{ "error": "CODE" }`. A non-GET method returns 405 and
`METHOD_NOT_ALLOWED`. An unknown path returns 404 and `UNKNOWN_QUERY_PATH`.
Invalid parameters, cursors and positions return 400 with the corresponding
query code. With a non-ready checkpoint, `incoming` returns 503 and
`QUERY_READY_SNAPSHOT_REQUIRED`.

### Turn a supported output script into an account key

```js
import { deriveAccountKey } from '@aibrc/protocol';

// Replace with the actual scriptPubKey of the account you want to query.
const scriptPubKeyHex = '5120' + '11'.repeat(32);
console.log(deriveAccountKey(scriptPubKeyHex));
```

This offline example uses an illustrative P2TR script, not a supplied wallet
address. Decode an actual address to its exact output script using your Bitcoin
wallet/library. Supported account authorization is P2TR key-path or P2WPKH;
an arbitrary `bc1q` prefix alone does not identify a supported script.

## 5. Deploy and transfer are wallet actions

```text
SDK encodes Deploy or Transfer
  ↓
Your wallet builds, reviews and signs a Bitcoin tx
  ↓
Bitcoin accepts and confirms it
  ↓
Your indexer interprets the canonical transaction
  ↓
Read its asset, balances and applied transfer
```

Use the [runnable Deploy, single transfer and 1–25 allocation examples](quickstart.md)
to prepare instruction bytes. The indexer does not create private keys, own
assets or replace the wallet. Its RPC connection never signs or broadcasts.
A confirmed Bitcoin transaction may still contain a protocol NO_OP; use the
protocol rules and indexed result rather than assuming every OP_RETURN changed
an asset balance.

## 6. Recovery without inventing transactions

| Observation | What to do |
| --- | --- |
| RPC is unavailable | `follow` retries classified transport errors; the local checkpoint becomes `SYNCING` after an established session fails. Startup errors exit nonzero; correct the connection and restart. |
| Process restarts | Reopen the same database and context. Committed blocks and transfers are not applied twice. |
| One or more blocks are replaced | Within retained undo history, reverse old effects and replay the canonical branch. A lower stable chain tip follows the same recovery path. |
| A saved cursor or receipt position is rejected | Reopen the current local view. Reuse `after` only for a position whose block remains canonical. Rescan the affected range when its block changed. |
| `coverage` contains `UNKNOWN` or `state-at` returns `null` | Keep the history gap visible. Replay from the configured start into a fresh database when complete historical data is required. |
| Common ancestor is outside retained history | Stop. Preserve the old files and reconstruct a new local index from the official starting height using a different `databasePath`. |
| `HALTED`, `NEEDS_UPGRADE` or block identity mismatch | Stop current-state claims; inspect the error code and compatible release. Do not edit balances or reset the checkpoint to force `READY`. |
| Cookie rotates or configuration changes | Restart with the same valid rule context and updated local connection settings. Never paste the cookie into a support ticket. |

The default 144-block undo retention is a local storage/recovery setting, not a
claim of Bitcoin finality. History, state size and snapshot costs grow with
use; this reference package has no claimed production capacity or RAM bound.
It loads canonical state into memory and is not a Bitcoin SPV/light client.
`serve` provides local read-only HTTP queries alongside the CLI.

## 7. A checklist for people and AI operators

1. Build this repository with Node 22.16+; run the isolated demo and tests.
2. Read the official release context. Keep Mainnet disabled while its height is
   null. Do not infer a formal starting height from test vectors.
3. Use a Bitcoin Core node you control. Match network, retained history and
   prevout availability. Keep credentials local and out of chat and commits.
4. Choose a fresh local database path; start `sync-once`, then `follow`.
5. Compare network, rule identity, processed block hash and state hash before
   comparing balances with another indexer. Equal heights alone are insufficient.
6. Report errors as errors. A missing record, stopped process or stale checkpoint
   is not evidence of zero funds or of a transaction's failure.
7. Stop at indexing and read-only queries. Signing, sending funds and changing
   protocol rules are separate actions controlled by the wallet owner.

For deposit scanning, carry `coverage` and the canonical receipt position with
each result. `state-at` lets operators compare their stored fingerprints at a
shared height. `serve` exposes the same reads for local integrations.

The same checklist applies whether commands are typed by a person or executed
by an Agent. **Don't trust, verify** starts with reproducible inputs and an
honest statement of which chain and rules produced the answer.
