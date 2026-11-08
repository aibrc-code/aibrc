import { createHash } from "node:crypto";
import {
  INPUT_AUTHORIZATION_RULE_ID,
  createProtocolState,
  serializeCanonicalState,
  type NetworkId,
  type ProtocolState,
} from "@aibrc/protocol";
import type {
  CanonicalTip,
  IndexedAssetRecord,
  IndexedTransferRecord,
  IndexerConsensusState,
  SerializedEngineSnapshot,
  TransactionOutcome,
} from "./types.js";

const compareStrings = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

export function cloneProtocolState(state: ProtocolState): ProtocolState {
  return {
    assetsById: new Map([...state.assetsById].map(([key, asset]) => [key, { ...asset, locator: { ...asset.locator } }])),
    assetIdByName: new Map(state.assetIdByName),
    assetIdByLocator: new Map(state.assetIdByLocator),
    balances: new Map(state.balances),
  };
}

export interface CanonicalProtocolStateMaterialization {
  readonly canonicalStateBytes: Buffer;
  readonly stateHash: string;
}

export interface ImmutableConsensusStateMaterialization {
  readonly state: IndexerConsensusState;
  readonly deepFreezeMilliseconds: number;
}

/**
 * Produces the canonical bytes and their State Hash together so one engine
 * generation never serializes ProtocolState a second time merely to hash it.
 */
export function materializeCanonicalProtocolState(
  state: ProtocolState,
): CanonicalProtocolStateMaterialization {
  const bytes = serializeCanonicalState(state);
  return {
    canonicalStateBytes: bytes,
    stateHash: createHash("sha256").update(bytes).digest("hex"),
  };
}

function immutableMap<K, V>(source: Map<K, V>): ReadonlyMap<K, V> {
  const rejectMutation = (): never => { throw new TypeError("IMMUTABLE_MAP"); };
  const target = Object.create(null) as ReadonlyMap<K, V>;
  let facade!: ReadonlyMap<K, V>;
  Object.defineProperties(target, {
    size: { get: () => source.size },
    get: { value: (key: K) => source.get(key) },
    has: { value: (key: K) => source.has(key) },
    entries: { value: () => source.entries() },
    keys: { value: () => source.keys() },
    values: { value: () => source.values() },
    [Symbol.iterator]: { value: () => source[Symbol.iterator]() },
    forEach: {
      value: (
        callback: (value: V, key: K, map: ReadonlyMap<K, V>) => void,
        thisArg?: unknown,
      ) => source.forEach((value, key) => callback.call(thisArg, value, key, facade)),
    },
    set: { value: rejectMutation },
    delete: { value: rejectMutation },
    clear: { value: rejectMutation },
  });
  for (const key of Reflect.ownKeys(target)) {
    const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
    if (typeof descriptor?.get === "function") Object.freeze(descriptor.get);
    if (typeof descriptor?.value === "function") Object.freeze(descriptor.value);
  }
  Object.freeze(target);
  facade = new Proxy(target, {
    set: rejectMutation,
    defineProperty: rejectMutation,
    deleteProperty: rejectMutation,
    setPrototypeOf: rejectMutation,
  });
  return facade;
}

export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as unknown as Record<PropertyKey, unknown>)[key]);
  }
  return Object.freeze(value);
}

/**
 * Builds an isolated, runtime-immutable query view. ProtocolState is typed as
 * mutable in the protocol package because the consensus executor owns it; this
 * read view deliberately supplies Map-compatible facades whose mutators throw.
 */
export function createImmutableConsensusState(input: {
  protocolState: ProtocolState;
  indexedAssets: ReadonlyMap<string, IndexedAssetRecord>;
  transferRecords: readonly IndexedTransferRecord[];
  canonicalTip: CanonicalTip | null;
  lastVerifiedHeight: number | null;
  stateHash: string;
  lastBlockOutcomes: readonly TransactionOutcome[];
}): ImmutableConsensusStateMaterialization {
  const protocolAssets = new Map([...input.protocolState.assetsById].map(([key, asset]) => [
    key,
    { ...asset, locator: { ...asset.locator } },
  ]));
  const protocolState = {
    assetsById: immutableMap(protocolAssets) as unknown as ProtocolState["assetsById"],
    assetIdByName: immutableMap(new Map(input.protocolState.assetIdByName)) as unknown as ProtocolState["assetIdByName"],
    assetIdByLocator: immutableMap(new Map(input.protocolState.assetIdByLocator)) as unknown as ProtocolState["assetIdByLocator"],
    balances: immutableMap(new Map(input.protocolState.balances)) as unknown as ProtocolState["balances"],
  };
  const indexedAssets = immutableMap(new Map([...input.indexedAssets].map(([key, asset]) => [
    key,
    { ...asset, locator: { ...asset.locator } },
  ])));
  const transferRecords = input.transferRecords.map((record) => ({
    ...record,
    allocations: record.allocations.map((allocation) => ({ ...allocation })),
  }));
  const lastBlockOutcomes = structuredClone(input.lastBlockOutcomes);
  const freezeStartedAt = performance.now();
  for (const asset of protocolAssets.values()) deepFreeze(asset);
  for (const asset of indexedAssets.values()) deepFreeze(asset);
  for (const record of transferRecords) deepFreeze(record);
  const state = deepFreeze({
    protocolState,
    indexedAssets,
    transferRecords,
    canonicalTip: input.canonicalTip ? { ...input.canonicalTip } : null,
    lastVerifiedHeight: input.lastVerifiedHeight,
    stateHash: input.stateHash,
    lastBlockOutcomes,
  });
  return {
    state,
    deepFreezeMilliseconds: performance.now() - freezeStartedAt,
  };
}

