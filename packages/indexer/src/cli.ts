#!/usr/bin/env node
import { setTimeout as delay } from 'node:timers/promises';
import { loadContext } from './config.js';
import { openSession, safeErrorCode } from './runtime.js';
import { classifySyncError } from './sync-errors.js';
import { isLocalQuery, jsonLine, parseLocalQuery, runLocalQuery } from './local-queries.js';
import { startLocalQueryServer } from './http.js';

const usage = `aibrc-indexer <command> --config <file> [arguments]
  sync-once                Synchronize to the observed Bitcoin tip
  follow                   Follow the chain until SIGINT or SIGTERM
  status                   Read the local checkpoint (not live health)
  get-tip                  Read the local canonical tip
  get-name <name>           Find an asset by its exact protocol name
  get-asset <asset-id>      Find an asset by its 64-character ID
  balances <account-key>   List positive balances for a script-derived account
  get-transfer <txid>       Read an applied transfer by exact transaction ID
  incoming <asset-id> <account-key> <from-height> <to-height>
    [--limit <n>] [--cursor <cursor>] [--after <height>:<block-hash>:<tx-index>:<allocation-index>]
                            List applied allocations for a recipient
  balance <asset-id> <account-key>
                            Read a single asset balance
  state-at <height>         Read the stored state hash at a height
  verify-state             Verify stored canonical state and hash
  serve                    Serve local read-only GET queries
All Bitcoin RPC calls are read-only. No wallet, signing or broadcast command.`;
const write = (value: unknown) => process.stdout.write(jsonLine(value));

async function main(args: string[]): Promise<void> {
  if (args.length === 0 || args[0] === '--help') { process.stdout.write(usage + '\n'); return; }
  const command = args.shift()!;
  const at = args.indexOf('--config');
  if (at < 0 || !args[at + 1]) throw new Error('CONFIG_REQUIRED');
  const configFile = args.splice(at, 2)[1]!;
  if (isLocalQuery(command)) {
    write(await runLocalQuery(configFile, parseLocalQuery(command, args)));
    return;
  }
  if (command !== 'sync-once' && command !== 'follow' && command !== 'serve') throw new Error('UNKNOWN_COMMAND');
  if (args.length !== 0) throw new Error('INVALID_ARGUMENTS');
  if (command === 'serve') {
    const server = await startLocalQueryServer(configFile);
    const stop = () => { server.close(); };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    server.once('close', () => { process.off('SIGINT', stop); process.off('SIGTERM', stop); });
    const address = server.address();
    if (address && typeof address !== 'string') write({ address: address.address, port: address.port });
    return;
  }
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
}

main(process.argv.slice(2)).catch(error => { process.stderr.write(JSON.stringify({ error: safeErrorCode(error) }) + '\n'); process.exitCode = 1; });
