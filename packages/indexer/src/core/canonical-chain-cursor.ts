import { IndexerError, type CursorState, type IndexerBlock } from "./types.js";

export class CanonicalChainCursor {
  private current: CursorState;

  constructor(initial: CursorState) {
    if (!Number.isSafeInteger(initial.height) || initial.height < -1) {
      throw new IndexerError("INVALID_BLOCK_HEIGHT", `Invalid cursor height ${initial.height}.`);
    }
    this.current = { ...initial };
  }

  get state(): CursorState {
    return { ...this.current };
  }

  assertNextHeight(block: IndexerBlock): void {
    const expected = this.current.height + 1;
    if (block.height !== expected) {
      throw new IndexerError(
        "HEIGHT_DISCONTINUITY",
        `Expected block height ${expected}, received ${block.height}.`,
      );
    }
  }

  linksToCurrentTip(block: IndexerBlock): boolean {
    return block.previousHash === this.current.hash;
  }

  advance(block: IndexerBlock): void {
    this.assertNextHeight(block);
    if (!this.linksToCurrentTip(block)) {
      throw new IndexerError(
        "HASH_DISCONTINUITY",
        `Block ${block.height}:${block.hash} does not link to ${String(this.current.hash)}.`,
      );
    }
    this.current = { height: block.height, hash: block.hash };
  }

  rewind(previous: CursorState): void {
    if (previous.height !== this.current.height - 1) {
      throw new IndexerError(
        "HEIGHT_DISCONTINUITY",
        `Rollback must rewind one height from ${this.current.height} to ${this.current.height - 1}.`,
      );
    }
    this.current = { ...previous };
  }
}
