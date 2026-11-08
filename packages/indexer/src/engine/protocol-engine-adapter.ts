import type { IndexerBlock, ProtocolEngine, ProtocolEngineResult } from "../core/types.js";
import {
  INPUT_AUTHORIZATION_RULE_ID,
  MAGIC,
  WIRE_VERSION,
  applyDeploy,
  applyTransfer,
  classifyExtractedAibrcTransaction,
  createProtocolState,
  decodeAssetLocator,
  decodeDeploy,
  decodeTransfer,
  decodeTxidDisplayBytes,
  deriveAccountKey,
  deriveAssetId,
  encodeAssetLocator,
  encodeTxidDisplayBytes,
  extractAibrcPayloadsFromOutputs,
  namePolicyContextForBlock,
  validateDeploy,
  validateTransfer,
  type ApplyResult,
  type NetworkId,
  type NamePolicyContext,
  type NamePolicySchedule,
  type ProtocolState,
  type TransactionClassificationResult,
  type TransactionContext,
} from "@aibrc/protocol";
import {
  assertEngineSnapshotAuthorizationRule,
  cloneProtocolState,
  createEngineSnapshot,
  createImmutableConsensusState,
  deepFreeze,
  materializeCanonicalProtocolState,
  protocolStateFromCanonicalBytes,
  snapshotBytes,
  type CanonicalProtocolStateMaterialization,
} from "./state.js";
import type {
  CanonicalTip,
  IndexedAssetRecord,
  IndexedTransferRecord,
  IndexerConsensusState,
  OfflineTransactionMetadata,
  SerializedEngineSnapshot,
  TransactionOutcome,
} from "./types.js";

export interface OfflineProtocolEngineOptions {
  readonly expectedNetwork: NetworkId;
  readonly namePolicy: NamePolicySchedule;
  readonly activatedVersions?: ReadonlySet<number>;
  readonly initialProtocolState?: ProtocolState;
}

export interface EngineMemoizationDiagnostics {
  readonly canonicalMaterializations: number;
  readonly canonicalMaterializationMilliseconds: number;
  readonly consensusStateMaterializations: number;
  readonly consensusStateMaterializationMilliseconds: number;
  readonly consensusStateDeepFreezeMilliseconds: number;
  readonly serializedSnapshotMaterializations: number;
  readonly serializedSnapshotMaterializationMilliseconds: number;
  readonly serializedSnapshotDeepFreezeMilliseconds: number;
}

interface MemoizedCanonicalProtocolState {
  readonly canonicalStateBytes: Buffer | null;
  readonly stateHash: string;
}

function metadataOf(blockHeight: number, transaction: IndexerBlock["transactions"][number]): OfflineTransactionMetadata {
  const metadata = transaction.metadata as Partial<OfflineTransactionMetadata> | undefined;
  if (!metadata || !Number.isSafeInteger(metadata.txIndex) || metadata.txIndex! < 0) {
    throw new Error(`Block ${blockHeight} transaction ${transaction.txid} lacks a valid original txIndex.`);
  }
  if (metadata.inputAuthorizationRuleId !== INPUT_AUTHORIZATION_RULE_ID) {
    throw new Error("INPUT_AUTHORIZATION_RULE_MISMATCH");
  }
  if (!metadata.txidDisplayBytes || !metadata.bitcoinTransactionContext || !metadata.payloadSource) {
    throw new Error(`Block ${blockHeight} transaction ${transaction.txid} lacks offline Bitcoin context.`);
  }
  const normalized = encodeTxidDisplayBytes(decodeTxidDisplayBytes(metadata.txidDisplayBytes));
  if (normalized !== transaction.txid.toLowerCase()) {
    throw new Error(`Block ${blockHeight} transaction txid_display_bytes mismatch.`);
  }
  return metadata as OfflineTransactionMetadata;
}

