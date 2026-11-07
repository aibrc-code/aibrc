import {
  Buffer, NetworkId, NAME_POLICY_V1_SCHEDULE, namePolicyContextForBlock,
  classifyProtocolPayload,
} from '../packages/protocol/dist/index.js';

// Published six-recipient Signet vector. Pass another payload hex as argument 1.
const hex = process.argv[2] ??
  '414942520102020015000006000cd1400007010a0214031e04280532063c';
if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
  throw new TypeError('Pass a complete hexadecimal AIBRC payload.');
}

const result = classifyProtocolPayload(Buffer.from(hex, 'hex'), {
  expectedNetwork: NetworkId.SIGNET,
  namePolicy: namePolicyContextForBlock(NAME_POLICY_V1_SCHEDULE, 840000),
});
if (result.status !== 'VALID') throw new Error(result.reason);

// JSON cannot represent bigint directly; preserve amounts as decimal strings.
console.log(JSON.stringify(result.instruction,
  (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
