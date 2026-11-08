export type SyncErrorClassification =
  | "TRANSIENT_SYNC_ERROR"
  | "CONSENSUS_STATE_ERROR";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const TRANSIENT_RPC_ERROR = /^(?:SIGNET|INDEXER)_RPC_ERROR:(?:-28|[45][0-9]{2}):/;

export function classifySyncError(error: unknown): SyncErrorClassification {
  const message = errorMessage(error);
  return /^(?:SIGNET|INDEXER)_RPC_UNAVAILABLE(?::|$)/.test(message)
    || TRANSIENT_RPC_ERROR.test(message)
    || message === "SIGNET_RPC_TIMEOUT"
    || message === "INDEXER_RPC_TIMEOUT"
    ? "TRANSIENT_SYNC_ERROR"
    : "CONSENSUS_STATE_ERROR";
}

export function classifiedSyncError(error: unknown): Error {
  return new Error(`${classifySyncError(error)}:${errorMessage(error)}`, { cause: error });
}