function classifyMetadata(
  metadata: OfflineTransactionMetadata,
  expectedNetwork: NetworkId,
  activatedVersions: ReadonlySet<number>,
  namePolicy: NamePolicyContext,
): { readonly payloads: readonly Buffer[]; readonly classified: TransactionClassificationResult } {
  const context = { expectedNetwork, activatedVersions, namePolicy };
  const extraction = extractAibrcPayloadsFromOutputs(metadata.bitcoinTransactionContext.outputs);
  return {
    payloads: extraction.payloads,
    classified: classifyExtractedAibrcTransaction(extraction, context),
  };
}

function transactionContext(blockHeight: number, metadata: OfflineTransactionMetadata): TransactionContext {
  return {
    txid: metadata.txidDisplayBytes.toLowerCase(),
    blockHeight,
    txIndex: metadata.txIndex,
    inputs: metadata.bitcoinTransactionContext.inputs.map((input) => ({ ...input })),
    outputs: metadata.bitcoinTransactionContext.outputs.map((output) => ({
      ...output,
      valueSats: typeof output.valueSats === "bigint" ? output.valueSats : BigInt(output.valueSats),
    })),
  };
}

export class OfflineProtocolEngine implements ProtocolEngine {
  private protocolState: ProtocolState;
  private indexedAssets = new Map<string, IndexedAssetRecord>();
  private transferRecords: IndexedTransferRecord[] = [];
  // Only the unpersisted reference backend retains an in-memory history. Real
  // Core/SQLite and restored v2 replicas always select the external backend.
  private externalTransferHistory = false;
  private canonicalTip: CanonicalTip | null = null;
  private lastVerifiedHeight: number | null = null;
  private lastBlockOutcomes: TransactionOutcome[] = [];
  private readonly activatedVersions: ReadonlySet<number>;
  private readonly expectedNetwork: NetworkId;
  private readonly namePolicySchedule: NamePolicySchedule;
  private memoizedCanonical: Readonly<MemoizedCanonicalProtocolState> | null = null;
  private memoizedConsensusState: IndexerConsensusState | null = null;
  private memoizedSerializedSnapshot: SerializedEngineSnapshot | null = null;
  private canonicalMaterializations = 0;
  private canonicalMaterializationMilliseconds = 0;
  private consensusStateMaterializations = 0;
  private consensusStateMaterializationMilliseconds = 0;
  private consensusStateDeepFreezeMilliseconds = 0;
  private serializedSnapshotMaterializations = 0;
  private serializedSnapshotMaterializationMilliseconds = 0;
  private serializedSnapshotDeepFreezeMilliseconds = 0;
  private mutationInProgress = false;

  constructor(options: OfflineProtocolEngineOptions) {
    if (!options || !Number.isInteger(options.expectedNetwork) || options.expectedNetwork < 0 || options.expectedNetwork > 3) {
      throw new Error("EXPECTED_NETWORK_REQUIRED");
    }
    namePolicyContextForBlock(options.namePolicy, 0);
    this.protocolState = cloneProtocolState(options.initialProtocolState ?? createProtocolState());
    this.activatedVersions = new Set(options.activatedVersions ?? [WIRE_VERSION]);
    this.expectedNetwork = options.expectedNetwork;
    this.namePolicySchedule = { ...options.namePolicy };
  }

  get state(): IndexerConsensusState {
    this.assertStateReadable();
    if (this.memoizedConsensusState) return this.memoizedConsensusState;
    const canonical = this.canonical();
    const startedAt = performance.now();
    const materialized = createImmutableConsensusState({
      protocolState: this.protocolState,
      indexedAssets: this.indexedAssets,
      transferRecords: this.transferRecords,
      canonicalTip: this.canonicalTip,
      lastVerifiedHeight: this.lastVerifiedHeight,
      stateHash: canonical.stateHash,
      lastBlockOutcomes: this.lastBlockOutcomes,
    });
    this.consensusStateMaterializations += 1;
    this.consensusStateMaterializationMilliseconds += performance.now() - startedAt;
    this.consensusStateDeepFreezeMilliseconds += materialized.deepFreezeMilliseconds;
    this.memoizedConsensusState = materialized.state;
    return materialized.state;
  }

  useExternalTransferHistory(): void {
    this.assertStateReadable();
    this.externalTransferHistory = true;
    this.transferRecords = [];
    this.invalidateMemoizedState();
  }

