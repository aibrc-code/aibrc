import {
  applyDeploy,
  applyTransfer,
  classifyProtocolPayload,
  createProtocolState,
  decodeDeploy,
  decodeTransfer,
  deriveStateHash,
  NAME_POLICY_V1_SCHEDULE,
  NetworkId,
  namePolicyContextForBlock,
  serializeCanonicalState,
  type ProtocolState,
  type TransactionContext,
} from "../src/index.js";

export interface ChainVectorTransaction {
  readonly txid: string;
  readonly txidDisplayBytes: string;
  readonly txIndex: number;
  readonly rawProtocolPayloadHex: string;
  readonly inputs: TransactionContext["inputs"];
  readonly outputs: Array<Omit<TransactionContext["outputs"][number], "valueSats"> & { valueSats: string }>;
  readonly bitcoinTransactionContext: {
    readonly inputs: TransactionContext["inputs"];
    readonly outputs: Array<Omit<TransactionContext["outputs"][number], "valueSats"> & { valueSats: string }>;
  };
}

export interface ChainVectorBlock {
  readonly height: number;
  readonly hash: string;
  readonly parentHash: string | null;
  readonly transactions: readonly ChainVectorTransaction[];
}

export interface ChainVectorPhase {
  readonly label: string;
  readonly blocks: readonly ChainVectorBlock[];
}

export interface LocatorExpectation {
  readonly blockHeight: number;
  readonly txIndex: number;
}

export interface ChainVectorDefinition {
  readonly id: string;
  readonly description: string;
  readonly initialState: ReturnType<typeof canonicalStateObject>;
  readonly phases: readonly ChainVectorPhase[];
  readonly queriedNames: readonly string[];
  readonly queriedLocators: readonly LocatorExpectation[];
}

export interface ChainReplayResult {
  readonly canonicalTip: { readonly height: number; readonly hash: string } | null;
  readonly canonicalFinalState: ReturnType<typeof canonicalStateObject>;
  readonly assets: ReturnType<typeof canonicalStateObject>["assets"];
  readonly balances: readonly [string, string][];
  readonly nameWinners: Readonly<Record<string, { assetId: string; deployTxid: string } | null>>;
  readonly locatorValidity: readonly (LocatorExpectation & { valid: boolean; assetId: string | null })[];
  readonly stateHash: string;
}

function cloneState(state: ProtocolState): ProtocolState {
  return {
    assetsById: new Map([...state.assetsById].map(([key, asset]) => [key, { ...asset, locator: { ...asset.locator } }])),
    assetIdByName: new Map(state.assetIdByName),
    assetIdByLocator: new Map(state.assetIdByLocator),
    balances: new Map(state.balances),
  };
}

function canonicalStateObject(state: ProtocolState) {
  return JSON.parse(serializeCanonicalState(state).toString("utf8")) as {
    assets: Array<{
      assetId: string;
      name: string;
      network: NetworkId;
      totalSupply: string;
      deployTxid: string;
      ownerOutputIndex: number;
      locator: [number, number];
    }>;
    names: Array<[string, string]>;
    locators: Array<[string, string]>;
    balances: Array<[string, string]>;
  };
}

function stateFromCanonicalObject(serialized: ReturnType<typeof canonicalStateObject>): ProtocolState {
  const state = createProtocolState();
  for (const asset of serialized.assets) {
    state.assetsById.set(asset.assetId, {
      ...asset,
      network: asset.network,
      totalSupply: BigInt(asset.totalSupply),
      locator: { blockHeight: asset.locator[0], txIndex: asset.locator[1] },
    });
  }
  state.assetIdByName = new Map(serialized.names);
  state.assetIdByLocator = new Map(serialized.locators);
  state.balances = new Map(serialized.balances.map(([key, balance]) => [key, BigInt(balance)]));
  return state;
}

function blockMap(blocks: readonly ChainVectorBlock[]): Map<number, ChainVectorBlock> {
  return new Map(blocks.map((block) => [block.height, block]));
}

export class PureChainReplayHarness {
  private state: ProtocolState;
  private canonicalBlocks = new Map<number, ChainVectorBlock>();
  private snapshots = new Map<number, ProtocolState>();

  constructor(initialState: ProtocolState = createProtocolState()) {
    this.state = cloneState(initialState);
  }

  get canonicalTip(): { height: number; hash: string } | null {
    if (this.canonicalBlocks.size === 0) return null;
    const height = Math.max(...this.canonicalBlocks.keys());
    return { height, hash: this.canonicalBlocks.get(height)!.hash };
  }

  captureSnapshot(): {
    state: ProtocolState;
    canonicalBlocks: Map<number, ChainVectorBlock>;
    snapshots: Map<number, ProtocolState>;
  } {
    return {
      state: cloneState(this.state),
      canonicalBlocks: new Map(this.canonicalBlocks),
      snapshots: new Map([...this.snapshots].map(([height, state]) => [height, cloneState(state)])),
    };
  }

