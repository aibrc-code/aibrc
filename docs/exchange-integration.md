# Integrate AIBRC deposits

Run the AIBRC reference indexer with your Bitcoin Core node. Your deposit
service reads applied AIBRC transfer allocations from the local index and
posts credits to your own ledger. The index also provides balances and state
fingerprints for reconciliation.

### What an exchange reads

| Operation | AIBRC | ERC-20 | Runes |
| --- | --- | --- | --- |
| **Find the deposit** | Read the transfer allocation to the Bitcoin address's script account | Read the token contract's Transfer event for the deposit address | Read the rune allocation to the deposit output |
| **Reconcile balances** | Read the indexed account balance at a known block and state hash | Query the token contract's `balanceOf` at a known block | Track rune balances across the relevant Bitcoin outputs |
| **Send assets out** | Authorize a Transfer instruction | Call the token contract's transfer function | Spend rune-bearing outputs and allocate the runes to recipients |

[ERC-20 token standard](https://eips.ethereum.org/EIPS/eip-20) · [Runes specification](https://docs.ordinals.com/runes/specification.html)

## Start your own indexer

Use Node.js 22.16 or newer. Set `RELEASE_COMMIT` to the source commit you want
to run. For Mainnet, use the commit published with the official starting height.

```sh
git clone https://github.com/aibrc-code/aibrc.git
cd aibrc
git checkout --detach "$RELEASE_COMMIT"
npm ci --ignore-scripts
npm run build
npm run indexer:demo
```

The demo runs against synthetic local blocks. It covers a transfer, a restart
and a two-block reorganization. You can use it to exercise the indexer before
the Mainnet starting height is selected.

For Mainnet, connect a fully validating Bitcoin Core node with the required
blocks and previous transaction outputs available. The reader uses raw blocks
and `getblock` with verbosity 3, and can fall back to `getrawtransaction` for
previous outputs. Keep the required undo data or a synchronized `txindex` for
the fallback. [Node requirements](run-indexer.md#2-connect-to-a-bitcoin-node-you-control) · [Bitcoin Core `getblock`](https://bitcoincore.org/en/doc/29.0.0/rpc/blockchain/getblock/)

Copy [the example configuration](../packages/indexer/indexer.example.json) to
`indexer.json`. Set the RPC endpoint and local cookie path for your node, then
choose a dedicated local SQLite path. Use the published Mainnet context from
[`config/release.json`](../config/release.json). When `genesisHeight` is `null`,
Mainnet startup returns `MAINNET_GENESIS_NOT_SELECTED`. For a Signet or
Regtest integration, use a separate database and the corresponding test
context. [Network setup](run-indexer.md#3-set-the-network-and-rule-context)

Run the initial sync. Once it reaches `READY`, keep `follow` running to update
the same database. Start `serve` in a second terminal for local HTTP queries.

```sh
node packages/indexer/dist/cli.js sync-once --config ./indexer.json
node packages/indexer/dist/cli.js follow --config ./indexer.json
```

```sh
node packages/indexer/dist/cli.js serve --config ./indexer.json
```

The default HTTP address is `127.0.0.1:8787`. The service returns the same
JSON as the corresponding CLI query. Use `/status` to inspect the committed
local checkpoint, and compare it with your node's active chain when assessing
freshness. [HTTP routes and error codes](run-indexer.md#read-the-same-queries-over-local-http)

## Read deposits

1. Register the asset your service accepts using its `assetId` and canonical
   deployment identity. `get-asset ASSET_ID` returns `deployTxidDisplayBytes`
   and `locator` in `result`. Keep the mapping from each supported deposit
   address to its customer account in your service.
2. Convert the Bitcoin deposit address to its exact output script, then derive
   the AIBRC account key. Use that key and the accepted asset ID for `incoming`.
3. Start at the published `genesisHeight` for a full backfill. Each request
   covers up to 1,000 heights, including both endpoints, and returns up to 100
   allocations per page. Read all pages within the verified index tip. Once
   the range is complete, save its end height and the block hash at that height
   from `coverage`, even for an empty range. After verifying that checkpoint,
   begin the next range at the following height.

Set `SCRIPT_PUBKEY_HEX` to the deposit address's output script, and set
`ASSET_ID`, `FROM_HEIGHT` and `TO_HEIGHT` for the query.

```sh
ACCOUNT_KEY=$(node --input-type=module -e \
  'import { deriveAccountKey } from "@aibrc/protocol"; console.log(deriveAccountKey(process.argv[1]));' \
  "$SCRIPT_PUBKEY_HEX")

node packages/indexer/dist/cli.js incoming --config ./indexer.json \
  "$ASSET_ID" "$ACCOUNT_KEY" "$FROM_HEIGHT" "$TO_HEIGHT" --limit 100

curl -fsS "http://127.0.0.1:8787/incoming/$ASSET_ID/$ACCOUNT_KEY/$FROM_HEIGHT/$TO_HEIGHT?limit=100"
```

| Response field | Use |
| --- | --- |
| `context` and `result.snapshot` | Check the network, rules identity, readiness, block tip and state hash used for this read. |
| `result.scope` | Check the asset, recipient and requested heights before storing results. |
| `result.coverage` | Check every height in the range. Keep a range pending if any height is `UNKNOWN`. |
| `result.items` | Each item is an applied allocation. Keep its transaction ID, allocation index, recipient, asset, amount and block position. Parse `amount` as an integer string in raw protocol units. AIBRC uses eight display decimals. |
| `result.nextCursor` | Continue with the same scope and snapshot until the value is `null`. |

Preserve `identityEvidence` and `inputEvidence` on each receipt. Your service
uses these fields for its own evidence checks. `coverage` reports whether the
block projection is available.

Pass `nextCursor` as `--cursor` on the CLI or as the `cursor` query parameter
on HTTP. If the checkpoint changes and the indexer returns
`INVALID_QUERY_CURSOR`, restart the incomplete range using your saved progress.
You can resume after an actual receipt using
`--after HEIGHT:BLOCK_HASH:TX_INDEX:ALLOCATION_INDEX`, or the HTTP `after`
parameter. Include that receipt's height in the new range. The indexer checks
that the block still matches before continuing.

## Post each deposit once

Use a unique receipt key of `(network, txidDisplayBytes, allocationIndex)`
within your deposit ledger. Several allocations can share a transaction ID.
The allocation index identifies each one. Store `assetId`, `recipientAccount`,
`amount`, `blockHeight`, `blockHash` and `txIndex` with the receipt. The block
position can change when the same transaction is included again.

1. Save receipts durably as you scan. Advance the completed range checkpoint
   after all its pages and receipt observations have been saved.
2. Before crediting, check that the allocation matches your accepted asset
   and recipient, the indexed range has complete coverage, and the receipt's
   block is still on your node's active chain. Apply your exchange's
   confirmation policy. Once the block hash matches, the confirmation count
   uses the node's current tip height minus the receipt height plus one.
3. Update the receipt's credit state and post the ledger credit in one
   transaction. For a separate ledger service, save the pending credit and
   its idempotency key before calling the ledger. Reuse that key on retries
   and record the ledger's confirmed outcome against the receipt.

Use `balance` for reconciliation with the local indexed balance. Use
`state-at HEIGHT` to compare two indexers at a common height. Compare their
network and rules identity, then the block hash, then the state hash. A
`null` result means this index has no stored fingerprint at that height.

## Handle a chain reorganization

At the start of each scan, compare the saved completed height and block hash
with the active chain. Read `/state-at/HEIGHT` to compare the indexer's stored
block hash before using its view to resume or credit receipts.

1. If a saved block has changed or disappeared, pause credits from the
   affected range and find the last matching block in your saved history.
   Use an earlier verified checkpoint when the saved history is sparse. If
   no checkpoint can be verified, start the scan at the official height.
2. Let `follow` apply the replacement branch, then rescan from the block after
   the last match. Restart pagination for the replacement snapshot. A stale
   `after` position returns `STALE_QUERY_POSITION`.
3. Reconcile the old observations and credits against the replacement
   receipts. If a receipt reappears with the same identity and details, update
   its placement and keep any effective credit. If an allocation disappears,
   move it through your reorganization policy, including any compensating
   ledger entry. If the same receipt key now resolves to a different asset,
   recipient or amount, hold it for reconciliation. When a reversed receipt
   becomes eligible again, record one restoration with its own idempotent
   ledger entry. Keep the receipt and its ledger history for retries.

If the indexer halts because the fork is outside its retained undo history,
preserve its files and replay from the official starting height into a fresh
database. Resume affected credits after the new view and the deposit ledger
have been reconciled. [Indexer recovery](run-indexer.md#6-recovery-without-inventing-transactions)

## Publish the Mainnet starting height

1. Put the approved integer in `genesisHeight` in
   [`config/release.json`](../config/release.json). This is the source for both
   the replay start and Name Policy V2 activation. The build copies it to
   `packages/indexer/dist/release.json`, and the documentation site renders
   the release table from the same source.
2. Build and run the existing checks against the release candidate. The
   Mainnet CLI tests exercise unselected and selected heights in separate
   fixtures. The installed package check runs those tests and compares the
   packaged manifest with the published release source byte for byte.

```sh
npm ci --ignore-scripts
npm run build
npm test
npm run vectors:check
npm run docs:check
npm run package:check
npm run indexer:package:check
```

Publish the release source commit and send integrators the following information
from that commit's `config/release.json`.

| Send | Value |
| --- | --- |
| Network and starting height | Bitcoin Mainnet and the approved `genesisHeight` |
| Rules identity | `protocolVersion`, `namePolicyVersion` and `inputAuthorizationRuleId` |
| Source | Full Git commit SHA and a commit-pinned link to `config/release.json` |
| Instructions | A commit-pinned link to this guide |
| Archives, when distributing a built package | Both the protocol and indexer tarballs built from that commit, plus their SHA-256 sums |

Create local tarballs with `npm pack --workspace @aibrc/protocol` and
`npm pack --workspace @aibrc/indexer`. Integrators can install both together
in their Node.js project. Once the selected release is available, they build
or install that release, sync a Mainnet database and exercise their deposit
and reorganization handling before enabling credits.
