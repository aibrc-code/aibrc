import { request } from "node:http";
import { request as requestHttps } from "node:https";
import {
  MAINNET_ZERO_VALUE_CORE_RPC_METHODS,
  type IndexerRpcConnectionConfig,
  type IndexerSyncRpcMethod,
  type ReadonlyRpcMethod,
  type RpcTransport,
  type SignetRpcConnectionConfig,
} from "./types.js";

const ALLOWED_METHODS = new Set<ReadonlyRpcMethod>([
  "getblockchaininfo", "getblockcount", "getblockhash", "getblockheader", "getblock",
  "getrawtransaction", "gettxout", "getbestblockhash", "getindexinfo", "testmempoolaccept",
]);

const INDEXER_SYNC_METHODS = new Set<ReadonlyRpcMethod>([
  "getblockchaininfo", "getblockcount", "getblockhash", "getblockheader", "getblock",
  "getrawtransaction", "gettxout", "getbestblockhash", "getindexinfo",
]);

const MAINNET_ZERO_VALUE_METHODS = new Set<ReadonlyRpcMethod>(
  MAINNET_ZERO_VALUE_CORE_RPC_METHODS,
);

function assertSafeEndpoint(config: IndexerRpcConnectionConfig): URL {
  const endpoint = new URL(config.url);
  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") throw new Error("RPC_URL_MUST_BE_HTTP_OR_HTTPS");
  if (endpoint.username || endpoint.password) throw new Error("RPC_CREDENTIALS_IN_URL_REJECTED");
  if (config.cookie && (config.username !== undefined || config.password !== undefined)) throw new Error("RPC_AUTH_MODES_ARE_MUTUALLY_EXCLUSIVE");
  if (config.network === "mainnet") {
    const host = endpoint.hostname.toLowerCase();
    const privateHost = host === "localhost" || host === "127.0.0.1" || host === "::1"
      || /^10\./.test(host) || /^192\.168\./.test(host)
      || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host);
    if (!privateHost) throw new Error("MAINNET_INDEXER_RPC_PUBLIC_HOST_REJECTED");
  }
  return endpoint;
}


/**
 * A JSON-RPC response body larger than this is refused rather than buffered.
 * A mainnet `getblock` at verbosity 3 is the largest legitimate payload; this
 * bound is far above it and exists so a hostile or malfunctioning endpoint
 * cannot drive the indexer out of memory.
 */
const MAX_RPC_RESPONSE_BYTES = 256 * 1024 * 1024;

interface JsonRpcEnvelope {
  readonly result?: unknown;
  readonly error?: { readonly code: number; readonly message: string };
  readonly id?: unknown;
}

/**
 * Parses a JSON-RPC response body, returning undefined for anything that is not a
 * well-formed envelope. Every non-object top level — `null`, an array, a bare
 * number/string/boolean — is rejected here rather than being indexed into later.
 */
function parseJsonRpcEnvelope(raw: string): JsonRpcEnvelope | undefined {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return undefined; }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
  const candidate = parsed as { result?: unknown; error?: unknown; id?: unknown };
  if (candidate.error !== undefined && candidate.error !== null) {
    const error = candidate.error;
    if (typeof error !== "object" || error === null || Array.isArray(error)) return undefined;
    const { code, message } = error as { code?: unknown; message?: unknown };
    if (typeof code !== "number" || typeof message !== "string") return undefined;
    return { ...(("result" in candidate) ? { result: candidate.result } : {}), error: { code, message }, id: candidate.id };
  }
  return { result: candidate.result, id: candidate.id };
}

/** HTTP statuses produced by a gateway/proxy or a warming node, never by consensus. */
function isTransportStatus(status: number | undefined): boolean {
  return status === 502 || status === 503 || status === 504;
}

/**
 * Performs one read-only JSON-RPC call with a single-settle guarantee.
 *
 * Every path that can end an HTTP exchange settles the promise exactly once:
 * socket error, socket inactivity timeout, an aborted or errored response, a
 * premature close after headers, an over-large body, and a total deadline that
 * spans the whole response lifecycle. The previous implementation listened only
 * for `data`/`end`, so a half-delivered response followed by a destroyed socket
 * left the promise pending forever — the indexer stopped advancing silently
 * while its healthcheck kept reading the last READY snapshot off disk and
 * reported green.
 *
 * Status is classified BEFORE the body is parsed. A plain-text 503 from a relay
 * used to throw SyntaxError out of JSON.parse and be classified as a consensus
 * failure, which persists a sticky HALT.
 */