  get deterministicSnapshotBytes(): Buffer {
    this.assertStateReadable();
    return snapshotBytes(this.captureSnapshot());
  }

  /** Read-only, per-instance counters used to prove cache cardinality and cost. */
  get memoizationDiagnostics(): EngineMemoizationDiagnostics {
    return Object.freeze({
      canonicalMaterializations: this.canonicalMaterializations,
      canonicalMaterializationMilliseconds: this.canonicalMaterializationMilliseconds,
      consensusStateMaterializations: this.consensusStateMaterializations,
      consensusStateMaterializationMilliseconds: this.consensusStateMaterializationMilliseconds,
      consensusStateDeepFreezeMilliseconds: this.consensusStateDeepFreezeMilliseconds,
      serializedSnapshotMaterializations: this.serializedSnapshotMaterializations,
      serializedSnapshotMaterializationMilliseconds: this.serializedSnapshotMaterializationMilliseconds,
      serializedSnapshotDeepFreezeMilliseconds: this.serializedSnapshotDeepFreezeMilliseconds,
    });
  }

  async processBlock(block: IndexerBlock): Promise<ProtocolEngineResult> {
    this.beginMutation();
    let before: SerializedEngineSnapshot | null = null;
    let stateMayHaveMutated = false;
    try {
      before = this.captureSnapshot();
      this.invalidateMemoizedState();
      const transactions = block.transactions
        .map((transaction) => ({ transaction, metadata: metadataOf(block.height, transaction) }))
        .sort((left, right) => left.metadata.txIndex - right.metadata.txIndex);
      const indexes = transactions.map(({ metadata }) => metadata.txIndex);
      if (new Set(indexes).size !== indexes.length) throw new Error(`Block ${block.height} contains duplicate transaction indexes.`);
      const namePolicy = namePolicyContextForBlock(this.namePolicySchedule, block.height);
      const appliedTransfers: IndexedTransferRecord[] = [];
      this.lastBlockOutcomes = [];
      stateMayHaveMutated = true;

      for (const { metadata } of transactions) {
        const { payloads, classified } = classifyMetadata(
          metadata,
          this.expectedNetwork,
          this.activatedVersions,
          namePolicy,
        );
        if (classified.status === "NEEDS_UPGRADE") {
          this.restoreSnapshot(before);
          return { status: "NEEDS_UPGRADE", reason: classified.reason };
        }
        if (classified.status !== "VALID") {
          this.lastBlockOutcomes.push({
            txidDisplayBytes: metadata.txidDisplayBytes,
            txIndex: metadata.txIndex,
            result: { status: "NO_OP", reason: classified.reason },
          });
          continue;
        }

        const marker = payloads.find((payload) => payload.length >= 4 && payload.subarray(0, 4).equals(MAGIC))!;
        const tx = transactionContext(block.height, metadata);
        let result: ApplyResult;
        if (classified.instruction!.kind === "DEPLOY") {
          const instruction = decodeDeploy(marker, namePolicy);
          const reason = validateDeploy(instruction, tx, this.protocolState, namePolicy);
          result = applyDeploy(instruction, tx, this.protocolState, namePolicy);
          if (result.reason !== reason) throw new Error("Frozen Deploy validate/apply result mismatch.");
          if (result.status === "APPLIED") {
            const expectedAssetId = deriveAssetId({
              network: instruction.network,
              deployTxid: tx.txid,
              ownerOutputIndex: instruction.ownerOutputIndex,
              canonicalNameBytes: instruction.canonicalNameBytes,
            }, namePolicy);
            if (result.assetId !== expectedAssetId) throw new Error("Frozen Asset ID derivation mismatch.");
            const locatorBytes = encodeAssetLocator({ blockHeight: block.height, txIndex: metadata.txIndex });
            const locator = decodeAssetLocator(locatorBytes);
            this.indexedAssets.set(expectedAssetId, {
              assetId: expectedAssetId,
              name: instruction.name,
              compactLocatorHex: locatorBytes.toString("hex"),
              locator,
              deployTxidDisplayBytes: tx.txid,
              deployHeight: block.height,
              deployTxIndex: metadata.txIndex,
              deployerAccount: deriveAccountKey(tx.inputs[instruction.deployAuthInputIndex]!.prevoutScriptPubKeyHex),
              ownerAccount: deriveAccountKey(tx.outputs[instruction.ownerOutputIndex]!.scriptPubKeyHex),
              totalSupply: instruction.totalSupply,
            });
          }
        } else {
          const instruction = decodeTransfer(marker);
          const reason = validateTransfer(instruction, tx, this.protocolState);
          const locatorAssetId = this.protocolState.assetIdByLocator.get(`${instruction.assetLocator.blockHeight}:${instruction.assetLocator.txIndex}`);
          result = applyTransfer(instruction, tx, this.protocolState);
          if (result.reason !== reason) throw new Error("Frozen Transfer validate/apply result mismatch.");
          if (result.status === "APPLIED") {
            if (!locatorAssetId || result.assetId !== locatorAssetId) throw new Error("Frozen locator resolution mismatch.");
            const record: IndexedTransferRecord = {
              txidDisplayBytes: tx.txid,
              blockHeight: block.height,
              txIndex: metadata.txIndex,
              assetId: locatorAssetId,
              senderAccount: deriveAccountKey(tx.inputs[instruction.authInputIndex]!.prevoutScriptPubKeyHex),
              allocations: instruction.allocations.map((allocation) => ({
                receiverAccount: deriveAccountKey(tx.outputs[allocation.receiverOutputIndex]!.scriptPubKeyHex),
                amount: allocation.amount,
              })),
            };
            appliedTransfers.push(record);
            if (!this.externalTransferHistory) this.transferRecords.push(record);
          }
        }
        this.lastBlockOutcomes.push({
          txidDisplayBytes: metadata.txidDisplayBytes,
          txIndex: metadata.txIndex,
          result: { ...result },
        });
      }
      this.canonicalTip = { height: block.height, hash: block.hash };
      this.lastVerifiedHeight = block.height;
      this.canonical();
      return { status: "PROCESSED", undoToken: before, appliedTransfers };
    } catch (error) {
      if (before && stateMayHaveMutated) this.restoreSnapshot(before);
      throw error;
    } finally {
      this.endMutation();
    }
  }

