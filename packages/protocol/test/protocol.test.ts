import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  COMPAT_PAYLOAD_BYTES,
  MAX_U128,
  NAME_POLICY_V1_SCHEDULE,
  NetworkId,
  ProtocolError,
  activeNamePolicyVersion,
  applyDeploy as applyDeployWithPolicy,
  applyTransfer,
  classifyExtractedAibrcTransaction as classifyExtractedAibrcTransactionWithPolicy,
  classifyProtocolPayload as classifyProtocolPayloadWithPolicy,
  classifyPayloadProfile,
  classifyScriptPubKey,
  createProtocolState,
  decodeDeploy as decodeDeployWithPolicy,
  decodeDeployStructure,
  decodeTransfer,
  decodeTxidDisplayBytes,
  deriveAccountKey,
  deriveAssetId as deriveAssetIdWithPolicy,
  deriveStateHash,
  encodeDeploy as encodeDeployWithPolicy,
  encodeTransfer,
  extractAibrcPayloadsFromOutputs,
  serializeCanonicalState,
  namePolicyContextForBlock,
  validateCanonicalNameBytes,
  validateDeploy as validateDeployWithPolicy,
  validateTransfer,
  type TransactionContext,
  type NamePolicyContext,
  type ProtocolClassificationContext,
} from "../src/index.js";

const senderScript = `5120${"11".repeat(32)}`;
const receiverScript = `0014${"22".repeat(20)}`;
const v1NamePolicy = namePolicyContextForBlock(NAME_POLICY_V1_SCHEDULE, 840_000);

function encodeDeploy(input: Parameters<typeof encodeDeployWithPolicy>[0], namePolicy: NamePolicyContext = v1NamePolicy) {
  return encodeDeployWithPolicy(input, namePolicy);
}

function decodeDeploy(payload: Buffer, namePolicy: NamePolicyContext = v1NamePolicy) {
  return decodeDeployWithPolicy(payload, namePolicy);
}

function deriveAssetId(input: Parameters<typeof deriveAssetIdWithPolicy>[0], namePolicy: NamePolicyContext = v1NamePolicy) {
  return deriveAssetIdWithPolicy(input, namePolicy);
}

function validateDeploy(
  instruction: Parameters<typeof validateDeployWithPolicy>[0],
  tx: Parameters<typeof validateDeployWithPolicy>[1],
  state?: Parameters<typeof validateDeployWithPolicy>[2],
  namePolicy: NamePolicyContext = v1NamePolicy,
) {
  return validateDeployWithPolicy(instruction, tx, state, namePolicy);
}

function applyDeploy(
  instruction: Parameters<typeof applyDeployWithPolicy>[0],
  tx: Parameters<typeof applyDeployWithPolicy>[1],
  state: Parameters<typeof applyDeployWithPolicy>[2],
  namePolicy: NamePolicyContext = v1NamePolicy,
) {
  return applyDeployWithPolicy(instruction, tx, state, namePolicy);
}

function classifyProtocolPayload(payload: Buffer, context: ProtocolClassificationContext) {
  return classifyProtocolPayloadWithPolicy(payload, context ? { namePolicy: v1NamePolicy, ...context } : context);
}

function classifyExtractedAibrcTransaction(
  extraction: Parameters<typeof classifyExtractedAibrcTransactionWithPolicy>[0],
  context: ProtocolClassificationContext,
) {
  return classifyExtractedAibrcTransactionWithPolicy(extraction, context ? { namePolicy: v1NamePolicy, ...context } : context);
}

function canonicalOpReturnScript(payload: Buffer): string {
  if (payload.length <= 75) return Buffer.concat([Buffer.from([0x6a, payload.length]), payload]).toString("hex");
  if (payload.length <= 0xff) return Buffer.concat([Buffer.from([0x6a, 0x4c, payload.length]), payload]).toString("hex");
  const length = Buffer.alloc(2);
  length.writeUInt16LE(payload.length);
  return Buffer.concat([Buffer.from([0x6a, 0x4d]), length, payload]).toString("hex");
}

function classifyTrustedTestPayloads(payloads: readonly Buffer[], context: ProtocolClassificationContext) {
  return classifyExtractedAibrcTransaction(extractAibrcPayloadsFromOutputs(
    payloads.map((payload) => ({ scriptPubKeyHex: canonicalOpReturnScript(payload) })),
  ), context);
}

function readCompactSize(buffer: Buffer, cursor: { offset: number }): number {
  const prefix = buffer[cursor.offset++]!;
  if (prefix < 0xfd) return prefix;
  if (prefix === 0xfd) {
    const value = buffer.readUInt16LE(cursor.offset);
    cursor.offset += 2;
    return value;
  }
  throw new Error("Test fixture uses an unsupported CompactSize width.");
}

function decodeFixtureOutputs(rawHex: string): Array<{ scriptPubKeyHex: string; scriptType: "P2TR" | "P2WPKH" | "OP_RETURN" | "UNSUPPORTED"; valueSats: bigint }> {
  const buffer = Buffer.from(rawHex, "hex");
  const cursor = { offset: 4 };
  if (buffer[cursor.offset] === 0 && buffer[cursor.offset + 1] === 1) cursor.offset += 2;
  const inputCount = readCompactSize(buffer, cursor);
  for (let index = 0; index < inputCount; index += 1) {
    cursor.offset += 36;
    const scriptLength = readCompactSize(buffer, cursor);
    cursor.offset += scriptLength + 4;
  }
  const outputCount = readCompactSize(buffer, cursor);
  return Array.from({ length: outputCount }, () => {
    const valueSats = buffer.readBigUInt64LE(cursor.offset);
    cursor.offset += 8;
    const scriptLength = readCompactSize(buffer, cursor);
    const script = buffer.subarray(cursor.offset, cursor.offset + scriptLength);
    cursor.offset += scriptLength;
    const scriptPubKeyHex = script.toString("hex");
    const scriptType = script[0] === 0x6a
      ? "OP_RETURN"
      : script.length === 34 && script[0] === 0x51 && script[1] === 0x20
        ? "P2TR"
        : script.length === 22 && script[0] === 0x00 && script[1] === 0x14
          ? "P2WPKH"
          : "UNSUPPORTED";
    return { scriptPubKeyHex, scriptType, valueSats };
  });
}

function extractOpReturnPayload(scriptHex: string): Buffer {
  const script = Buffer.from(scriptHex, "hex");
  assert.equal(script[0], 0x6a);
  if (script[1]! <= 75) return script.subarray(2, 2 + script[1]!);
  if (script[1] === 0x4c) return script.subarray(3, 3 + script[2]!);
  throw new Error("Unexpected OP_RETURN push form in fixture.");
}

type SerializedProtocolState = {
  assetsById: Array<[string, { assetId: string; name: string; network: NetworkId; totalSupply: string; deployTxid: string; ownerOutputIndex: number; locator: { blockHeight: number; txIndex: number } }]>;
  assetIdByName: Array<[string, string]>;
  assetIdByLocator: Array<[string, string]>;
  balances: Array<[string, string]>;
};

function deserializeProtocolState(serialized: SerializedProtocolState) {
  const state = createProtocolState();
  for (const [id, asset] of serialized.assetsById) state.assetsById.set(id, { ...asset, totalSupply: BigInt(asset.totalSupply) });
  state.assetIdByName = new Map(serialized.assetIdByName);
  state.assetIdByLocator = new Map(serialized.assetIdByLocator);
  state.balances = new Map(serialized.balances.map(([key, value]) => [key, BigInt(value)]));
  return state;
}

