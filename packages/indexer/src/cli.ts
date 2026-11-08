#!/usr/bin/env node
import { setTimeout as delay } from 'node:timers/promises';
import { loadContext } from './config.js';
import { openSession, openLocalQuery, safeErrorCode } from './runtime.js';
import { classifySyncError } from './sync-errors.js';

const usage = `aibrc-indexer <command> --config <file> [arguments]
  sync-once                Synchronize to the observed Bitcoin tip
  follow                   Follow the chain until SIGINT or SIGTERM
  status                   Read the local checkpoint (not live health)
  get-tip                  Read the local canonical tip
  get-name <name>           Find an asset by its exact protocol name
  get-asset <asset-id>      Find an asset by its 64-character ID
  balances <account-key>   List positive balances for a script-derived account
  get-transfer <txid>       Read an applied transfer by exact transaction ID
  verify-state             Verify stored canonical state and hash
All Bitcoin RPC calls are read-only. No wallet, signing or broadcast command.`;
const write = (value: unknown) => process.stdout.write(JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item) + '\n');
const hash = (value: string | undefined): string => {
  if (!value || !/^[0-9a-fA-F]{64}$/.test(value)) throw new Error('INVALID_QUERY_ID');
  return value.toLowerCase();
};

async function main(args: string[]): Promise<void> {
  if (args.length === 0 || args[0] === '--help') { process.stdout.write(usage + '\n'); return; }
  const command = args.shift()!;
  const at = args.indexOf('--config');
  if (at < 0 || !args[at + 1]) throw new Error('CONFIG_REQUIRED');
  const configFile = args.splice(at, 2)[1]!;
  const commands = new Set(['sync-once', 'follow', 'status', 'get-tip', 'get-name', 'get-asset', 'balances', 'get-transfer', 'verify-state']);
  if (!commands.has(command)) throw new Error('UNKNOWN_COMMAND');
  const needsArg = ['get-name', 'get-asset', 'balances', 'get-transfer'].includes(command);
  if (args.length !== (needsArg ? 1 : 0) || args.some(arg => arg.startsWith('--'))) throw new Error('INVALID_ARGUMENTS');
  if (needsArg && command !== 'get-name') hash(args[0]);
  if (command === 'sync-once' || command === 'follow') {
    const { config } = loadContext(configFile);
    let stopped = false;
    const stop = () => { stopped = true; };
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
    let session;
    try {
      session = await openSession(configFile);
      do {
        try {
          const result = await session.sync();
          write(result);
          const status = (result as { status: string }).status;
          if (status !== 'READY') throw new Error('INDEXER_REQUIRES_ATTENTION');
        } catch (error) {
          if (command !== 'follow' || classifySyncError(error) !== 'TRANSIENT_SYNC_ERROR') throw error;
          process.stderr.write(JSON.stringify({ error: safeErrorCode(error), retrying: true }) + '\n');
        }
        if (command === 'sync-once' || stopped) break;
        await delay(config.pollIntervalMs);
      } while (!stopped);
    } finally { session?.close(); process.off('SIGINT', stop); process.off('SIGTERM', stop); }
    return;
  }
  const local = await openLocalQuery(configFile);
  try {
    const q = local.query;
    const queryResult = (result: unknown) => write({ context: local.status(), result });
    if (command === 'status') write(local.status());
    else if (command === 'get-tip') queryResult(q.getStatus().canonicalTip);
    else if (command === 'get-name') queryResult(q.getAssetByName(args[0]!));
    else if (command === 'get-asset') queryResult(q.getAssetById(hash(args[0])));
    else if (command === 'balances') queryResult(q.listBalancesByAccount(hash(args[0])));
    else if (command === 'get-transfer') queryResult(q.getTransferByTxid(hash(args[0])));
    else write({ ...local.status(), canonicalStateVerified: true });
  } finally { local.close(); }
}

main(process.argv.slice(2)).catch(error => { process.stderr.write(JSON.stringify({ error: safeErrorCode(error) }) + '\n'); process.exitCode = 1; });