function performRpcCall<T>(
  endpoint: URL,
  prefix: "SIGNET" | "INDEXER",
  config: { readonly cookie?: string; readonly username?: string; readonly password?: string; readonly timeoutMs?: number; readonly maxResponseBytes?: number },
  id: number,
  method: ReadonlyRpcMethod,
  params: readonly unknown[],
): Promise<T> {
  const body = Buffer.from(JSON.stringify({ jsonrpc: "1.0", id, method, params }));
  const credentials = config.cookie ?? (config.username !== undefined ? `${config.username}:${config.password ?? ""}` : undefined);
  const socketTimeoutMs = config.timeoutMs ?? 15_000;
  const maxResponseBytes = config.maxResponseBytes ?? MAX_RPC_RESPONSE_BYTES;
  const totalDeadlineMs = Math.max(socketTimeoutMs * 8, 300_000);

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (deadline) clearTimeout(deadline);
      fn();
    };
    const fail = (error: Error) => finish(() => reject(error));
    const unavailable = (reason: string) => fail(new Error(`${prefix}_RPC_UNAVAILABLE:${reason}`));

    const send = endpoint.protocol === "https:" ? requestHttps : request;
    const req = send(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": body.length,
        ...(credentials ? { authorization: `Basic ${Buffer.from(credentials).toString("base64")}` } : {}),
      },
      timeout: socketTimeoutMs,
    }, (response) => {
      const chunks: Buffer[] = [];
      let length = 0;
      response.on("data", (chunk: Buffer) => {
        length += chunk.length;
        if (length > maxResponseBytes) {
          // Settle FIRST: destroying the response emits `aborted`, which would
          // otherwise win the race and report a retryable transport failure instead
          // of the real cause — leaving a hostile endpoint free to repeat it forever.
          fail(new Error(`${prefix}_RPC_RESPONSE_TOO_LARGE`));
          response.destroy();
          return;
        }
        chunks.push(chunk);
      });
      response.on("aborted", () => unavailable("RESPONSE_ABORTED"));
      response.on("error", (error: Error) => unavailable(`RESPONSE_ERROR:${error.message}`));
      response.on("close", () => { if (!response.complete) unavailable("RESPONSE_INCOMPLETE"); });
      response.on("end", () => {
        finish(() => {
          // Nothing below may throw out of this event callback: an exception raised
          // inside an emitter handler is neither a Promise rejection nor catchable by
          // the caller. `JSON.parse("null")` returning null (not undefined) used to
          // reach `payload.error` and throw a TypeError from exactly here.
          try {
            const status = response.statusCode;
            const envelope = parseJsonRpcEnvelope(Buffer.concat(chunks).toString("utf8"));

            // A well-formed JSON-RPC error for THIS request keeps its RPC meaning even
            // when a gateway stamped 502/503/504 on it — a real -8/-32603 must stay
            // fail-closed rather than being rewritten into a retryable transport error.
            const rpcError = envelope?.id === id ? envelope.error : undefined;
            if (rpcError) {
              reject(new Error(`${prefix}_RPC_ERROR:${rpcError.code}:${rpcError.message}`));
              return;
            }
            // Only a gateway response with no valid JSON-RPC error of its own is a
            // transport failure.
            if (isTransportStatus(status)) {
              reject(new Error(`${prefix}_RPC_ERROR:${status}:HTTP gateway failure`));
              return;
            }
            if (envelope === undefined) {
              reject(new Error(`${prefix}_RPC_ERROR:${status ?? 0}:MALFORMED_RESPONSE_BODY`));
              return;
            }
            if (envelope.error) {
              reject(new Error(`${prefix}_RPC_ERROR:${envelope.error.code}:${envelope.error.message}`));
              return;
            }
            if (status !== 200) {
              reject(new Error(`${prefix}_RPC_ERROR:${status}:HTTP failure`));
              return;
            }
            if (envelope.id !== id) {
              reject(new Error(`${prefix}_RPC_ID_MISMATCH`));
              return;
            }
            resolve(envelope.result as T);
          } catch (error) {
            reject(new Error(`${prefix}_RPC_ERROR:0:MALFORMED_RESPONSE_BODY:${error instanceof Error ? error.message : String(error)}`));
          }
        });
      });
    });

    deadline = setTimeout(() => {
      req.destroy();
      unavailable("TOTAL_DEADLINE_EXCEEDED");
    }, totalDeadlineMs);
    if (typeof deadline.unref === "function") deadline.unref();

    req.on("timeout", () => req.destroy(new Error(`${prefix}_RPC_TIMEOUT`)));
    req.on("error", (error: Error) => {
      if (error.message === `${prefix}_RPC_TIMEOUT`) { fail(new Error(`${prefix}_RPC_TIMEOUT`)); return; }
      unavailable(error.message);
    });
    req.on("close", () => unavailable("REQUEST_CLOSED_BEFORE_RESPONSE"));
    req.end(body);
  });
}

abstract class HttpTransportBase implements RpcTransport {
  private nextId = 1;
  private readonly endpoint: URL;

  protected constructor(
    private readonly config: IndexerRpcConnectionConfig,
    private readonly allowedMethods: ReadonlySet<ReadonlyRpcMethod>,
  ) {
    this.endpoint = assertSafeEndpoint(config);
  }

  async call<T>(method: ReadonlyRpcMethod, params: readonly unknown[] = []): Promise<T> {
    if (!this.allowedMethods.has(method)) throw new Error("NON_READONLY_RPC_METHOD_REJECTED");
    return performRpcCall<T>(this.endpoint, "INDEXER", this.config, this.nextId++, method, params);
  }
}

export class BitcoinCoreIndexerHttpTransport extends HttpTransportBase {
  constructor(config: IndexerRpcConnectionConfig) {
    if (config.network !== "signet" && config.network !== "mainnet" && config.network !== "regtest") {
      throw new Error("INDEXER_NETWORK_IDENTITY_MISMATCH");
    }
    super(config, config.network === "mainnet" ? MAINNET_ZERO_VALUE_METHODS : INDEXER_SYNC_METHODS);
  }

  override call<T>(method: IndexerSyncRpcMethod, params: readonly unknown[] = []): Promise<T> {
    return super.call(method, params);
  }
}

export class BitcoinCoreHttpTransport implements RpcTransport {
  private nextId = 1;
  private readonly endpoint: URL;

  constructor(private readonly config: SignetRpcConnectionConfig) {
    if ((config as { network?: string }).network !== "signet") throw new Error("NON_SIGNET_RPC_CONFIG_REJECTED");
    this.endpoint = assertSafeEndpoint(config);
  }

  async call<T>(method: ReadonlyRpcMethod, params: readonly unknown[] = []): Promise<T> {
    if (!ALLOWED_METHODS.has(method)) throw new Error("NON_READONLY_RPC_METHOD_REJECTED");
    return performRpcCall<T>(this.endpoint, "SIGNET", this.config, this.nextId++, method, params);
  }
}