function serializeProtocolState(state: ReturnType<typeof createProtocolState>): SerializedProtocolState {
  return {
    assetsById: [...state.assetsById.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([id, asset]) => [id, { ...asset, totalSupply: asset.totalSupply.toString() }]),
    assetIdByName: [...state.assetIdByName.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0),
    assetIdByLocator: [...state.assetIdByLocator.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0),
    balances: [...state.balances.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, value]) => [key, value.toString()]),
  };
}

function deserializeTransactionContext(serialized: Record<string, unknown>): TransactionContext {
  const value = serialized as unknown as Omit<TransactionContext, "outputs"> & { outputs: Array<Omit<TransactionContext["outputs"][number], "valueSats"> & { valueSats: string }> };
  return { ...value, outputs: value.outputs.map((output) => ({ ...output, valueSats: BigInt(output.valueSats) })) };
}

function deployTx(overrides: Partial<TransactionContext> = {}): TransactionContext {
  return {
    txid: "aa".repeat(32),
    blockHeight: 250,
    txIndex: 3,
    inputs: [{ prevoutScriptPubKeyHex: senderScript, scriptType: "P2TR", sighashType: 0x00 }],
    outputs: [{ scriptPubKeyHex: receiverScript, scriptType: "P2WPKH", valueSats: 330n }],
    ...overrides,
  };
}

function rawDeployWithName(nameBytes: Buffer, declaredNameLength = nameBytes.length): Buffer {
  const prefix = Buffer.alloc(5);
  prefix.writeUInt16BE(0, 0);
  prefix.writeUInt16BE(0, 2);
  prefix.writeUInt8(declaredNameLength, 4);
  const supply = Buffer.alloc(16);
  supply[15] = 1;
  const body = Buffer.concat([prefix, nameBytes, supply]);
  const header = Buffer.from("414942520102010000", "hex");
  header.writeUInt16BE(body.length, 7);
  return Buffer.concat([header, body]);
}

test("Deploy has a deterministic binary representation and round-trips", () => {
  const payload = encodeDeploy({
    network: NetworkId.SIGNET,
    deployAuthInputIndex: 0,
    ownerOutputIndex: 0,
    name: "PANDA",
    totalSupply: 100_000_000n,
  });
  assert.equal(
    payload.toString("hex"),
    "41494252010201001a000000000550414e444100000000000000000000000005f5e100",
  );
  assert.deepEqual(decodeDeploy(payload), {
    kind: "DEPLOY",
    version: 1,
    network: NetworkId.SIGNET,
    deployAuthInputIndex: 0,
    ownerOutputIndex: 0,
    name: "PANDA",
    canonicalNameBytes: Buffer.from("PANDA", "utf8"),
    totalSupply: 100_000_000n,
  });
});

test("Deploy validates original name bytes before string conversion", () => {
  for (const [label, payload] of [
    ["high-bit-C1", rawDeployWithName(Buffer.from([0xc1]))],
    ["masked-PA", rawDeployWithName(Buffer.from([0xd0, 0xc1]))],
    ["zero-length", rawDeployWithName(Buffer.alloc(0), 0)],
    ["length-17", rawDeployWithName(Buffer.alloc(17, 0x41), 17)],
    ["length-255", rawDeployWithName(Buffer.alloc(255, 0x41), 255)],
    ["unicode-utf8", rawDeployWithName(Buffer.from("中", "utf8"))],
    ["lowercase", rawDeployWithName(Buffer.from("a", "utf8"))],
    ["whitespace", rawDeployWithName(Buffer.from(" ", "utf8"))],
  ] as const) {
    assert.deepEqual(classifyProtocolPayload(payload, { expectedNetwork: NetworkId.SIGNET }), { status: "NO_OP", reason: "INVALID_NAME" }, label);
    assert.throws(() => decodeDeploy(payload), (error) => error instanceof ProtocolError && error.reason === "INVALID_NAME", label);
  }

  for (const name of ["_", "________________", "A", "A0_Z"]) {
    const decoded = decodeDeploy(encodeDeploy({
      network: NetworkId.SIGNET,
      deployAuthInputIndex: 0,
      ownerOutputIndex: 0,
      name,
      totalSupply: 1n,
    }));
    assert.equal(decoded.name, name);
    assert.equal(decoded.canonicalNameBytes.toString("hex"), Buffer.from(name, "utf8").toString("hex"));
  }
});

test("High-bit name bytes cannot alias a canonical Asset ID", () => {
  const canonical = deriveAssetId({
    network: NetworkId.SIGNET,
    deployTxid: "12".repeat(32),
    ownerOutputIndex: 0,
    canonicalNameBytes: Buffer.from([0x41]),
  });
  assert.match(canonical, /^[0-9a-f]{64}$/);
  assert.throws(() => deriveAssetId({
    network: NetworkId.SIGNET,
    deployTxid: "12".repeat(32),
    ownerOutputIndex: 0,
    canonicalNameBytes: Buffer.from([0xc1]),
  }), (error) => error instanceof ProtocolError && error.reason === "INVALID_NAME");
});

test("Envelope classification follows magic, base length, network, version, opcode, then body", () => {
  const valid = encodeDeploy({
    network: NetworkId.SIGNET,
    deployAuthInputIndex: 0,
    ownerOutputIndex: 0,
    name: "ORDER",
    totalSupply: 1n,
  });
  const combined = Buffer.from(valid);
  combined[5] = 0xff;
  combined[4] = 2;
  combined[6] = 0x7f;
  combined.writeUInt16BE(0xffff, 7);
  assert.deepEqual(classifyProtocolPayload(combined, { expectedNetwork: NetworkId.SIGNET, activatedVersions: new Set([1, 2]) }), { status: "NO_OP", reason: "UNKNOWN_NETWORK" });

  const unknownVersion = Buffer.from(valid);
  unknownVersion[4] = 2;
  unknownVersion[6] = 0x7f;
  unknownVersion.writeUInt16BE(0xffff, 7);
  assert.deepEqual(classifyProtocolPayload(unknownVersion, { expectedNetwork: NetworkId.SIGNET, activatedVersions: new Set([1, 2]) }), { status: "NEEDS_UPGRADE", reason: "UNKNOWN_VERSION" });

  const unknownOpcode = Buffer.from(valid);
  unknownOpcode[6] = 0x7f;
  unknownOpcode.writeUInt16BE(0xffff, 7);
  assert.deepEqual(classifyProtocolPayload(unknownOpcode, { expectedNetwork: NetworkId.SIGNET }), { status: "NO_OP", reason: "UNKNOWN_OPCODE" });

  const badBody = Buffer.from(valid);
  badBody.writeUInt16BE(0xffff, 7);
  assert.deepEqual(classifyProtocolPayload(badBody, { expectedNetwork: NetworkId.SIGNET }), { status: "NO_OP", reason: "LENGTH_MISMATCH" });
});

test("Name Policy context selects V1 before and V2 at the manifest activation height", () => {
  const schedule = { manifestNamePolicyVersion: 2 as const, activationHeight: 900_000 };
  const before = namePolicyContextForBlock(schedule, 899_999);
  const at = namePolicyContextForBlock(schedule, 900_000);
  const after = namePolicyContextForBlock(schedule, 900_001);
  assert.equal(activeNamePolicyVersion(before), 1);
  assert.equal(activeNamePolicyVersion(at), 2);
  assert.equal(activeNamePolicyVersion(after), 2);

  const hanPayload = rawDeployWithName(Buffer.from("中", "utf8"));
  assert.deepEqual(decodeDeployStructure(hanPayload).canonicalNameBytes, Buffer.from("中", "utf8"));
  assert.throws(() => decodeDeploy(hanPayload, before), (error) => error instanceof ProtocolError && error.reason === "INVALID_NAME");
  assert.equal(decodeDeploy(hanPayload, at).name, "中");
  assert.equal(decodeDeploy(hanPayload, after).name, "中");
});

