import type { RecipientTransferQuery } from './query/contracts.js';
import { MAX_PERSISTENT_QUERY_HEIGHTS, MAX_PERSISTENT_QUERY_ITEMS, PersistentQueryInputError } from './query/query-service.js';
import { openLocalQuery } from './runtime.js';

const arity = {
  status: 0,
  'get-tip': 0,
  'get-name': 1,
  'get-asset': 1,
  balances: 1,
  'get-transfer': 1,
  'verify-state': 0,
  incoming: 4,
  balance: 2,
  'state-at': 1,
} as const;
type Command = keyof typeof arity;
type LocalView = Awaited<ReturnType<typeof openLocalQuery>>;
type ReadQuery = (local: LocalView) => unknown;

export function isLocalQuery(command: string): command is Command {
  return Object.hasOwn(arity, command);
}

export function jsonLine(value: unknown): string {
  return JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item) + '\n';
}

function invalid(code: string): never {
  throw new PersistentQueryInputError(code);
}

function hash(value: string, code = 'INVALID_QUERY_ID'): string {
  if (!/^[0-9a-fA-F]{64}$/.test(value)) invalid(code);
  return value.toLowerCase();
}

function integer(value: string, code: string): number {
  const number = Number(value);
  if (!/^[0-9]+$/.test(value) || !Number.isSafeInteger(number)) invalid(code);
  return number;
}

function incomingQuery(args: readonly string[], optional: readonly string[]): RecipientTransferQuery {
  const assetId = hash(args[0]!);
  const recipientAccount = hash(args[1]!);
  const fromHeight = integer(args[2]!, 'INVALID_QUERY_RANGE');
  const toHeight = integer(args[3]!, 'INVALID_QUERY_RANGE');
  if (toHeight < fromHeight || toHeight - fromHeight >= MAX_PERSISTENT_QUERY_HEIGHTS) invalid('INVALID_QUERY_RANGE');

  const options = new Map<string, string>();
  for (let index = 0; index < optional.length; index += 2) {
    const name = optional[index]!;
    const value = optional[index + 1];
    if (!['--limit', '--cursor', '--after'].includes(name) || !value || value.startsWith('--') || options.has(name)) invalid('INVALID_ARGUMENTS');
    options.set(name, value);
  }
  const rawLimit = options.get('--limit');
  const limit = rawLimit === undefined ? undefined : integer(rawLimit, 'INVALID_QUERY_LIMIT');
  if (limit !== undefined && (limit < 1 || limit > MAX_PERSISTENT_QUERY_ITEMS)) invalid('INVALID_QUERY_LIMIT');
  const cursor = options.get('--cursor');
  const rawAfter = options.get('--after');
  let after: RecipientTransferQuery['after'];
  if (rawAfter !== undefined) {
    const parts = rawAfter.split(':');
    if (parts.length !== 4) invalid('INVALID_QUERY_POSITION');
    after = {
      blockHeight: integer(parts[0]!, 'INVALID_QUERY_POSITION'),
      blockHash: hash(parts[1]!, 'INVALID_QUERY_POSITION'),
      txIndex: integer(parts[2]!, 'INVALID_QUERY_POSITION'),
      allocationIndex: integer(parts[3]!, 'INVALID_QUERY_POSITION'),
    };
  }
  return { assetId, recipientAccount, fromHeight, toHeight,
    ...(limit === undefined ? {} : { limit }), ...(cursor === undefined ? {} : { cursor }), ...(after === undefined ? {} : { after }) };
}

function withContext(read: ReadQuery): ReadQuery {
  return local => {
    const result = read(local);
    return { context: local.status(), result };
  };
}

export function parseLocalQuery(command: Command, args: readonly string[]): ReadQuery {
  const count = arity[command];
  const positional = args.slice(0, count);
  if (positional.length !== count || positional.some(arg => arg.startsWith('--'))
    || (command !== 'incoming' && args.length !== count)) invalid('INVALID_ARGUMENTS');

  switch (command) {
    case 'status': return local => local.status();
    case 'verify-state': return local => ({ ...local.status(), canonicalStateVerified: true });
    case 'get-tip': return withContext(local => local.query.getStatus().canonicalTip);
    case 'get-name': return withContext(local => local.query.getAssetByName(positional[0]!));
    case 'get-asset': {
      const assetId = hash(positional[0]!);
      return withContext(local => local.query.getAssetById(assetId));
    }
    case 'balances': {
      const accountKey = hash(positional[0]!);
      return withContext(local => local.query.listBalancesByAccount(accountKey));
    }
    case 'get-transfer': {
      const txid = hash(positional[0]!);
      return withContext(local => local.query.getTransferByTxid(txid));
    }
    case 'incoming': {
      const query = incomingQuery(positional, args.slice(count));
      return withContext(local => local.query.listRecipientTransfers(query));
    }
    case 'balance': {
      const assetId = hash(positional[0]!);
      const accountKey = hash(positional[1]!);
      return withContext(local => local.query.getBalance(assetId, accountKey));
    }
    case 'state-at': {
      const height = integer(positional[0]!, 'INVALID_QUERY_HEIGHT');
      return withContext(local => local.stateAt(height));
    }
  }
}

export async function runLocalQuery(configFile: string, read: ReadQuery): Promise<unknown> {
  const local = await openLocalQuery(configFile);
  try { return read(local); }
  finally { local.close(); }
}
