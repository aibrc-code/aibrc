import type {
  IndexerSnapshot,
  RollbackJournal,
  RollbackJournalEntry,
  StorageAdapter,
} from "./types.js";

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryRollbackJournal implements RollbackJournal {
  private readonly entries = new Map<number, RollbackJournalEntry>();

  async append(entry: RollbackJournalEntry): Promise<void> {
    this.entries.set(entry.block.height, cloneValue(entry));
  }

  async get(height: number): Promise<RollbackJournalEntry | null> {
    const entry = this.entries.get(height);
    return entry ? cloneValue(entry) : null;
  }

  async listDescending(fromHeight: number, exclusiveLowerBound: number): Promise<readonly RollbackJournalEntry[]> {
    return [...this.entries.values()]
      .filter((entry) => entry.block.height <= fromHeight && entry.block.height > exclusiveLowerBound)
      .sort((left, right) => right.block.height - left.block.height)
      .map(cloneValue);
  }

  async remove(height: number): Promise<void> {
    this.entries.delete(height);
  }

  async capture(): Promise<readonly RollbackJournalEntry[]> {
    return [...this.entries.values()]
      .sort((left, right) => left.block.height - right.block.height)
      .map(cloneValue);
  }

  async captureForPersistence(): Promise<readonly RollbackJournalEntry[]> {
    return [...this.entries.values()]
      .sort((left, right) => left.block.height - right.block.height);
  }

  async restore(entries: readonly RollbackJournalEntry[]): Promise<void> {
    this.entries.clear();
    for (const entry of entries) this.entries.set(entry.block.height, cloneValue(entry));
  }

  pruneBelow(oldestRetainedUndoHeight: number): number {
    let pruned = 0;
    for (const height of this.entries.keys()) {
      if (height < oldestRetainedUndoHeight) {
        this.entries.delete(height);
        pruned += 1;
      }
    }
    return pruned;
  }

  oldestHeight(): number | null {
    return this.entries.size === 0 ? null : Math.min(...this.entries.keys());
  }

  newestHeight(): number | null {
    return this.entries.size === 0 ? null : Math.max(...this.entries.keys());
  }

  size(): number {
    return this.entries.size;
  }
}

export class MemoryStorageAdapter implements StorageAdapter {
  private snapshot: IndexerSnapshot | null = null;

  async loadSnapshot(): Promise<IndexerSnapshot | null> {
    return this.snapshot ? cloneValue(this.snapshot) : null;
  }

  async saveSnapshot(snapshot: IndexerSnapshot): Promise<void> {
    const oldest = snapshot.rollbackRetention?.oldestRetainedHeight;
    this.snapshot = cloneValue({
      ...snapshot,
      rollbackEntries: oldest === null || oldest === undefined
        ? snapshot.rollbackEntries
        : snapshot.rollbackEntries.filter((entry) => entry.block.height >= oldest),
    });
  }
}