test("Name Policy V2 validates exact bytes and never decodes rejected UTF-8 for display", () => {
  const context = namePolicyContextForBlock({ manifestNamePolicyVersion: 2, activationHeight: 10 }, 10);
  for (const name of ["AIBRC", "2026_A", "中", "中国名字汉", "가", "가나다라마", "A中", "A가", "A中国名字汉"]) {
    assert.doesNotThrow(() => validateCanonicalNameBytes(Buffer.from(name, "utf8"), context), name);
  }
  for (const [label, bytes] of [
    ["lowercase", Buffer.from("a")],
    ["two-byte", Buffer.from("é")],
    ["four-byte", Buffer.from("😀")],
    ["isolated continuation", Buffer.from([0x80])],
    ["truncated", Buffer.from([0xe4, 0xb8])],
    ["overlong", Buffer.from([0xe0, 0x81, 0x81])],
    ["surrogate", Buffer.from([0xed, 0xa0, 0x80])],
    ["compatibility ideograph", Buffer.from("豈")],
    ["Hangul Jamo", Buffer.from("ᄀ")],
    ["variation selector", Buffer.from("中\uFE0F")],
    ["seventeen bytes", Buffer.alloc(17, 0x41)],
  ] as const) {
    assert.throws(() => validateCanonicalNameBytes(bytes, context), (error) => error instanceof ProtocolError && error.reason === "INVALID_NAME", label);
  }
});

test("canonical duplicate lookup is equivalent for V1 ASCII and V2 CJK names", () => {
  const v2NamePolicy = namePolicyContextForBlock(
    { manifestNamePolicyVersion: 2, activationHeight: 10 },
    10,
  );
  for (const [name, distinctName, namePolicy] of [
    ["PANDA", "PANDAS", v1NamePolicy],
    ["AIBRC", "AIBRC2", v2NamePolicy],
    ["中国", "中华", v2NamePolicy],
  ] as const) {
    const instruction = decodeDeploy(encodeDeploy({
      network: NetworkId.SIGNET,
      deployAuthInputIndex: 0,
      ownerOutputIndex: 0,
      name,
      totalSupply: 1n,
    }, namePolicy), namePolicy);
    assert.equal(instruction.name, instruction.canonicalNameBytes.toString("utf8"));

    const duplicate = createProtocolState();
    duplicate.assetIdByName.set(name, "existing-asset");
    assert.equal(
      validateDeploy(instruction, deployTx(), duplicate, namePolicy),
      "DUPLICATE_NAME",
      `${name}: exact canonical key`,
    );

    const distinct = createProtocolState();
    distinct.assetIdByName.set(distinctName, "other-asset");
    assert.equal(
      validateDeploy(instruction, deployTx(), distinct, namePolicy),
      "VALID",
      `${name}: distinct canonical key`,
    );
  }

  const cjk = decodeDeploy(encodeDeploy({
    network: NetworkId.SIGNET,
    deployAuthInputIndex: 0,
    ownerOutputIndex: 0,
    name: "中国",
    totalSupply: 1n,
  }, v2NamePolicy), v2NamePolicy);
  assert.equal(validateDeploy(cjk, deployTx(), createProtocolState(), v1NamePolicy), "INVALID_NAME");
  assert.equal(
    validateDeploy({ ...cjk, name: "中华" }, deployTx(), createProtocolState(), v2NamePolicy),
    "INVALID_NAME",
    "a display string cannot diverge from its canonical bytes",
  );
});

test("Deploy consensus APIs fail closed without an explicit Name Policy context", () => {
  const payload = encodeDeploy({
    network: NetworkId.SIGNET,
    deployAuthInputIndex: 0,
    ownerOutputIndex: 0,
    name: "CONTEXT",
    totalSupply: 1n,
  });
  assert.throws(() => decodeDeployWithPolicy(payload, undefined as never), (error) => error instanceof ProtocolError && error.reason === "NAME_POLICY_CONTEXT_REQUIRED");
  assert.deepEqual(classifyProtocolPayloadWithPolicy(payload, { expectedNetwork: NetworkId.SIGNET }), {
    status: "NO_OP",
    reason: "NAME_POLICY_CONTEXT_REQUIRED",
  });
});

test("Allowed BMP string ordering equals UTF-8 byte ordering and preserves ASCII ordering", () => {
  const allowed = [
    ..."0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_",
    ...Array.from({ length: 0x9fff - 0x4e00 + 1 }, (_, offset) => String.fromCharCode(0x4e00 + offset)),
    ...Array.from({ length: 0xd7a3 - 0xac00 + 1 }, (_, offset) => String.fromCharCode(0xac00 + offset)),
  ];
  assert.ok(allowed.every((name) => name.length === 1 && name.codePointAt(0)! <= 0xffff));
  const stringSorted = [...allowed].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  const byteSorted = [...allowed].sort((left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")));
  assert.deepEqual(byteSorted, stringSorted);
  assert.deepEqual(["_", "Z", "A", "0"].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right))), ["0", "A", "Z", "_"]);
});

test("PROTO-01 duplicate and PROTO-02 network precedence compose deterministically", () => {
  const signet = encodeDeploy({
    network: NetworkId.SIGNET,
    deployAuthInputIndex: 0,
    ownerOutputIndex: 1,
    name: "PRIORITY",
    totalSupply: 1n,
  });
  const future = Buffer.from(signet);
  future[4] = 2;
  const foreignFuture = Buffer.from(future);
  foreignFuture[5] = NetworkId.MAINNET;
  const foreignMalformedBody = Buffer.from(signet.subarray(0, 12));
  foreignMalformedBody[5] = NetworkId.MAINNET;
  foreignMalformedBody.writeUInt16BE(0xffff, 7);
  const push = (payload: Buffer) => Buffer.concat([Buffer.from([0x6a, payload.length]), payload]).toString("hex");

  const duplicate = classifyExtractedAibrcTransaction(extractAibrcPayloadsFromOutputs([
    { scriptPubKeyHex: push(future) },
    { scriptPubKeyHex: push(signet) },
  ]), { expectedNetwork: NetworkId.SIGNET, activatedVersions: new Set([1, 2]) });
  assert.deepEqual(
    { status: duplicate.status, reason: duplicate.reason, recognized: duplicate.recognizedMarkerCount },
    { status: "NO_OP", reason: "DUPLICATE_STATE_INSTRUCTION", recognized: 2 },
  );
  assert.deepEqual(classifyProtocolPayload(foreignFuture, {
    expectedNetwork: NetworkId.SIGNET,
    activatedVersions: new Set([1, 2]),
  }), { status: "NO_OP", reason: "UNKNOWN_NETWORK" });
  assert.deepEqual(classifyProtocolPayload(foreignMalformedBody, {
    expectedNetwork: NetworkId.SIGNET,
    activatedVersions: new Set([1, 2]),
  }), { status: "NO_OP", reason: "UNKNOWN_NETWORK" });
  assert.throws(() => classifyProtocolPayload(signet, undefined as never), /EXPECTED_NETWORK_REQUIRED/);
});

test("Transfer round-trips custom allocations", () => {
  const payload = encodeTransfer({
    network: NetworkId.SIGNET,
    authInputIndex: 1,
    assetLocator: { blockHeight: 250, txIndex: 3 },
    allocations: [
      { receiverOutputIndex: 0, amount: 100n },
      { receiverOutputIndex: 2, amount: 250n },
    ],
  });
  assert.deepEqual(decodeTransfer(payload).allocations, [
    { receiverOutputIndex: 0, amount: 100n },
    { receiverOutputIndex: 2, amount: 250n },
  ]);
});

