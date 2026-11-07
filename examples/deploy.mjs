import {
  NetworkId, NAME_POLICY_V1_SCHEDULE, namePolicyContextForBlock,
  encodeDeploy,
} from '../packages/protocol/dist/index.js';

// Offline Signet example. These heights do not select a Mainnet release.
const namePolicy = namePolicyContextForBlock(NAME_POLICY_V1_SCHEDULE, 840000);
const payload = encodeDeploy({
  network: NetworkId.SIGNET,
  deployAuthInputIndex: 0,
  ownerOutputIndex: 1,
  name: 'DEMO',
  totalSupply: 1_000_000n * 100_000_000n,
}, namePolicy);

console.log(JSON.stringify({
  name: 'DEMO',
  supplyTokens: '1000000',
  supplyBaseUnits: '100000000000000',
  payloadBytes: payload.length,
  payloadHex: payload.toString('hex'),
}, null, 2));