export function protocolStateFromCanonicalBytes(bytes: Buffer): ProtocolState {
  const parsed = JSON.parse(bytes.toString("utf8")) as {
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
  const state = createProtocolState();
  for (const asset of parsed.assets) {
    state.assetsById.set(asset.assetId, {
      assetId: asset.assetId,
      name: asset.name,
      network: asset.network,
      totalSupply: BigInt(asset.totalSupply),
      deployTxid: asset.deployTxid,
      ownerOutputIndex: asset.ownerOutputIndex,
      locator: { blockHeight: asset.locator[0], txIndex: asset.locator[1] },
    });
  }
  state.assetIdByName = new Map(parsed.names);
  state.assetIdByLocator = new Map(parsed.locators);
  state.balances = new Map(parsed.balances.map(([key, value]) => [key, BigInt(value)]));
  return state;
}

export function createEngineSnapshot(input: {
  protocolState: ProtocolState;
  indexedAssets: ReadonlyMap<string, IndexedAssetRecord>;
  transferRecords: readonly IndexedTransferRecord[];
  canonicalTip: CanonicalTip | null;
  lastVerifiedHeight: number | null;
  lastBlockOutcomes: readonly TransactionOutcome[];
}, canonical = materializeCanonicalProtocolState(input.protocolState)): SerializedEngineSnapshot {
  return {
    schemaVersion: 1,
    inputAuthorizationRuleId: INPUT_AUTHORIZATION_RULE_ID,
    protocolStateHex: canonical.canonicalStateBytes.toString("hex"),
    indexedAssets: [...input.indexedAssets.values()]
      .sort((left, right) => compareStrings(left.assetId, right.assetId))
      .map((asset) => ({ ...asset, locator: { ...asset.locator }, totalSupply: asset.totalSupply.toString() })),
    transferRecords: input.transferRecords
      .map((record) => ({
        ...record,
        allocations: record.allocations.map((allocation) => ({
          receiverAccount: allocation.receiverAccount,
          amount: allocation.amount.toString(),
        })),
      }))
      .sort((left, right) => left.blockHeight - right.blockHeight || left.txIndex - right.txIndex),
    canonicalTip: input.canonicalTip ? { ...input.canonicalTip } : null,
    lastVerifiedHeight: input.lastVerifiedHeight,
    stateHash: canonical.stateHash,
    lastBlockOutcomes: structuredClone(input.lastBlockOutcomes),
  };
}

/**
 * Snapshots and undo tokens carry the same interpretation identity. A legacy
 * snapshot is not silently relabelled; the only safe compatibility case is the
 * exact, never-processed empty bootstrap state, with no history or projection.
 */
export function assertEngineSnapshotAuthorizationRule(snapshot: unknown): void {
  if (!snapshot || typeof snapshot !== "object") throw new Error("INPUT_AUTHORIZATION_RULE_MISMATCH");
  const candidate = snapshot as Partial<SerializedEngineSnapshot>;
  if (candidate.inputAuthorizationRuleId === INPUT_AUTHORIZATION_RULE_ID) return;
  if (candidate.inputAuthorizationRuleId !== undefined) throw new Error("INPUT_AUTHORIZATION_RULE_MISMATCH");
  const emptyBytes = serializeCanonicalState(createProtocolState());
  const empty = (candidate.schemaVersion === 1 || candidate.schemaVersion === 2)
    && candidate.protocolStateHex === emptyBytes.toString("hex")
    && candidate.stateHash === createHash("sha256").update(emptyBytes).digest("hex")
    && candidate.canonicalTip === null
    && candidate.lastVerifiedHeight === null
    && Array.isArray(candidate.indexedAssets) && candidate.indexedAssets.length === 0
    && Array.isArray(candidate.transferRecords) && candidate.transferRecords.length === 0
    && Array.isArray(candidate.lastBlockOutcomes) && candidate.lastBlockOutcomes.length === 0;
  if (!empty) throw new Error("INPUT_AUTHORIZATION_RULE_MISMATCH");
}

export function snapshotBytes(snapshot: SerializedEngineSnapshot): Buffer {
  return Buffer.from(JSON.stringify(snapshot), "utf8");
}