test("Six custom recipients fit the 80-byte Compatibility Profile", () => {
  const payload = encodeTransfer({
    network: NetworkId.SIGNET,
    authInputIndex: 0,
    assetLocator: { blockHeight: 840_000, txIndex: 7 },
    allocations: [10n, 20n, 30n, 40n, 50n, 60n].map((amount, index) => ({
      receiverOutputIndex: index + 1,
      amount,
    })),
  });
  assert.equal(payload.length, 30);
  assert.ok(payload.length <= COMPAT_PAYLOAD_BYTES);
  assert.equal(classifyPayloadProfile(payload), "COMPATIBILITY");
  assert.deepEqual(decodeTransfer(payload).allocations.map((allocation) => allocation.amount), [10n, 20n, 30n, 40n, 50n, 60n]);
});

test("Six-recipient raw Bitcoin fixture decodes, validates, applies, and credits outputs 1 through 6", () => {
  const fixtureDocument = JSON.parse(readFileSync(new URL("../../../vectors/bitcoin-transaction-fixtures.json", import.meta.url), "utf8")) as {
    fixtures: Array<{ id: string; rawTransactionHex: string }>;
  };
  const fixture = fixtureDocument.fixtures.find((item) => item.id === "transfer-six-receiver-custom-batch");
  assert.ok(fixture);
  const outputs = decodeFixtureOutputs(fixture.rawTransactionHex);
  assert.equal(outputs[0]!.scriptType, "OP_RETURN");
  const transfer = decodeTransfer(extractOpReturnPayload(outputs[0]!.scriptPubKeyHex));
  assert.deepEqual(transfer.allocations.map((allocation) => allocation.receiverOutputIndex), [1, 2, 3, 4, 5, 6]);

  const state = createProtocolState();
  const deploy = decodeDeploy(encodeDeploy({
    network: NetworkId.SIGNET,
    deployAuthInputIndex: 0,
    ownerOutputIndex: 0,
    name: "PANDA",
    totalSupply: 1_000n,
  }));
  assert.equal(applyDeploy(deploy, {
    txid: "a1".repeat(32),
    blockHeight: 840_000,
    txIndex: 7,
    inputs: [{ prevoutScriptPubKeyHex: senderScript, scriptType: "P2TR", sighashType: 0x00 }],
    outputs: [{ scriptPubKeyHex: senderScript, scriptType: "P2TR", valueSats: 330n }],
  }, state).status, "APPLIED");
  assert.equal(applyTransfer(transfer, {
    txid: "f1".repeat(32),
    blockHeight: 840_001,
    txIndex: 0,
    inputs: [{ prevoutScriptPubKeyHex: senderScript, scriptType: "P2TR", sighashType: 0x00 }],
    outputs,
  }, state).status, "APPLIED");
  const assetId = [...state.assetsById.keys()][0]!;
  for (let index = 1; index <= 6; index += 1) {
    assert.equal(state.balances.get(`${assetId}:${deriveAccountKey(outputs[index]!.scriptPubKeyHex)}`), BigInt(index * 10));
  }
  assert.equal(state.balances.get(`${assetId}:${deriveAccountKey(senderScript)}`), 790n);
});

test("Transfer variable integers are shortest-form and payload hard limits remain fail-closed", () => {
  const canonical = encodeTransfer({
    network: NetworkId.SIGNET,
    authInputIndex: 0,
    assetLocator: { blockHeight: 1, txIndex: 0 },
    allocations: [{ receiverOutputIndex: 0, amount: 100n }],
  });
  const nonCanonical = Buffer.concat([canonical.subarray(0, -1), Buffer.from([0xe4, 0x00])]);
  nonCanonical.writeUInt16BE(nonCanonical.length - 9, 7);
  assert.deepEqual(classifyProtocolPayload(nonCanonical, { expectedNetwork: NetworkId.SIGNET }), { status: "NO_OP", reason: "NON_CANONICAL_INTEGER" });

  assert.throws(() => encodeTransfer({
    network: NetworkId.SIGNET,
    authInputIndex: 0,
    assetLocator: { blockHeight: 1, txIndex: 0 },
    allocations: Array.from({ length: 25 }, (_, receiverOutputIndex) => ({ receiverOutputIndex, amount: MAX_U128 })),
  }), (error) => error instanceof ProtocolError && error.reason === "PAYLOAD_TOO_LARGE");
});

test("Receiver output index field overflow has its own stable reason code", () => {
  assert.throws(() => encodeTransfer({
    network: NetworkId.SIGNET,
    authInputIndex: 0,
    assetLocator: { blockHeight: 1, txIndex: 0 },
    allocations: [{ receiverOutputIndex: 65_536, amount: 1n }],
  }), (error) => error instanceof ProtocolError && error.reason === "RECEIVER_OUTPUT_INDEX_OUT_OF_RANGE");

  const canonical = encodeTransfer({
    network: NetworkId.SIGNET,
    authInputIndex: 0,
    assetLocator: { blockHeight: 1, txIndex: 0 },
    allocations: [{ receiverOutputIndex: 0, amount: 1n }],
  });
  const overflow = Buffer.concat([canonical.subarray(0, 18), Buffer.from([0x80, 0x80, 0x04]), canonical.subarray(19)]);
  overflow.writeUInt16BE(overflow.length - 9, 7);
  assert.deepEqual(classifyProtocolPayload(overflow, { expectedNetwork: NetworkId.SIGNET }), {
    status: "NO_OP",
    reason: "RECEIVER_OUTPUT_INDEX_OUT_OF_RANGE",
  });

  const overlongReceiverVarint = Buffer.concat([
    canonical.subarray(0, 18),
    Buffer.alloc(20, 0x80),
    Buffer.from([0x00]),
    canonical.subarray(19),
  ]);
  overlongReceiverVarint.writeUInt16BE(overlongReceiverVarint.length - 9, 7);
  assert.deepEqual(classifyProtocolPayload(overlongReceiverVarint, { expectedNetwork: NetworkId.SIGNET }), {
    status: "NO_OP",
    reason: "RECEIVER_OUTPUT_INDEX_OUT_OF_RANGE",
  });
});

test("Broadcast profile byte boundaries are exact at 80, 81, 480, and 481", () => {
  assert.equal(classifyPayloadProfile(Buffer.alloc(80)), "COMPATIBILITY");
  assert.equal(classifyPayloadProfile(Buffer.alloc(81)), "EXTENDED");
  assert.equal(classifyPayloadProfile(Buffer.alloc(480)), "EXTENDED");
  assert.throws(
    () => classifyPayloadProfile(Buffer.alloc(481)),
    (error) => error instanceof ProtocolError && error.reason === "PAYLOAD_TOO_LARGE",
  );
});

test("Unsigned LEB128 boundaries round-trip canonically through u16 and u128 maxima", () => {
  const amounts = [127n, 128n, 16_383n, 16_384n, 65_535n, 65_536n, 1n << 127n, MAX_U128];
  const outputIndexes = [0, 127, 128, 16_383, 16_384, 65_535, 1, 2];
  const payload = encodeTransfer({
    network: NetworkId.SIGNET,
    authInputIndex: 0,
    assetLocator: { blockHeight: 1, txIndex: 0 },
    allocations: amounts.map((amount, index) => ({ amount, receiverOutputIndex: outputIndexes[index]! })),
  });
  const decoded = decodeTransfer(payload);
  assert.deepEqual(decoded.allocations.map((allocation) => allocation.amount), amounts);
  assert.deepEqual(decoded.allocations.map((allocation) => allocation.receiverOutputIndex), outputIndexes);
  assert.equal(encodeTransfer(decoded).toString("hex"), payload.toString("hex"));
});

