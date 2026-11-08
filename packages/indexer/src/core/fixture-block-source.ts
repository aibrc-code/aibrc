import type { BlockReference, BlockSource, IndexerBlock } from "./types.js";

function cloneBlock(block: IndexerBlock): IndexerBlock {
  return {
    ...block,
    transactions: block.transactions.map((transaction) => ({ ...transaction })),
  };
}

export class FixtureBlockSource implements BlockSource {
  private readonly blocks = new Map<number, IndexerBlock>();
  private readonly reads: number[] = [];

  constructor(blocks: readonly IndexerBlock[]) {
    this.replaceAll(blocks);
  }

  get requestedHeights(): readonly number[] {
    return [...this.reads];
  }

  async getTip(): Promise<BlockReference | null> {
    if (this.blocks.size === 0) return null;
    const height = Math.max(...this.blocks.keys());
    const block = this.blocks.get(height)!;
    return { height, hash: block.hash };
  }

  async getBlock(height: number): Promise<IndexerBlock | null> {
    this.reads.push(height);
    const block = this.blocks.get(height);
    return block ? cloneBlock(block) : null;
  }

  replaceAll(blocks: readonly IndexerBlock[]): void {
    this.blocks.clear();
    for (const block of blocks) this.blocks.set(block.height, cloneBlock(block));
  }

  replaceFromHeight(height: number, replacement: readonly IndexerBlock[]): void {
    for (const existingHeight of [...this.blocks.keys()]) {
      if (existingHeight >= height) this.blocks.delete(existingHeight);
    }
    for (const block of replacement) this.blocks.set(block.height, cloneBlock(block));
  }
}
