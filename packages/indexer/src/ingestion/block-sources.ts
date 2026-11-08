import type { BlockReference, BlockSource, IndexerBlock } from "../core/index.js";
import { parseRawBitcoinBlock } from "./raw-block.js";
import type { NetworkBoundBlockProvider, NetworkBoundIngestionConfig, RawBitcoinBlockInput, SignetBlockProvider, SignetIngestionConfig } from "./types.js";

export class OfflineRawBlockSource implements BlockSource {
  private readonly blocks = new Map<number, IndexerBlock>();

  constructor(fixtures: readonly RawBitcoinBlockInput[]) {
    for (const fixture of fixtures) {
      const block = parseRawBitcoinBlock(fixture);
      if (this.blocks.has(block.height)) throw new Error(`Duplicate fixture height ${block.height}.`);
      this.blocks.set(block.height, block);
    }
  }

  async getTip(): Promise<BlockReference | null> {
    const tip = [...this.blocks.values()].sort((left, right) => right.height - left.height)[0];
    return tip ? { height: tip.height, hash: tip.hash } : null;
  }

  async getBlock(height: number): Promise<IndexerBlock | null> {
    return this.blocks.get(height) ?? null;
  }
}

export class SignetOnlyBlockSource implements BlockSource {
  constructor(
    private readonly config: SignetIngestionConfig,
    private readonly provider: SignetBlockProvider,
  ) {
    if ((config as { network?: string }).network !== "signet") throw new Error("MAINNET_AND_NON_SIGNET_NETWORKS_DISABLED");
    if (!config.enabled) throw new Error("SIGNET_INGESTION_DISABLED");
  }

  async getTip(): Promise<BlockReference | null> {
    return this.provider.getTip();
  }

  async getBlock(height: number): Promise<IndexerBlock | null> {
    const raw = await this.provider.getRawBlock(height);
    if (!raw) return null;
    if (raw.height !== height) throw new Error("SIGNET_PROVIDER_HEIGHT_MISMATCH");
    const block = parseRawBitcoinBlock(raw);
    const tipAtHeight = await this.provider.getTip();
    if (tipAtHeight?.height === height && tipAtHeight.hash.toLowerCase() !== block.hash) throw new Error("SIGNET_PROVIDER_HASH_MISMATCH");
    return block;
  }
}

export class NetworkBoundBlockSource implements BlockSource {
  constructor(
    private readonly config: NetworkBoundIngestionConfig,
    private readonly provider: NetworkBoundBlockProvider,
  ) {
    if (config.network !== "signet" && config.network !== "mainnet" && config.network !== "regtest") {
      throw new Error("INDEXER_NETWORK_IDENTITY_MISMATCH");
    }
    if (provider.network !== config.network) throw new Error("INDEXER_NETWORK_IDENTITY_MISMATCH");
    if (!config.enabled) throw new Error("INDEXER_INGESTION_DISABLED");
  }

  async getTip(): Promise<BlockReference | null> {
    return this.provider.getTip();
  }

  async getBlock(height: number): Promise<IndexerBlock | null> {
    const tipBefore = await this.provider.getTip();
    const raw = await this.provider.getRawBlock(height);
    if (!raw) {
      const tipAfter = await this.provider.getTip();
      if (!tipBefore || !tipAfter) {
        throw new Error("INDEXER_RPC_UNAVAILABLE:TIP_IDENTITY_UNAVAILABLE_DURING_BLOCK_READ");
      }
      // Only a changed height/hash proves movement during this read. A stable tip
      // below the indexed cursor is trustworthy absence, not perpetual RPC churn:
      // return it to Core's retained-common-ancestor / undo-journal path. Missing
      // blocks inside the stable tip still reach the existing fail-closed checks.
      if (tipBefore.height !== tipAfter.height ||
        tipBefore.hash.toLowerCase() !== tipAfter.hash.toLowerCase()) {
        throw new Error("INDEXER_RPC_UNAVAILABLE:TIP_MOVED_DURING_BLOCK_READ");
      }
      return null;
    }
    if (raw.height !== height) throw new Error("INDEXER_PROVIDER_HEIGHT_MISMATCH");
    const block = parseRawBitcoinBlock(raw);
    const tipAtHeight = await this.provider.getTip();
    if (tipAtHeight?.height === height && tipAtHeight.hash.toLowerCase() !== block.hash) {
      // Same height, different hash. Either the canonical chain swapped forks while we
      // were reading (transient), or the provider is stably inconsistent with itself
      // (fail closed). Only a tip that actually MOVED between the two reads proves the
      // former; a mismatch that reproduces is never whitelisted.
      if (tipBefore && (tipBefore.height !== tipAtHeight.height || tipBefore.hash.toLowerCase() !== tipAtHeight.hash.toLowerCase())) {
        throw new Error("INDEXER_RPC_UNAVAILABLE:TIP_MOVED_DURING_BLOCK_READ");
      }
      throw new Error("INDEXER_PROVIDER_HASH_MISMATCH");
    }
    return block;
  }

}