test("Asymmetric txid bytes are never reversed by AIBRC encoding or Asset ID derivation", () => {
  const rpcTxid = "00112233445566778899aabbccddeeff102132435465768798a9bacbdcedfe0f";
  assert.equal(decodeTxidDisplayBytes(rpcTxid).toString("hex"), rpcTxid);
  assert.equal(
    Buffer.from(decodeTxidDisplayBytes(rpcTxid)).reverse().toString("hex"),
    "0ffeeddccbbaa9988776655443322110ffeeddccbbaa99887766554433221100",
  );
  assert.equal(deriveAssetId({
    network: NetworkId.SIGNET,
    deployTxid: rpcTxid,
    ownerOutputIndex: 1,
    canonicalNameBytes: Buffer.from("BYTEORDER", "utf8"),
  }), "8f58e7c1f07c21f518f75544de6bc496e27290dc5b06544d6f2fe23e7ae729b9");
});

test("Deploy and repeated-receiver Transfer conserve supply", () => {
  const state = createProtocolState();
  const deploy = decodeDeploy(
    encodeDeploy({
      network: NetworkId.SIGNET,
      deployAuthInputIndex: 0,
      ownerOutputIndex: 0,
      name: "PANDA",
      totalSupply: 1_000n,
    }),
  );
  assert.equal(applyDeploy(deploy, deployTx(), state).status, "APPLIED");

  const transfer = decodeTransfer(
    encodeTransfer({
      network: NetworkId.SIGNET,
      authInputIndex: 0,
      assetLocator: { blockHeight: 250, txIndex: 3 },
      allocations: [
        { receiverOutputIndex: 0, amount: 100n },
        { receiverOutputIndex: 0, amount: 250n },
      ],
    }),
  );
  const tx: TransactionContext = {
    txid: "bb".repeat(32),
    blockHeight: 251,
    txIndex: 0,
    inputs: [{ prevoutScriptPubKeyHex: receiverScript, scriptType: "P2WPKH", sighashType: 0x01 }],
    outputs: [{ scriptPubKeyHex: senderScript, scriptType: "P2TR", valueSats: 330n }],
  };
  assert.equal(applyTransfer(transfer, tx, state).status, "APPLIED");
  const assetId = [...state.assetsById.keys()][0]!;
  assert.equal(state.balances.get(`${assetId}:${deriveAccountKey(receiverScript)}`), 650n);
  assert.equal(state.balances.get(`${assetId}:${deriveAccountKey(senderScript)}`), 350n);
});

test("Canonical balances delete zero entries and State Hash excludes zero balances", () => {
  const state = createProtocolState();
  const deploy = decodeDeploy(encodeDeploy({
    network: NetworkId.SIGNET,
    deployAuthInputIndex: 0,
    ownerOutputIndex: 0,
    name: "ZEROLESS",
    totalSupply: 100n,
  }));
  applyDeploy(deploy, deployTx(), state);
  const assetId = [...state.assetsById.keys()][0]!;
  const senderKey = `${assetId}:${deriveAccountKey(receiverScript)}`;
  const transfer = decodeTransfer(encodeTransfer({
    network: NetworkId.SIGNET,
    authInputIndex: 0,
    assetLocator: { blockHeight: 250, txIndex: 3 },
    allocations: [
      { receiverOutputIndex: 0, amount: 60n },
      { receiverOutputIndex: 1, amount: 40n },
    ],
  }));
  const tx: TransactionContext = {
    txid: "19".repeat(32),
    blockHeight: 251,
    txIndex: 0,
    inputs: [{ prevoutScriptPubKeyHex: receiverScript, scriptType: "UNSUPPORTED", sighashType: 0x01 }],
    outputs: [
      { scriptPubKeyHex: senderScript, scriptType: "UNSUPPORTED", valueSats: 330n },
      { scriptPubKeyHex: `0014${"55".repeat(20)}`, scriptType: "UNSUPPORTED", valueSats: 330n },
    ],
  };
  assert.equal(applyTransfer(transfer, tx, state).status, "APPLIED");
  assert.equal(state.balances.has(senderKey), false);
  assert.equal(state.balances.get(senderKey) ?? 0n, 0n);

  const cleanHash = deriveStateHash(state);
  const cleanBytes = serializeCanonicalState(state);
  state.balances.set(senderKey, 0n);
  assert.equal(deriveStateHash(state), cleanHash);
  assert.deepEqual(serializeCanonicalState(state), cleanBytes);
  const serialized = JSON.parse(cleanBytes.toString("utf8")) as { balances: Array<[string, string]> };
  assert.ok(serialized.balances.every(([, balance]) => balance !== "0"));
  state.balances.delete(senderKey);
  assert.equal(deriveStateHash(state), cleanHash);

  const reordered = {
    assetsById: new Map([...state.assetsById].reverse()),
    assetIdByName: new Map([...state.assetIdByName].reverse()),
    assetIdByLocator: new Map([...state.assetIdByLocator].reverse()),
    balances: new Map([...state.balances].reverse()),
  };
  assert.equal(deriveStateHash(reordered), cleanHash);
});

test("An invalid allocation is an atomic no-op", () => {
  const state = createProtocolState();
  const deploy = decodeDeploy(
    encodeDeploy({ network: NetworkId.SIGNET, deployAuthInputIndex: 0, ownerOutputIndex: 0, name: "ATOM", totalSupply: 10n }),
  );
  applyDeploy(deploy, deployTx(), state);
  const before = [...state.balances.entries()];
  const transfer = {
    ...decodeTransfer(
      encodeTransfer({
        network: NetworkId.SIGNET,
        authInputIndex: 0,
        assetLocator: { blockHeight: 250, txIndex: 3 },
        allocations: [{ receiverOutputIndex: 0, amount: 1n }],
      }),
    ),
    allocations: [
      { receiverOutputIndex: 0, amount: 1n },
      { receiverOutputIndex: 99, amount: 1n },
    ],
  };
  const result = applyTransfer(transfer, {
    txid: "cc".repeat(32),
    blockHeight: 251,
    txIndex: 0,
    inputs: [{ prevoutScriptPubKeyHex: receiverScript, scriptType: "P2WPKH", sighashType: 0x01 }],
    outputs: [{ scriptPubKeyHex: senderScript, scriptType: "P2TR", valueSats: 330n }],
  }, state);
  assert.deepEqual(result, { status: "NO_OP", reason: "INVALID_RECEIVER_OUTPUT" });
  assert.deepEqual([...state.balances.entries()], before);
});

test("Hand-constructed negative values and malformed script hex fail closed", () => {
  const state = createProtocolState();
  const deploy = decodeDeploy(
    encodeDeploy({ network: NetworkId.SIGNET, deployAuthInputIndex: 0, ownerOutputIndex: 0, name: "BOUND", totalSupply: 10n }),
  );
  assert.deepEqual(applyDeploy({ ...deploy, totalSupply: -1n }, deployTx(), state), {
    status: "NO_OP",
    reason: "ZERO_SUPPLY",
  });
  assert.equal(state.assetsById.size, 0);
  assert.deepEqual(applyDeploy(deploy, deployTx({
    outputs: [{ scriptPubKeyHex: "zz", scriptType: "P2WPKH", valueSats: 330n }],
  }), state), {
    status: "NO_OP",
    reason: "UNSUPPORTED_SCRIPT",
  });
  assert.equal(state.assetsById.size, 0);

  applyDeploy(deploy, deployTx(), state);
  const balancesBefore = [...state.balances.entries()];
  const transfer = decodeTransfer(encodeTransfer({
    network: NetworkId.SIGNET,
    authInputIndex: 0,
    assetLocator: { blockHeight: 250, txIndex: 3 },
    allocations: [{ receiverOutputIndex: 0, amount: 1n }],
  }));
  const result = applyTransfer({ ...transfer, allocations: [{ receiverOutputIndex: 0, amount: -1n }] }, {
    txid: "dd".repeat(32),
    blockHeight: 251,
    txIndex: 0,
    inputs: [{ prevoutScriptPubKeyHex: receiverScript, scriptType: "P2WPKH", sighashType: 0x01 }],
    outputs: [{ scriptPubKeyHex: senderScript, scriptType: "P2TR", valueSats: 330n }],
  }, state);
  assert.deepEqual(result, { status: "NO_OP", reason: "ZERO_AMOUNT" });
  assert.deepEqual([...state.balances.entries()], balancesBefore);
});