  async rollbackBlock(block: IndexerBlock, undoToken: unknown): Promise<void> {
    this.beginMutation();
    try {
      if (this.canonicalTip?.height !== block.height || this.canonicalTip.hash !== block.hash) {
        throw new Error(`Rollback block ${block.height}:${block.hash} is not the current canonical tip.`);
      }
      this.restoreSnapshot(undoToken as SerializedEngineSnapshot);
    } finally {
      this.endMutation();
    }
  }

  async captureState(): Promise<unknown> {
    this.assertStateReadable();
    return this.captureSnapshot();
  }

  async restoreState(state: unknown): Promise<void> {
    this.beginMutation();
    try {
      this.restoreSnapshot(state as SerializedEngineSnapshot);
    } finally {
      this.endMutation();
    }
  }

  private captureSnapshot(): SerializedEngineSnapshot {
    if (this.memoizedSerializedSnapshot) return this.memoizedSerializedSnapshot;
    const canonical = this.canonical();
    if (!canonical.canonicalStateBytes) throw new Error("ENGINE_CANONICAL_BYTES_UNAVAILABLE");
    const startedAt = performance.now();
    const snapshot = createEngineSnapshot({
      protocolState: this.protocolState,
      indexedAssets: this.indexedAssets,
      transferRecords: this.transferRecords,
      canonicalTip: this.canonicalTip,
      lastVerifiedHeight: this.lastVerifiedHeight,
      lastBlockOutcomes: this.lastBlockOutcomes,
    }, { canonicalStateBytes: canonical.canonicalStateBytes, stateHash: canonical.stateHash });
    if (this.externalTransferHistory) (snapshot as { schemaVersion: 1 | 2 }).schemaVersion = 2;
    const freezeStartedAt = performance.now();
    deepFreeze(snapshot);
    this.serializedSnapshotDeepFreezeMilliseconds += performance.now() - freezeStartedAt;
    this.serializedSnapshotMaterializations += 1;
    this.serializedSnapshotMaterializationMilliseconds += performance.now() - startedAt;
    this.memoizedSerializedSnapshot = snapshot;
    this.memoizedCanonical = Object.freeze({ canonicalStateBytes: null, stateHash: canonical.stateHash });
    return snapshot;
  }