  restoreSnapshot(snapshot: ReturnType<PureChainReplayHarness["captureSnapshot"]>): void {
    this.state = cloneState(snapshot.state);
    this.canonicalBlocks = new Map(snapshot.canonicalBlocks);
    this.snapshots = new Map([...snapshot.snapshots].map(([height, state]) => [height, cloneState(state)]));
  }

  async replay(phases: readonly ChainVectorPhase[]): Promise<ProtocolState> {
    for (const phase of phases) await this.applyCanonicalPhase(phase.blocks);
    return cloneState(this.state);
  }

  private async applyCanonicalPhase(blocks: readonly ChainVectorBlock[]): Promise<void> {
    const nextCanonical = blockMap(blocks);
    const oldTip = this.canonicalBlocks.size === 0 ? -1 : Math.max(...this.canonicalBlocks.keys());
    const newTip = blocks.length === 0 ? -1 : Math.max(...blocks.map((block) => block.height));
    let ancestor = Math.min(oldTip, newTip);
    while (ancestor >= 0) {
      const oldBlock = this.canonicalBlocks.get(ancestor);
      const newBlock = nextCanonical.get(ancestor);
      if (oldBlock && newBlock && oldBlock.hash === newBlock.hash) break;
      ancestor -= 1;
    }

    if (this.canonicalBlocks.size > 0) {
      this.state = ancestor >= 0 ? cloneState(this.snapshots.get(ancestor)!) : createProtocolState();
      for (const height of [...this.snapshots.keys()]) if (height > ancestor) this.snapshots.delete(height);
    }
    this.canonicalBlocks = new Map([...nextCanonical].filter(([height]) => height <= ancestor));

    for (let height = ancestor + 1; height <= newTip; height += 1) {
      const block = nextCanonical.get(height);
      if (!block) throw new Error(`Chain vector missing canonical block ${height}.`);
      const expectedParent = height === 0 ? null : this.canonicalBlocks.get(height - 1)?.hash ?? null;
      if (block.parentHash !== expectedParent) throw new Error(`Chain vector block ${height}:${block.hash} has invalid parent.`);
      const transactions = [...block.transactions].sort((left, right) => left.txIndex - right.txIndex);
      for (const transaction of transactions) this.processTransaction(block.height, transaction);
      const definition = blocks.find((candidate) => candidate.height === height)!;
      this.canonicalBlocks.set(height, definition);
      this.snapshots.set(height, cloneState(this.state));
    }
  }

  private processTransaction(blockHeight: number, transaction: ChainVectorTransaction): void {
    const payload = Buffer.from(transaction.rawProtocolPayloadHex, "hex");
    const namePolicy = namePolicyContextForBlock(NAME_POLICY_V1_SCHEDULE, blockHeight);
    const classified = classifyProtocolPayload(payload, { expectedNetwork: NetworkId.SIGNET, namePolicy });
    if (classified.status === "NEEDS_UPGRADE") throw new Error("Chain vector unexpectedly requires an upgrade.");
    if (classified.status !== "VALID") return;
    const tx: TransactionContext = {
      txid: transaction.txid,
      blockHeight,
      txIndex: transaction.txIndex,
      inputs: transaction.bitcoinTransactionContext.inputs.map((input) => ({ ...input })),
      outputs: transaction.bitcoinTransactionContext.outputs.map((output) => ({ ...output, valueSats: BigInt(output.valueSats) })),
    };
    if (classified.instruction?.kind === "DEPLOY") applyDeploy(decodeDeploy(payload, namePolicy), tx, this.state, namePolicy);
    else applyTransfer(decodeTransfer(payload), tx, this.state);
  }
}

export async function executeChainVector(vector: ChainVectorDefinition): Promise<ChainReplayResult> {
  const harness = new PureChainReplayHarness(stateFromCanonicalObject(vector.initialState));
  const state = await harness.replay(vector.phases);
  const canonical = canonicalStateObject(state);
  const nameWinners: Record<string, { assetId: string; deployTxid: string } | null> = {};
  for (const name of vector.queriedNames) {
    const assetId = state.assetIdByName.get(name);
    nameWinners[name] = assetId ? { assetId, deployTxid: state.assetsById.get(assetId)!.deployTxid } : null;
  }
  return {
    canonicalTip: harness.canonicalTip,
    canonicalFinalState: canonical,
    assets: canonical.assets,
    balances: canonical.balances,
    nameWinners,
    locatorValidity: vector.queriedLocators.map((locator) => {
      const assetId = state.assetIdByLocator.get(`${locator.blockHeight}:${locator.txIndex}`) ?? null;
      return { ...locator, valid: assetId !== null, assetId };
    }),
    stateHash: deriveStateHash(state),
  };
}