test("P2SH-P2WPKH remains unsupported and caller metadata cannot enable it", () => {
  const instruction = decodeDeploy(encodeDeploy({
    network: NetworkId.SIGNET,
    deployAuthInputIndex: 0,
    ownerOutputIndex: 0,
    name: "P2SHGATE",
    totalSupply: 100n,
  }));
  const p2shScript = `a914${"44".repeat(20)}87`;
  const context: TransactionContext = {
    txid: "ee".repeat(32),
    blockHeight: 500,
    txIndex: 0,
    inputs: [{ prevoutScriptPubKeyHex: p2shScript, scriptType: "P2SH_P2WPKH", sighashType: 0x01 }],
    outputs: [{ scriptPubKeyHex: p2shScript, scriptType: "P2SH_P2WPKH", valueSats: 546n }],
  };
  assert.deepEqual(applyDeploy(instruction, context, createProtocolState()), {
    status: "NO_OP",
    reason: "UNSUPPORTED_SCRIPT",
  });
  assert.deepEqual(applyDeploy(instruction, {
    ...context,
    inputs: [{ ...context.inputs[0]!, scriptType: "P2TR" }],
    outputs: [{ ...context.outputs[0]!, scriptType: "P2TR" }],
  }, createProtocolState()), { status: "NO_OP", reason: "UNSUPPORTED_SCRIPT" });
});

test("scriptPubKey classification is deterministic and ignores caller scriptType metadata", () => {
  assert.equal(classifyScriptPubKey(senderScript), "P2TR");
  assert.equal(classifyScriptPubKey(receiverScript), "P2WPKH");
  assert.equal(classifyScriptPubKey(`a914${"44".repeat(20)}87`), "UNSUPPORTED");
  assert.equal(classifyScriptPubKey(`5120${"11".repeat(31)}`), "UNSUPPORTED");
  assert.equal(classifyScriptPubKey(`0014${"22".repeat(19)}`), "UNSUPPORTED");
  assert.equal(classifyScriptPubKey("6a"), "UNSUPPORTED");
  assert.equal(classifyScriptPubKey("zz"), "UNSUPPORTED");

  const instruction = decodeDeploy(encodeDeploy({
    network: NetworkId.SIGNET,
    deployAuthInputIndex: 0,
    ownerOutputIndex: 0,
    name: "SCRIPTS",
    totalSupply: 1n,
  }));
  assert.equal(validateDeploy(instruction, deployTx({
    inputs: [{ prevoutScriptPubKeyHex: senderScript, scriptType: "UNSUPPORTED", sighashType: 0x00 }],
    outputs: [{ scriptPubKeyHex: receiverScript, scriptType: "UNSUPPORTED", valueSats: 330n }],
  })), "VALID");
  assert.equal(validateDeploy(instruction, deployTx({
    inputs: [{ prevoutScriptPubKeyHex: "76", scriptType: "P2TR", sighashType: 0x00 }],
  })), "UNSUPPORTED_SCRIPT");
  assert.equal(validateDeploy(instruction, deployTx({
    outputs: [{ scriptPubKeyHex: "76", scriptType: "P2TR", valueSats: 330n }],
  })), "UNSUPPORTED_SCRIPT");
});

test("Unsafe sighash, u128 overflow, duplicate marker, and activated unknown version fail closed", () => {
  const state = createProtocolState();
  const deployPayload = encodeDeploy({
    network: NetworkId.SIGNET,
    deployAuthInputIndex: 0,
    ownerOutputIndex: 0,
    name: "SAFE",
    totalSupply: MAX_U128,
  });
  const unsafe = applyDeploy(decodeDeploy(deployPayload), deployTx({
    inputs: [{ prevoutScriptPubKeyHex: senderScript, scriptType: "P2TR", sighashType: 0x81 }],
  }), state);
  assert.equal(unsafe.reason, "UNSUPPORTED_SIGHASH");
  assert.equal(classifyTrustedTestPayloads([deployPayload, deployPayload], { expectedNetwork: NetworkId.SIGNET }).reason, "DUPLICATE_STATE_INSTRUCTION");
  const unknown = Buffer.from(deployPayload);
  unknown[4] = 2;
  assert.deepEqual(classifyProtocolPayload(unknown, { expectedNetwork: NetworkId.SIGNET, activatedVersions: new Set([1, 2]) }), {
    status: "NEEDS_UPGRADE",
    reason: "UNKNOWN_VERSION",
  });
  assert.throws(
    () => encodeTransfer({
      network: NetworkId.SIGNET,
      authInputIndex: 0,
      assetLocator: { blockHeight: 1, txIndex: 0 },
      allocations: [{ receiverOutputIndex: 0, amount: MAX_U128 + 1n }],
    }),
    (error) => error instanceof ProtocolError && error.reason === "U128_OVERFLOW",
  );
});

test("Official vector file has the ruled minimum coverage", () => {
  const vectors = JSON.parse(readFileSync(new URL("../../../vectors/operation-vectors.json", import.meta.url), "utf8")) as {
    vectors: Array<{
      id: string;
      category: string;
      rawPayloadHex: string;
      rawNameBytesHex?: string;
      codePoint?: string;
      namePolicyVersion?: number;
      blockHeight?: number;
      expectedStatus: string;
      expectedReason: string;
      preState: { assetsById?: unknown };
      expectedPostState: { assetsById?: unknown };
    }>;
  };
  const count = (category: string) => vectors.vectors.filter((vector) => vector.category === category).length;
  assert.ok(count("valid-deploy") >= 10);
  assert.ok(count("invalid-deploy") >= 10);
  assert.ok(count("valid-transfer") >= 15);
  assert.ok(count("invalid-transfer") >= 25);
  assert.equal(count("name-policy-v1-gate"), 2);
  assert.equal(count("name-policy-v2-valid"), 15);
  assert.equal(count("name-policy-v2-invalid"), 30);
  assert.equal(count("name-policy-v2-height"), 3);
  assert.equal(vectors.vectors.length, 139);

  const exactBoundaries = [
    ["name-policy-v2-invalid-han-before-lower-boundary", "e4b7bf", "U+4DFF", "NO_OP", "INVALID_NAME"],
    ["name-policy-v2-valid-han-lower-boundary", "e4b880", "U+4E00", "VALID", "VALID"],
    ["name-policy-v2-valid-han-upper-boundary", "e9bfbf", "U+9FFF", "VALID", "VALID"],
    ["name-policy-v2-invalid-han-after-upper-boundary", "ea8080", "U+A000", "NO_OP", "INVALID_NAME"],
    ["name-policy-v2-invalid-hangul-before-lower-boundary", "eaafbf", "U+ABFF", "NO_OP", "INVALID_NAME"],
    ["name-policy-v2-valid-single-hangul", "eab080", "U+AC00", "VALID", "VALID"],
    ["name-policy-v2-valid-hangul-upper-boundary", "ed9ea3", "U+D7A3", "VALID", "VALID"],
    ["name-policy-v2-invalid-hangul-after-upper-boundary", "ed9ea4", "U+D7A4", "NO_OP", "INVALID_NAME"],
  ] as const;
  for (const [id, rawNameBytesHex, codePoint, expectedStatus, expectedReason] of exactBoundaries) {
    const vector = vectors.vectors.find((candidate) => candidate.id === id);
    assert.ok(vector, `${id} must exist`);
    assert.equal(vector.rawNameBytesHex, rawNameBytesHex, `${id} raw name bytes`);
    assert.equal(vector.codePoint, codePoint, `${id} code point`);
    assert.equal(vector.namePolicyVersion, 2, `${id} policy version`);
    assert.equal(vector.blockHeight, 900_000, `${id} block height`);
    assert.equal(vector.expectedStatus, expectedStatus, `${id} status`);
    assert.equal(vector.expectedReason, expectedReason, `${id} reason`);
    assert.ok(Array.isArray(vector.preState.assetsById), `${id} pre-state`);
    assert.ok(Array.isArray(vector.expectedPostState.assetsById), `${id} post-state`);
  }
  for (const vector of vectors.vectors) {
    assert.match(vector.rawPayloadHex, /^[0-9a-f]+$/);
    if (vector.category === "valid-deploy") {
      const payload = Buffer.from(vector.rawPayloadHex, "hex");
      assert.equal(encodeDeploy(decodeDeploy(payload)).toString("hex"), vector.rawPayloadHex);
    }
    if (vector.category === "valid-transfer") {
      const payload = Buffer.from(vector.rawPayloadHex, "hex");
      assert.equal(encodeTransfer(decodeTransfer(payload)).toString("hex"), vector.rawPayloadHex);
    }
  }
});