  private restoreSnapshot(snapshot: SerializedEngineSnapshot): void {
    if (!snapshot) throw new Error("Unsupported offline engine snapshot.");
    assertEngineSnapshotAuthorizationRule(snapshot);
    this.invalidateMemoizedState();
    const schemaVersion = snapshot.schemaVersion;
    const protocolStateHex = snapshot.protocolStateHex;
    const expectedStateHash = snapshot.stateHash;
    const snapshotIndexedAssets = snapshot.indexedAssets;
    const snapshotTransferRecords = snapshot.transferRecords;
    const snapshotCanonicalTip = snapshot.canonicalTip;
    const lastVerifiedHeight = snapshot.lastVerifiedHeight;
    const snapshotLastBlockOutcomes = snapshot.lastBlockOutcomes;
    if ((schemaVersion !== 1 && schemaVersion !== 2) || !Array.isArray(snapshotTransferRecords)
      || (schemaVersion === 2 && snapshotTransferRecords.length !== 0)) throw new Error("Unsupported offline engine snapshot.");
    const state = protocolStateFromCanonicalBytes(Buffer.from(protocolStateHex, "hex"));
    const canonical = this.materializeCanonical(state);
    if (canonical.stateHash !== expectedStateHash) throw new Error("Offline engine snapshot State Hash mismatch.");
    const indexedAssets = new Map(snapshotIndexedAssets.map((asset) => [asset.assetId, {
      ...asset,
      locator: { ...asset.locator },
      totalSupply: BigInt(asset.totalSupply),
    }]));
    const externalHistory = this.externalTransferHistory || schemaVersion === 2;
    const transferRecords = externalHistory ? [] : snapshotTransferRecords.map((record:SerializedEngineSnapshot['transferRecords'][number]) => ({
      ...record,
      allocations: record.allocations.map((allocation) => ({
        receiverAccount: allocation.receiverAccount,
        amount: BigInt(allocation.amount),
      })),
    }));
    const canonicalTip = snapshotCanonicalTip ? { ...snapshotCanonicalTip } : null;
    const lastBlockOutcomes = structuredClone([...snapshotLastBlockOutcomes]);

    this.protocolState = state;
    this.externalTransferHistory = externalHistory;
    this.indexedAssets = indexedAssets;
    this.transferRecords = transferRecords;
    this.canonicalTip = canonicalTip;
    this.lastVerifiedHeight = lastVerifiedHeight;
    this.lastBlockOutcomes = lastBlockOutcomes;
    this.memoizedCanonical = canonical;
  }

  private invalidateMemoizedState(): void {
    this.memoizedCanonical = null;
    this.memoizedConsensusState = null;
    this.memoizedSerializedSnapshot = null;
  }

  private assertStateReadable(): void {
    if (this.mutationInProgress) throw new Error("ENGINE_STATE_MUTATION_IN_PROGRESS");
  }

  private beginMutation(): void {
    if (this.mutationInProgress) throw new Error("ENGINE_STATE_MUTATION_IN_PROGRESS");
    this.mutationInProgress = true;
  }

  private endMutation(): void {
    this.mutationInProgress = false;
  }

  private materializeCanonical(state: ProtocolState): Readonly<CanonicalProtocolStateMaterialization> {
    const startedAt = performance.now();
    const canonical = Object.freeze(materializeCanonicalProtocolState(state));
    this.canonicalMaterializations += 1;
    this.canonicalMaterializationMilliseconds += performance.now() - startedAt;
    return canonical;
  }

  private canonical(): Readonly<MemoizedCanonicalProtocolState> {
    if (this.memoizedCanonical) return this.memoizedCanonical;
    const canonical = this.materializeCanonical(this.protocolState);
    this.memoizedCanonical = canonical;
    return canonical;
  }
}
