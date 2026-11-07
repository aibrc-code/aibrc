import { readFileSync } from 'node:fs';
import {
  createProtocolState, serializeCanonicalState, deriveStateHash,
} from '../packages/protocol/dist/index.js';

// Load a non-empty canonical state from the published offline chain vectors.
const { vectors } = JSON.parse(readFileSync(
  new URL('../vectors/chain-vectors.json', import.meta.url), 'utf8'));
const vector = vectors.find(item => item.id === 'chain-shallow-reorg');
const snapshot = vector.expected.canonicalFinalState;
const state = createProtocolState();

for (const asset of snapshot.assets) {
  state.assetsById.set(asset.assetId, {
    ...asset,
    totalSupply: BigInt(asset.totalSupply),
    locator: { blockHeight: asset.locator[0], txIndex: asset.locator[1] },
  });
}
state.assetIdByName = new Map(snapshot.names);
state.assetIdByLocator = new Map(snapshot.locators);
state.balances = new Map(snapshot.balances.map(([key, amount]) => [key, BigInt(amount)]));

const stateHash = deriveStateHash(state);
if (stateHash !== vector.expected.stateHash) throw new Error('State hash mismatch.');
console.log(JSON.stringify({
  vector: vector.id,
  assets: state.assetsById.size,
  balanceEntries: state.balances.size,
  canonicalBytes: serializeCanonicalState(state).length,
  stateHash,
  matchesPublishedVector: true,
}, null, 2));