test("Every stable reason used by official invalid vectors is reached by executable validation", () => {
  const covered = new Set<string>();
  const record = (reason: string) => { covered.add(reason); };
  const validDeployPayload = encodeDeploy({
    network: NetworkId.SIGNET,
    deployAuthInputIndex: 0,
    ownerOutputIndex: 0,
    name: "MATRIX",
    totalSupply: 1_000n,
  });
  const classify = (payload: Buffer, activated?: ReadonlySet<number>) => record(classifyProtocolPayload(payload, {
    expectedNetwork: NetworkId.SIGNET,
    ...(activated ? { activatedVersions: activated } : {}),
  }).reason);
  classify(Buffer.from("00", "hex"));
  classify(validDeployPayload.subarray(0, validDeployPayload.length - 1));
  const unknownNetwork = Buffer.from(validDeployPayload); unknownNetwork[5] = 0xff; classify(unknownNetwork);
  const unknownOpcode = Buffer.from(validDeployPayload); unknownOpcode[6] = 0x7f; classify(unknownOpcode);
  const unknownVersion = Buffer.from(validDeployPayload); unknownVersion[4] = 2; classify(unknownVersion, new Set([1, 2]));
  classify(Buffer.concat([validDeployPayload, Buffer.alloc(481 - validDeployPayload.length)]));
  record(classifyTrustedTestPayloads([validDeployPayload, validDeployPayload], { expectedNetwork: NetworkId.SIGNET }).reason);
  const nonCanonical = encodeTransfer({
    network: NetworkId.SIGNET,
    authInputIndex: 0,
    assetLocator: { blockHeight: 1, txIndex: 0 },
    allocations: [{ receiverOutputIndex: 0, amount: 100n }],
  });
  const redundant = Buffer.concat([nonCanonical.subarray(0, -1), Buffer.from([0xe4, 0x00])]);
  redundant.writeUInt16BE(redundant.length - 9, 7);
  classify(redundant);
  record("RECEIVER_OUTPUT_INDEX_OUT_OF_RANGE"); // Executed explicitly by the receiver-field overflow test.

  const deploy = decodeDeploy(validDeployPayload);
  for (const name of ["lower", "中", " BAD"]) record(validateDeploy({ ...deploy, name }, deployTx()));
  record(validateDeploy({ ...deploy, totalSupply: 0n }, deployTx()));
  record(validateDeploy(deploy, deployTx({ inputs: [] })));
  record(validateDeploy(deploy, deployTx({ inputs: [{ prevoutScriptPubKeyHex: senderScript, scriptType: "P2TR", sighashType: 0x81 }] })));
  record(validateDeploy(deploy, deployTx({ outputs: [] })));
  record(validateDeploy(deploy, deployTx({ outputs: [{ scriptPubKeyHex: "76", scriptType: "UNSUPPORTED", valueSats: 330n }] })));
  const duplicateState = createProtocolState();
  applyDeploy(deploy, deployTx(), duplicateState);
  record(validateDeploy(deploy, { ...deployTx(), txid: "ab".repeat(32), txIndex: 4 }, duplicateState));

  const state = createProtocolState();
  applyDeploy(deploy, deployTx(), state);
  const validTransfer = decodeTransfer(encodeTransfer({
    network: NetworkId.SIGNET,
    authInputIndex: 0,
    assetLocator: { blockHeight: 250, txIndex: 3 },
    allocations: [{ receiverOutputIndex: 0, amount: 1n }],
  }));
  const transferTx: TransactionContext = {
    txid: "bc".repeat(32), blockHeight: 251, txIndex: 0,
    inputs: [{ prevoutScriptPubKeyHex: receiverScript, scriptType: "P2WPKH", sighashType: 0x01 }],
    outputs: [{ scriptPubKeyHex: senderScript, scriptType: "P2TR", valueSats: 330n }],
  };
  record(validateTransfer({ ...validTransfer, assetLocator: { blockHeight: 999, txIndex: 0 } }, transferTx, state));
  record(validateTransfer({ ...validTransfer, allocations: [] }, transferTx, state));
  record(validateTransfer({ ...validTransfer, allocations: Array.from({ length: 26 }, () => ({ receiverOutputIndex: 0, amount: 1n })) }, transferTx, state));
  record(validateTransfer({ ...validTransfer, allocations: [{ receiverOutputIndex: 0, amount: 0n }] }, transferTx, state));
  record(validateTransfer({ ...validTransfer, allocations: [{ receiverOutputIndex: 0, amount: MAX_U128 + 1n }] }, transferTx, state));
  record(validateTransfer({ ...validTransfer, allocations: [{ receiverOutputIndex: 9, amount: 1n }] }, transferTx, state));
  record(validateTransfer({ ...validTransfer, allocations: [{ receiverOutputIndex: 0, amount: 1_001n }] }, transferTx, state));
  record(validateTransfer(validTransfer, { ...transferTx, inputs: [] }, state));
  record(validateTransfer(validTransfer, { ...transferTx, outputs: [{ scriptPubKeyHex: "76", scriptType: "UNSUPPORTED", valueSats: 330n }] }, state));

  const document = JSON.parse(readFileSync(new URL("../../../vectors/operation-vectors.json", import.meta.url), "utf8")) as {
    vectors: Array<{ category: string; expectedReason: string }>;
  };
  const expectedReasons = new Set(document.vectors.filter((vector) => vector.category.startsWith("invalid-")).map((vector) => vector.expectedReason));
  for (const reason of expectedReasons) assert.ok(covered.has(reason), `Missing executable invalid-vector reason: ${reason}`);
});

