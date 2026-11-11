import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { DEFAULT_HTTP_LISTEN, loadContext } from './config.js';
import { isLocalQuery, jsonLine, parseLocalQuery, runLocalQuery } from './local-queries.js';
import { PersistentQueryInputError } from './query/query-service.js';
import { safeErrorCode } from './runtime.js';

function json(response: ServerResponse, status: number, value: unknown): void {
  const body = jsonLine(value);
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(body);
}

async function respond(configFile: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    json(response, 405, { error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const [command, ...segments] = url.pathname.slice(1).split('/');
    if (!command || !isLocalQuery(command)) {
      json(response, 404, { error: 'UNKNOWN_QUERY_PATH' });
      return;
    }
    const args = segments.map(decodeURIComponent);
    for (const [name, value] of url.searchParams) args.push(`--${name}`, value);
    const read = parseLocalQuery(command, args);
    json(response, 200, await runLocalQuery(configFile, read));
  } catch (error) {
    if (error instanceof URIError || (error instanceof TypeError && 'code' in error && error.code === 'ERR_INVALID_URL')) {
      json(response, 400, { error: 'INVALID_ARGUMENTS' });
      return;
    }
    const code = safeErrorCode(error);
    const status = error instanceof PersistentQueryInputError ? 400 : code === 'QUERY_READY_SNAPSHOT_REQUIRED' ? 503 : 500;
    json(response, status, { error: code });
  }
}

export async function startLocalQueryServer(configFile: string) {
  const { config } = loadContext(configFile);
  const listen = config.http ?? DEFAULT_HTTP_LISTEN;
  const server = createServer((request, response) => { void respond(configFile, request, response); });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(listen.port, listen.host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  return server;
}
