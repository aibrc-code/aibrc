import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { isIP } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INPUT_AUTHORIZATION_RULE_ID, NetworkId, type NamePolicySchedule } from '@aibrc/protocol';
import type { IndexerBitcoinNetwork } from './rpc/types.js';

const NETWORKS = { mainnet: NetworkId.MAINNET, signet: NetworkId.SIGNET, regtest: NetworkId.REGTEST };
export const DEFAULT_HTTP_LISTEN = { host: '127.0.0.1', port: 8787 } as const;
export interface ReferenceConfig {
  network: IndexerBitcoinNetwork;
  databasePath: string;
  rpc: { url: string; cookieFile?: string; timeoutMs: number };
  pollIntervalMs: number;
  rollbackRetentionDepth: number;
  http?: { host: string; port: number };
}
export interface RuntimeContext {
  config: ReferenceConfig;
  expectedNetwork: NetworkId;
  genesisHeight: number;
  namePolicy: NamePolicySchedule;
  identity: string;
  configPath: string;
  releasePath: string | null;
  fingerprint: string;
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_CONFIG');
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('UNKNOWN_CONFIG_FIELD');
}
function integer(value: unknown, min: number, max = 0xffff_ffff): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error('INVALID_CONFIG_INTEGER');
  return value;
}
function path(value: unknown, base: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) throw new Error('INVALID_CONFIG_PATH');
  return resolve(base, value);
}
const digest = (bytes: string) => createHash('sha256').update(bytes).digest('hex');

export function loadContext(configFile: string): RuntimeContext {
  const configPath = realpathSync(configFile), base = dirname(configPath);
  const bytes = readFileSync(configPath, 'utf8'), input = record(JSON.parse(bytes));
  fields(input, ['network', 'databasePath', 'rpc', 'pollIntervalMs', 'rollbackRetentionDepth', 'testContext', 'http']);
  if (input.network !== 'mainnet' && input.network !== 'signet' && input.network !== 'regtest') throw new Error('INVALID_NETWORK');
  const network = input.network;
  const rpc = record(input.rpc);
  fields(rpc, ['url', 'cookieFile', 'timeoutMs']);
  if (typeof rpc.url !== 'string') throw new Error('INVALID_RPC_URL');
  const endpoint = new URL(rpc.url);
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('INVALID_RPC_URL');
  // Credentials never travel over a remote clear-text connection.
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname);
  if (endpoint.protocol === 'http:' && !loopback) throw new Error('REMOTE_RPC_REQUIRES_HTTPS');
  const config: ReferenceConfig = {
    network, databasePath: path(input.databasePath, base),
    rpc: { url: endpoint.href, timeoutMs: integer(rpc.timeoutMs ?? 15_000, 100, 300_000),
      ...(rpc.cookieFile === undefined ? {} : { cookieFile: path(rpc.cookieFile, base) }) },
    pollIntervalMs: integer(input.pollIntervalMs ?? 3000, 100, 3_600_000),
    rollbackRetentionDepth: integer(input.rollbackRetentionDepth ?? 144, 1, 100_000),
  };
  if (input.http !== undefined) {
    const http = record(input.http);
    fields(http, ['host', 'port']);
    const host = http.host ?? DEFAULT_HTTP_LISTEN.host;
    if (typeof host !== 'string' || !isIP(host)) throw new Error('INVALID_HTTP_HOST');
    config.http = { host, port: integer(http.port ?? DEFAULT_HTTP_LISTEN.port, 0, 65_535) };
  }
  let releasePath: string | null = null, releaseBytes = '';
  let genesisHeight: number, namePolicyVersion: number;
  if (network === 'mainnet') {
    if (input.testContext !== undefined) throw new Error('MAINNET_CONTEXT_OVERRIDE_REJECTED');
    releasePath = fileURLToPath(new URL('./release.json', import.meta.url));
    releaseBytes = readFileSync(releasePath, 'utf8');
    const release = record(JSON.parse(releaseBytes));
    fields(release, ['protocolVersion', 'bitcoinNetwork', 'genesisHeight', 'namePolicyVersion', 'inputAuthorizationRuleId']);
    if (release.protocolVersion !== '0.25' || release.bitcoinNetwork !== network || release.inputAuthorizationRuleId !== INPUT_AUTHORIZATION_RULE_ID || release.namePolicyVersion !== 2) throw new Error('RELEASE_CONTEXT_MISMATCH');
    if (release.genesisHeight === null) throw new Error('MAINNET_GENESIS_NOT_SELECTED');
    genesisHeight = integer(release.genesisHeight, 0);
    namePolicyVersion = 2;
  } else {
    const test = record(input.testContext);
    fields(test, ['genesisHeight', 'namePolicyVersion']);
    genesisHeight = integer(test.genesisHeight, 0);
    namePolicyVersion = integer(test.namePolicyVersion, 1, 2);
  }
  const namePolicy: NamePolicySchedule = {
    manifestNamePolicyVersion: namePolicyVersion as 1 | 2,
    activationHeight: namePolicyVersion === 2 ? genesisHeight : null,
  };
  const identity = JSON.stringify({ protocolVersion: '0.25', network, genesisHeight,
    namePolicyVersion, inputAuthorizationRuleId: INPUT_AUTHORIZATION_RULE_ID });
  return { config, configPath, releasePath, genesisHeight, namePolicy, identity,
    expectedNetwork: NETWORKS[network], fingerprint: digest(bytes + '\n' + releaseBytes) };
}

export function assertContextUnchanged(context: RuntimeContext): void {
  const current = digest(readFileSync(context.configPath, 'utf8') + '\n' + (context.releasePath ? readFileSync(context.releasePath, 'utf8') : ''));
  if (current !== context.fingerprint) throw new Error('CONFIG_CHANGED_RESTART_REQUIRED');
}