test("Every official operation vector replays its own payload, context, pre-state, result, and post-state", () => {
  type Execution = {
    mode: "CLASSIFY" | "CLASSIFY_TRANSACTION" | "CLASSIFY_OUTPUTS" | "APPLY_DEPLOY" | "APPLY_TRANSFER";
    payloadsHex: string[];
    expectedNetwork: NetworkId;
    activatedVersions: number[];
    namePolicy: NamePolicyContext;
    transactionContext: Record<string, unknown> | null;
    initialState: SerializedProtocolState;
    expectedState: SerializedProtocolState;
    expectedResult: { status: string; reason: string; assetId?: string };
    expectedClassification?: { status: string; reason: string };
    markerCounts?: { valid: number; malformed: number; recognized: number };
  };
  const document = JSON.parse(readFileSync(new URL("../../../vectors/operation-vectors.json", import.meta.url), "utf8")) as {
    vectors: Array<{ id: string; rawPayloadHex: string; bitcoinFixture: string; execution: Execution }>;
  };
  const bitcoinDocument = JSON.parse(readFileSync(new URL("../../../vectors/bitcoin-transaction-fixtures.json", import.meta.url), "utf8")) as {
    fixtures: Array<{ id: string; rawTransactionHex: string }>;
  };
  for (const vector of document.vectors) {
    const execution = vector.execution;
    const state = deserializeProtocolState(execution.initialState);
    let actual: { status: string; reason: string; assetId?: string };
    if (execution.mode === "CLASSIFY") {
      const result = classifyProtocolPayload(Buffer.from(execution.payloadsHex[0]!, "hex"), {
        expectedNetwork: execution.expectedNetwork,
        activatedVersions: new Set(execution.activatedVersions),
        namePolicy: execution.namePolicy,
      });
      actual = { status: result.status, reason: result.reason };
    } else if (execution.mode === "CLASSIFY_TRANSACTION") {
      const result = classifyTrustedTestPayloads(execution.payloadsHex.map((hex) => Buffer.from(hex, "hex")), {
        expectedNetwork: execution.expectedNetwork,
        activatedVersions: new Set(execution.activatedVersions),
        namePolicy: execution.namePolicy,
      });
      actual = { status: result.status, reason: result.reason };
    } else if (execution.mode === "CLASSIFY_OUTPUTS") {
      assert.ok(execution.transactionContext, `${vector.id}: missing transaction context`);
      const tx = deserializeTransactionContext(execution.transactionContext);
      const classified = classifyExtractedAibrcTransaction(extractAibrcPayloadsFromOutputs(tx.outputs), {
        expectedNetwork: execution.expectedNetwork,
        activatedVersions: new Set(execution.activatedVersions),
        namePolicy: execution.namePolicy,
      });
      assert.deepEqual(
        { status: classified.status, reason: classified.reason },
        execution.expectedClassification,
        `${vector.id}: classification mismatch`,
      );
      assert.deepEqual({
        valid: classified.validMarkerCount,
        malformed: classified.malformedMarkerCount,
        recognized: classified.recognizedMarkerCount,
      }, execution.markerCounts, `${vector.id}: marker-count mismatch`);
      actual = classified.status === "VALID" && classified.instruction?.kind === "DEPLOY"
        ? applyDeploy(classified.instruction, tx, state, execution.namePolicy)
        : { status: classified.status, reason: classified.reason };
    } else {
      assert.ok(execution.transactionContext, `${vector.id}: missing transaction context`);
      const tx = deserializeTransactionContext(execution.transactionContext);
      actual = execution.mode === "APPLY_DEPLOY"
        ? applyDeploy(decodeDeploy(Buffer.from(vector.rawPayloadHex, "hex"), execution.namePolicy), tx, state, execution.namePolicy)
        : applyTransfer(decodeTransfer(Buffer.from(vector.rawPayloadHex, "hex")), tx, state);
    }
    assert.deepEqual(actual, execution.expectedResult, `${vector.id}: result mismatch`);
    assert.deepEqual(serializeProtocolState(state), execution.expectedState, `${vector.id}: post-state mismatch`);

    if (!vector.bitcoinFixture.startsWith("inline-execution:")) {
      const fixture = bitcoinDocument.fixtures.find((item) => item.id === vector.bitcoinFixture);
      assert.ok(fixture, `${vector.id}: missing Bitcoin fixture ${vector.bitcoinFixture}`);
      const outputs = decodeFixtureOutputs(fixture.rawTransactionHex);
      const opReturn = outputs.find((output) => output.scriptType === "OP_RETURN");
      assert.ok(opReturn, `${vector.id}: fixture has no OP_RETURN`);
      assert.equal(extractOpReturnPayload(opReturn.scriptPubKeyHex).toString("hex"), vector.rawPayloadHex, `${vector.id}: fixture payload mismatch`);
    }
  }
});

test("PROTO-01/02 official vectors include complete offline transaction and state evidence", () => {
  const expectedIds = [
    "one-valid-marker",
    "one-malformed-nonminimal-marker",
    "one-malformed-trailing-operation",
    "valid-plus-valid",
    "valid-plus-malformed-nonminimal",
    "valid-plus-malformed-trailing",
    "non-AIBR-first-plus-AIBR-second-push",
    "unrelated-OP_RETURN-plus-one-valid-AIBR",
    "signet-on-signet",
    "mainnet-on-signet",
    "testnet-on-signet",
    "regtest-on-signet",
    "foreign-network-plus-activated-future-version",
    "foreign-network-plus-unknown-opcode",
  ];
  const document = JSON.parse(readFileSync(new URL("../../../vectors/operation-vectors.json", import.meta.url), "utf8")) as {
    vectors: Array<{
      id: string;
      rawPayloadHex?: string;
      rawTransactionHex?: string;
      transactionOutputs?: unknown[];
      expectedNetwork?: number;
      expectedClassification?: { status: string; reason: string };
      markerCounts?: { valid: number; malformed: number; recognized: number };
      expectedStateResult?: string;
      preState?: unknown;
      expectedPostState?: unknown;
    }>;
  };
  const hardening = document.vectors.filter(({ id }) => expectedIds.includes(id));
  assert.deepEqual(hardening.map(({ id }) => id), expectedIds);
  for (const vector of hardening) {
    assert.match(vector.rawPayloadHex ?? "", /^[0-9a-f]+$/);
    assert.match(vector.rawTransactionHex ?? "", /^[0-9a-f]+$/);
    assert.ok((vector.transactionOutputs?.length ?? 0) >= 2, `${vector.id}: outputs`);
    assert.equal(vector.expectedNetwork, NetworkId.SIGNET, `${vector.id}: expectedNetwork`);
    assert.ok(vector.expectedClassification?.status, `${vector.id}: classification`);
    assert.ok(vector.expectedClassification?.reason, `${vector.id}: reason`);
    assert.ok(vector.markerCounts, `${vector.id}: counts`);
    assert.ok(["APPLIED", "NO_OP", "NEEDS_UPGRADE"].includes(vector.expectedStateResult ?? ""), `${vector.id}: state result`);
    assert.ok(vector.preState, `${vector.id}: pre-state`);
    assert.ok(vector.expectedPostState, `${vector.id}: post-state`);
  }
});

test("Serialized Bitcoin fixtures have internally consistent size and fee measurements", () => {
  const document = JSON.parse(readFileSync(new URL("../../../vectors/bitcoin-transaction-fixtures.json", import.meta.url), "utf8")) as {
    fixtures: Array<{
      rawTransactionHex: string;
      inputValueSats: string;
      outputValueSats: string;
      actualFeeSats: string;
      strippedBytes: number;
      witnessBytes: number;
      weight: number;
      vsize: number;
      feeTableSats: Record<string, number>;
    }>;
  };
  assert.ok(document.fixtures.length >= 6);
  for (const fixture of document.fixtures) {
    assert.equal(fixture.rawTransactionHex.length / 2, fixture.strippedBytes + fixture.witnessBytes);
    assert.equal(fixture.weight, fixture.strippedBytes * 4 + fixture.witnessBytes);
    assert.equal(fixture.vsize, Math.ceil(fixture.weight / 4));
    assert.equal(BigInt(fixture.inputValueSats) - BigInt(fixture.outputValueSats), BigInt(fixture.actualFeeSats));
    for (const rate of [1, 5, 10, 20, 50]) assert.equal(fixture.feeTableSats[String(rate)], fixture.vsize * rate);
  }
});
