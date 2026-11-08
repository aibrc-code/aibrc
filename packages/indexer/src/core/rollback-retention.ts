import type { RollbackJournalEntry, RollbackRetentionWindow } from "./types.js";

export function assertRollbackRetentionDepth(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error("INVALID_ROLLBACK_RETENTION_DEPTH");
  }
}

export function deriveRollbackRetentionWindow(
  activationHeight: number,
  cursorHeight: number,
  retentionDepth: number,
  entries: readonly RollbackJournalEntry[],
): RollbackRetentionWindow {
  assertRollbackRetentionDepth(retentionDepth);
  if (!Number.isSafeInteger(activationHeight) || activationHeight < 0 || !Number.isSafeInteger(cursorHeight)) {
    throw new Error("INVALID_ROLLBACK_RETENTION_WINDOW");
  }
  if (cursorHeight < activationHeight) {
    return { depth: retentionDepth, oldestRetainedHeight: null, anchorHeight: activationHeight - 1 };
  }
  const theoreticalOldest = Math.max(activationHeight, cursorHeight - retentionDepth + 1);
  const actualOldest = entries.length === 0
    ? null
    : Math.min(...entries.map((entry) => entry.block.height));
  const oldestRetainedHeight = actualOldest === null
    ? null
    : Math.max(theoreticalOldest, actualOldest);
  return {
    depth: retentionDepth,
    oldestRetainedHeight,
    anchorHeight: oldestRetainedHeight === null ? cursorHeight : oldestRetainedHeight - 1,
  };
}
