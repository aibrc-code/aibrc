import { Buffer } from "buffer";
import { sha256Bytes } from "./hash.js";

export { Buffer } from "buffer";

export const MAGIC = Buffer.from("41494252", "hex");
export const WIRE_VERSION = 1;
export const HEADER_LENGTH = 9;
export const MAX_AIBRC_PAYLOAD_BYTES = 480;
export const MAX_PROTOCOL_PAYLOAD_BYTES = MAX_AIBRC_PAYLOAD_BYTES;
export const COMPAT_PAYLOAD_BYTES = 80;
export const MAX_ALLOCATIONS = 25;
export const MAX_U128 = (1n << 128n) - 1n;

export enum NetworkId {
  MAINNET = 0,
  TESTNET = 1,
  SIGNET = 2,
  REGTEST = 3,
}

export enum Opcode {
  DEPLOY = 1,
  TRANSFER = 2,
}

export type ReasonCode =
  | "VALID"
  | "NOT_AIBRC"
  | "NON_MINIMAL_PUSH"
  | "PUSH_LENGTH_MISMATCH"
  | "TRAILING_SCRIPT_OPERATION"
  | "TRUNCATED_PAYLOAD"
  | "PAYLOAD_TOO_LARGE"
  | "LENGTH_MISMATCH"
  | "UNKNOWN_NETWORK"
  | "UNKNOWN_VERSION"
  | "UNKNOWN_OPCODE"
  | "DUPLICATE_STATE_INSTRUCTION"
  | "NAME_POLICY_CONTEXT_REQUIRED"
  | "INVALID_NAME_POLICY"
  | "INVALID_NAME"
  | "DUPLICATE_NAME"
  | "ZERO_SUPPLY"
  | "INVALID_AUTH_INPUT"
  | "INVALID_OWNER_OUTPUT"
  | "INVALID_RECEIVER_OUTPUT"
  | "RECEIVER_OUTPUT_INDEX_OUT_OF_RANGE"
  | "UNSUPPORTED_SCRIPT"
  | "UNSUPPORTED_SIGHASH"
  | "UNKNOWN_ASSET"
  | "ZERO_AMOUNT"
  | "EMPTY_ALLOCATIONS"
  | "TOO_MANY_ALLOCATIONS"
  | "NON_CANONICAL_INTEGER"
  | "U128_OVERFLOW"
  | "INSUFFICIENT_BALANCE";

export class ProtocolError extends Error {
  constructor(public readonly reason: ReasonCode) {
    super(reason);
    this.name = "ProtocolError";
  }
}

export interface DeployInstruction {
  kind: "DEPLOY";
  version: number;
  network: NetworkId;
  deployAuthInputIndex: number;
  ownerOutputIndex: number;
  name: string;
  canonicalNameBytes: Buffer;
  totalSupply: bigint;
}

export interface DecodedDeployStructure extends Omit<DeployInstruction, "name"> {}

export interface NamePolicySchedule {
  readonly manifestNamePolicyVersion: 1 | 2;
  readonly activationHeight: number | null;
}

export interface NamePolicyContext extends NamePolicySchedule {
  readonly blockHeight: number;
}

export const NAME_POLICY_V1_SCHEDULE: NamePolicySchedule = Object.freeze({
  manifestNamePolicyVersion: 1,
  activationHeight: null,
});

export interface Allocation {
  receiverOutputIndex: number;
  amount: bigint;
}

export interface AssetLocator {
  blockHeight: number;
  txIndex: number;
}

export type RpcTxid = string & { readonly __rpcTxid: unique symbol };

export interface TransferInstruction {
  kind: "TRANSFER";
  version: number;
  network: NetworkId;
  authInputIndex: number;
  assetLocator: AssetLocator;
  allocations: Allocation[];
}

export type ProtocolInstruction = DeployInstruction | TransferInstruction;
export type ScriptType =
  | "P2TR"
  | "P2WPKH"
  | "P2SH_P2WPKH"
  | "OP_RETURN"
  | "UNSUPPORTED";

export interface TxInputContext {
  prevoutScriptPubKeyHex: string;
  /** Non-authoritative caller metadata; consensus classification always uses prevoutScriptPubKeyHex. */
  scriptType?: ScriptType;
  sighashType: number;
}

export interface TxOutputContext {
  scriptPubKeyHex: string;
  /** Non-authoritative caller metadata; consensus classification always uses scriptPubKeyHex. */
  scriptType?: ScriptType;
  valueSats: bigint;
}

export interface TransactionContext {
  txid: string;
  blockHeight: number;
  txIndex: number;
  inputs: TxInputContext[];
  outputs: TxOutputContext[];
}

export interface AssetRecord {
  assetId: string;
  name: string;
  network: NetworkId;
  totalSupply: bigint;
  deployTxid: string;
  ownerOutputIndex: number;
  locator: AssetLocator;
}

export interface ProtocolState {
  assetsById: Map<string, AssetRecord>;
  assetIdByName: Map<string, string>;
  assetIdByLocator: Map<string, string>;
  balances: Map<string, bigint>;
}

export interface ApplyResult {
  status: "APPLIED" | "NO_OP" | "NEEDS_UPGRADE";
  reason: ReasonCode;
  assetId?: string;
}

export interface ProtocolClassificationContext {
  readonly expectedNetwork: NetworkId;
  readonly activatedVersions?: ReadonlySet<number>;
  readonly namePolicy?: NamePolicyContext;
}

export interface ProtocolClassificationResult {
  readonly status: "VALID" | "NO_OP" | "NEEDS_UPGRADE";
  readonly reason: ReasonCode;
  readonly instruction?: ProtocolInstruction;
}

export interface TransactionClassificationResult extends ProtocolClassificationResult {
  readonly validMarkerCount: number;
  readonly malformedMarkerCount: number;
  readonly recognizedMarkerCount: number;
}

export function createProtocolState(): ProtocolState {
  return {
    assetsById: new Map(),
    assetIdByName: new Map(),
    assetIdByLocator: new Map(),
    balances: new Map(),
  };
}

function assertUInt(value: number, max: number, reason: ReasonCode): void {
  if (!Number.isInteger(value) || value < 0 || value > max) throw new ProtocolError(reason);
}

function encodeU128(value: bigint): Buffer {
  if (value < 0n || value > MAX_U128) throw new ProtocolError("U128_OVERFLOW");
  return Buffer.from(value.toString(16).padStart(32, "0"), "hex");
}

function decodeU128(buffer: Buffer, offset: number): bigint {
  if (offset + 16 > buffer.length) throw new ProtocolError("TRUNCATED_PAYLOAD");
  return BigInt(`0x${buffer.subarray(offset, offset + 16).toString("hex")}`);
}

function encodeVarUint(value: bigint, max: bigint, overflowReason: ReasonCode = "U128_OVERFLOW"): Buffer {
  if (value < 0n || value > max) throw new ProtocolError(overflowReason);
  const bytes: number[] = [];
  let remaining = value;
  do {
    let byte = Number(remaining & 0x7fn);
    remaining >>= 7n;
    if (remaining !== 0n) byte |= 0x80;
    bytes.push(byte);
  } while (remaining !== 0n);
  return Buffer.from(bytes);
}

function decodeVarUint(
  buffer: Buffer,
  offset: number,
  max: bigint,
  overflowReason: ReasonCode = "U128_OVERFLOW",
): { value: bigint; nextOffset: number } {
  let value = 0n;
  let shift = 0n;
  let cursor = offset;
  for (;;) {
    if (cursor >= buffer.length) throw new ProtocolError("TRUNCATED_PAYLOAD");
    const byte = buffer[cursor]!;
    const low = BigInt(byte & 0x7f);
    if (shift >= 128n && low !== 0n) throw new ProtocolError(overflowReason);
    value |= low << shift;
    cursor += 1;
    if ((byte & 0x80) === 0) {
      if (cursor - offset > 1 && low === 0n) throw new ProtocolError("NON_CANONICAL_INTEGER");
      if (value > max) throw new ProtocolError(overflowReason);
      return { value, nextOffset: cursor };
    }
    shift += 7n;
    if (shift > 133n) throw new ProtocolError(overflowReason);
  }
}

function envelope(network: NetworkId, opcode: Opcode, body: Buffer): Buffer {
  if (!Object.values(NetworkId).includes(network)) throw new ProtocolError("UNKNOWN_NETWORK");
  const totalLength = HEADER_LENGTH + body.length;
  if (totalLength > MAX_PROTOCOL_PAYLOAD_BYTES) throw new ProtocolError("PAYLOAD_TOO_LARGE");
  const header = Buffer.alloc(HEADER_LENGTH);
  MAGIC.copy(header, 0);
  header.writeUInt8(WIRE_VERSION, 4);
  header.writeUInt8(network, 5);
  header.writeUInt8(opcode, 6);
  header.writeUInt16BE(body.length, 7);
  return Buffer.concat([header, body]);
}

interface ParsedEnvelope {
  version: number;
  network: NetworkId;
  opcode: number;
  declaredBodyLength: number;
  body: Buffer;
}

function parseEnvelopeHeader(payload: Buffer): ParsedEnvelope {
  if (payload.length < 4 || !payload.subarray(0, 4).equals(MAGIC)) throw new ProtocolError("NOT_AIBRC");
  if (payload.length < HEADER_LENGTH) throw new ProtocolError("TRUNCATED_PAYLOAD");
  if (payload.length > MAX_PROTOCOL_PAYLOAD_BYTES) throw new ProtocolError("PAYLOAD_TOO_LARGE");
  const version = payload.readUInt8(4);
  const network = payload.readUInt8(5);
  const opcode = payload.readUInt8(6);
  if (network > NetworkId.REGTEST) throw new ProtocolError("UNKNOWN_NETWORK");
  return {
    version,
    network,
    opcode,
    declaredBodyLength: payload.readUInt16BE(7),
    body: payload.subarray(HEADER_LENGTH),
  };
}

function assertBodyLength(parsed: ParsedEnvelope): void {
  if (parsed.declaredBodyLength !== parsed.body.length) throw new ProtocolError("LENGTH_MISMATCH");
}

export function isCanonicalNameByte(byte: number): boolean {
  return (byte >= 0x30 && byte <= 0x39) || (byte >= 0x41 && byte <= 0x5a) || byte === 0x5f;
}

function assertNameByteLength(bytes: Buffer): void {
  if (bytes.length < 1 || bytes.length > 16) throw new ProtocolError("INVALID_NAME");
}

function validateNamePolicyV1(bytes: Buffer): void {
  assertNameByteLength(bytes);
  for (const byte of bytes) {
    if (!isCanonicalNameByte(byte)) throw new ProtocolError("INVALID_NAME");
  }
}

function validateNamePolicyV2(bytes: Buffer): void {
  assertNameByteLength(bytes);
  let offset = 0;
  while (offset < bytes.length) {
    const first = bytes[offset]!;
    if (first <= 0x7f) {
      if (!isCanonicalNameByte(first)) throw new ProtocolError("INVALID_NAME");
      offset += 1;
      continue;
    }
    if (first < 0xe0 || first > 0xef || offset + 2 >= bytes.length) throw new ProtocolError("INVALID_NAME");
    const second = bytes[offset + 1]!;
    const third = bytes[offset + 2]!;
    if (second < 0x80 || second > 0xbf || third < 0x80 || third > 0xbf) throw new ProtocolError("INVALID_NAME");
    if (first === 0xe0 && second < 0xa0) throw new ProtocolError("INVALID_NAME");
    if (first === 0xed && second > 0x9f) throw new ProtocolError("INVALID_NAME");
    const codePoint = ((first & 0x0f) << 12) | ((second & 0x3f) << 6) | (third & 0x3f);
    if (!((codePoint >= 0x4e00 && codePoint <= 0x9fff) || (codePoint >= 0xac00 && codePoint <= 0xd7a3))) {
      throw new ProtocolError("INVALID_NAME");
    }
    offset += 3;
  }
}

export function namePolicyContextForBlock(schedule: NamePolicySchedule, blockHeight: number): NamePolicyContext {
  if (!schedule || !Number.isSafeInteger(blockHeight) || blockHeight < 0) {
    throw new ProtocolError("NAME_POLICY_CONTEXT_REQUIRED");
  }
  if (schedule.manifestNamePolicyVersion === 1) {
    if (schedule.activationHeight !== null) throw new ProtocolError("INVALID_NAME_POLICY");
  } else if (schedule.manifestNamePolicyVersion === 2) {
    if (!Number.isSafeInteger(schedule.activationHeight) || schedule.activationHeight === null || schedule.activationHeight < 0) {
      throw new ProtocolError("INVALID_NAME_POLICY");
    }
  } else {
    throw new ProtocolError("INVALID_NAME_POLICY");
  }
  return Object.freeze({
    manifestNamePolicyVersion: schedule.manifestNamePolicyVersion,
    activationHeight: schedule.activationHeight,
    blockHeight,
  });
}

export function activeNamePolicyVersion(context: NamePolicyContext): 1 | 2 {
  const verified = namePolicyContextForBlock(context, context?.blockHeight);
  return verified.manifestNamePolicyVersion === 2 && verified.blockHeight >= verified.activationHeight! ? 2 : 1;
}

export function validateCanonicalNameBytes(bytes: Buffer, context: NamePolicyContext): void {
  if (!context) throw new ProtocolError("NAME_POLICY_CONTEXT_REQUIRED");
  if (activeNamePolicyVersion(context) === 1) validateNamePolicyV1(bytes);
  else validateNamePolicyV2(bytes);
}

export function encodeDeploy(
  input: Omit<DeployInstruction, "kind" | "version" | "canonicalNameBytes">,
  namePolicy: NamePolicyContext,
): Buffer {
  assertUInt(input.deployAuthInputIndex, 0xffff, "INVALID_AUTH_INPUT");
  assertUInt(input.ownerOutputIndex, 0xffff, "INVALID_OWNER_OUTPUT");
  const name = Buffer.from(input.name, "utf8");
  validateCanonicalNameBytes(name, namePolicy);
  if (input.totalSupply === 0n) throw new ProtocolError("ZERO_SUPPLY");
  const prefix = Buffer.alloc(5);
  prefix.writeUInt16BE(input.deployAuthInputIndex, 0);
  prefix.writeUInt16BE(input.ownerOutputIndex, 2);
  prefix.writeUInt8(name.length, 4);
  return envelope(input.network, Opcode.DEPLOY, Buffer.concat([prefix, name, encodeU128(input.totalSupply)]));
}

export function decodeDeployStructure(payload: Buffer): DecodedDeployStructure {
  const parsed = parseEnvelopeHeader(payload);
  if (parsed.version !== WIRE_VERSION) throw new ProtocolError("UNKNOWN_VERSION");
  if (parsed.opcode !== Opcode.DEPLOY) throw new ProtocolError("UNKNOWN_OPCODE");
  assertBodyLength(parsed);
  if (parsed.body.length < 21) throw new ProtocolError("TRUNCATED_PAYLOAD");
  const nameLength = parsed.body.readUInt8(4);
  if (nameLength < 1 || nameLength > 16) throw new ProtocolError("INVALID_NAME");
  const expectedLength = 5 + nameLength + 16;
  if (parsed.body.length !== expectedLength) throw new ProtocolError("LENGTH_MISMATCH");
  const canonicalNameBytes = Buffer.from(parsed.body.subarray(5, 5 + nameLength));
  return {
    kind: "DEPLOY",
    version: parsed.version,
    network: parsed.network,
    deployAuthInputIndex: parsed.body.readUInt16BE(0),
    ownerOutputIndex: parsed.body.readUInt16BE(2),
    canonicalNameBytes,
    totalSupply: decodeU128(parsed.body, 5 + nameLength),
  };
}

export function decodeDeploy(payload: Buffer, namePolicy: NamePolicyContext): DeployInstruction {
  if (!namePolicy) throw new ProtocolError("NAME_POLICY_CONTEXT_REQUIRED");
  const decoded = decodeDeployStructure(payload);
  validateCanonicalNameBytes(decoded.canonicalNameBytes, namePolicy);
  return { ...decoded, name: decoded.canonicalNameBytes.toString("utf8") };
}

export function encodeAssetLocator(locator: AssetLocator): Buffer {
  assertUInt(locator.blockHeight, 0xffffffff, "UNKNOWN_ASSET");
  assertUInt(locator.txIndex, 0xffff, "UNKNOWN_ASSET");
  const result = Buffer.alloc(6);
  result.writeUInt32BE(locator.blockHeight, 0);
  result.writeUInt16BE(locator.txIndex, 4);
  return result;
}

export function decodeAssetLocator(buffer: Buffer): AssetLocator {
  if (buffer.length !== 6) throw new ProtocolError("TRUNCATED_PAYLOAD");
  return { blockHeight: buffer.readUInt32BE(0), txIndex: buffer.readUInt16BE(4) };
}

export function encodeTransfer(input: Omit<TransferInstruction, "kind" | "version">): Buffer {
  assertUInt(input.authInputIndex, 0xffff, "INVALID_AUTH_INPUT");
  if (input.allocations.length === 0) throw new ProtocolError("EMPTY_ALLOCATIONS");
  if (input.allocations.length > MAX_ALLOCATIONS) throw new ProtocolError("TOO_MANY_ALLOCATIONS");
  const prefix = Buffer.alloc(3);
  prefix.writeUInt16BE(input.authInputIndex, 0);
  prefix.writeUInt8(input.allocations.length, 2);
  const allocations = input.allocations.map((allocation) => {
    assertUInt(allocation.receiverOutputIndex, 0xffff, "RECEIVER_OUTPUT_INDEX_OUT_OF_RANGE");
    if (allocation.amount === 0n) throw new ProtocolError("ZERO_AMOUNT");
    return Buffer.concat([
      encodeVarUint(BigInt(allocation.receiverOutputIndex), 0xffffn, "RECEIVER_OUTPUT_INDEX_OUT_OF_RANGE"),
      encodeVarUint(allocation.amount, MAX_U128),
    ]);
  });
  return envelope(
    input.network,
    Opcode.TRANSFER,
    Buffer.concat([prefix, encodeAssetLocator(input.assetLocator), ...allocations]),
  );
}

export function decodeTransfer(payload: Buffer): TransferInstruction {
  const parsed = parseEnvelopeHeader(payload);
  if (parsed.version !== WIRE_VERSION) throw new ProtocolError("UNKNOWN_VERSION");
  if (parsed.opcode !== Opcode.TRANSFER) throw new ProtocolError("UNKNOWN_OPCODE");
  assertBodyLength(parsed);
  if (parsed.body.length < 9) throw new ProtocolError("TRUNCATED_PAYLOAD");
  const count = parsed.body.readUInt8(2);
  if (count === 0) throw new ProtocolError("EMPTY_ALLOCATIONS");
  if (count > MAX_ALLOCATIONS) throw new ProtocolError("TOO_MANY_ALLOCATIONS");
  const allocations: Allocation[] = [];
  let offset = 9;
  for (let i = 0; i < count; i += 1) {
    const receiver = decodeVarUint(
      parsed.body,
      offset,
      0xffffn,
      "RECEIVER_OUTPUT_INDEX_OUT_OF_RANGE",
    );
    const amount = decodeVarUint(parsed.body, receiver.nextOffset, MAX_U128);
    allocations.push({
      receiverOutputIndex: Number(receiver.value),
      amount: amount.value,
    });
    offset = amount.nextOffset;
  }
  if (offset !== parsed.body.length) throw new ProtocolError("LENGTH_MISMATCH");
  return {
    kind: "TRANSFER",
    version: parsed.version,
    network: parsed.network,
    authInputIndex: parsed.body.readUInt16BE(0),
    assetLocator: decodeAssetLocator(parsed.body.subarray(3, 9)),
    allocations,
  };
}

export function classifyProtocolPayload(
  payload: Buffer,
  context: ProtocolClassificationContext,
): ProtocolClassificationResult {
  if (!context || !Number.isInteger(context.expectedNetwork) || context.expectedNetwork < NetworkId.MAINNET || context.expectedNetwork > NetworkId.REGTEST) {
    throw new Error("EXPECTED_NETWORK_REQUIRED");
  }
  const activatedVersions = context.activatedVersions ?? new Set([WIRE_VERSION]);
  try {
    const envelopeData = parseEnvelopeHeader(payload);
    if (envelopeData.network !== context.expectedNetwork) {
      return { status: "NO_OP", reason: "UNKNOWN_NETWORK" };
    }
    if (envelopeData.version !== WIRE_VERSION) {
      return activatedVersions.has(envelopeData.version)
        ? { status: "NEEDS_UPGRADE", reason: "UNKNOWN_VERSION" }
        : { status: "NO_OP", reason: "UNKNOWN_VERSION" };
    }
    if (envelopeData.opcode !== Opcode.DEPLOY && envelopeData.opcode !== Opcode.TRANSFER) {
      return { status: "NO_OP", reason: "UNKNOWN_OPCODE" };
    }
    const instruction = envelopeData.opcode === Opcode.DEPLOY
      ? decodeDeploy(payload, context.namePolicy!)
      : decodeTransfer(payload);
    return { status: "VALID", reason: "VALID", instruction };
  } catch (error) {
    const reason = error instanceof ProtocolError ? error.reason : "TRUNCATED_PAYLOAD";
    return { status: "NO_OP", reason };
  }
}

function taggedHash(tag: string, message: Buffer): string {
  const tagHash = sha256Bytes(Buffer.from(tag, "utf8"));
  return sha256Bytes(tagHash, tagHash, message).toString("hex");
}

function normalizedHex(hex: string, bytes?: number): Buffer {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0 || (bytes !== undefined && hex.length !== bytes * 2)) {
    throw new ProtocolError("TRUNCATED_PAYLOAD");
  }
  return Buffer.from(hex, "hex");
}

export function decodeTxidDisplayBytes(txid: string): Buffer {
  return normalizedHex(txid, 32);
}

export function encodeTxidDisplayBytes(bytes: Buffer): RpcTxid {
  if (bytes.length !== 32) throw new ProtocolError("TRUNCATED_PAYLOAD");
  return bytes.toString("hex") as RpcTxid;
}

export function classifyPayloadProfile(payload: Buffer): "COMPATIBILITY" | "EXTENDED" {
  if (payload.length > MAX_PROTOCOL_PAYLOAD_BYTES) throw new ProtocolError("PAYLOAD_TOO_LARGE");
  return payload.length <= COMPAT_PAYLOAD_BYTES ? "COMPATIBILITY" : "EXTENDED";
}

function isCanonicalHex(hex: string): boolean {
  return /^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0;
}

export function deriveAssetId(input: {
  network: NetworkId;
  deployTxid: string;
  ownerOutputIndex: number;
  canonicalNameBytes: Buffer;
}, namePolicy: NamePolicyContext): string {
  const owner = Buffer.alloc(2);
  assertUInt(input.ownerOutputIndex, 0xffff, "INVALID_OWNER_OUTPUT");
  validateCanonicalNameBytes(input.canonicalNameBytes, namePolicy);
  owner.writeUInt16BE(input.ownerOutputIndex);
  return taggedHash(
    "AIBRC/asset/v1",
    Buffer.concat([
      Buffer.from([input.network]),
      decodeTxidDisplayBytes(input.deployTxid),
      owner,
      input.canonicalNameBytes,
    ]),
  );
}

export function deriveAccountKey(scriptPubKeyHex: string): string {
  return taggedHash("AIBRC/account/v1", normalizedHex(scriptPubKeyHex));
}

function locatorKey(locator: AssetLocator): string {
  return `${locator.blockHeight}:${locator.txIndex}`;
}

function balanceKey(assetId: string, accountKey: string): string {
  return `${assetId}:${accountKey}`;
}

export function classifyScriptPubKey(scriptPubKeyHex: string): "P2TR" | "P2WPKH" | "UNSUPPORTED" {
  if (!isCanonicalHex(scriptPubKeyHex)) return "UNSUPPORTED";
  const script = Buffer.from(scriptPubKeyHex, "hex");
  if (script.length === 34 && script[0] === 0x51 && script[1] === 0x20) return "P2TR";
  if (script.length === 22 && script[0] === 0x00 && script[1] === 0x14) return "P2WPKH";
  return "UNSUPPORTED";
}

/** Identity of raw-input interpretation, not a change to economic State Hash. */
export const INPUT_AUTHORIZATION_RULE_ID = "aibrc-input-authorization/bip341-keypath-v1";
export const UNSUPPORTED_INPUT_SIGHASH = 0xff;

/**
 * Interpret authorization shape from a Bitcoin-validated witness. Bitcoin Core
 * still verifies signatures/scripts; this does not implement cryptography.
 * BIP341 removes an annex only from a stack with at least two elements, then
 * distinguishes key-path from script-path by the remaining stack cardinality.
 */
export function deriveInputSighashType(witnessHex: readonly string[], prevoutScriptHex: string): number {
  // An explicit empty locking script is a valid Bitcoin script, although it is
  // unsupported for AIBRC authorization. Missing/malformed context still fails.
  if (typeof prevoutScriptHex !== "string" || !/^(?:[0-9a-fA-F]{2})*$/.test(prevoutScriptHex)) {
    throw new Error("INVALID_INPUT_PREVOUT_CONTEXT");
  }
  if (!Array.isArray(witnessHex) || witnessHex.some((item) => typeof item !== "string"
    || !/^(?:[0-9a-fA-F]{2})*$/.test(item))) {
    throw new Error("INVALID_INPUT_WITNESS_CONTEXT");
  }
  const scriptType = classifyScriptPubKey(prevoutScriptHex);
  if (scriptType === "UNSUPPORTED") return UNSUPPORTED_INPUT_SIGHASH;
  if (scriptType === "P2TR") {
    const annexPresent = witnessHex.length >= 2 && witnessHex.at(-1)!.slice(0, 2).toLowerCase() === "50";
    if (witnessHex.length - Number(annexPresent) !== 1) return UNSUPPORTED_INPUT_SIGHASH;
    const signature = Buffer.from(witnessHex[0]!, "hex");
    if (signature.length === 64) return 0;
    // Explicit SIGHASH_DEFAULT (65 bytes ending 00) is invalid under BIP341.
    if (signature.length === 65 && signature[64] !== 0) return signature[64]!;
    return UNSUPPORTED_INPUT_SIGHASH;
  }
  const signature = Buffer.from(witnessHex[0] ?? "", "hex");
  return signature.length >= 2 ? signature[signature.length - 1]! : UNSUPPORTED_INPUT_SIGHASH;
}

function isOpReturnScript(scriptPubKeyHex: string): boolean {
  return isCanonicalHex(scriptPubKeyHex) && Buffer.from(scriptPubKeyHex, "hex")[0] === 0x6a;
}

function validateAuthorization(input: TxInputContext | undefined): ReasonCode {
  if (!input) return "INVALID_AUTH_INPUT";
  const scriptType = classifyScriptPubKey(input.prevoutScriptPubKeyHex);
  if (scriptType === "UNSUPPORTED") return "UNSUPPORTED_SCRIPT";
  if (scriptType === "P2TR" && (input.sighashType === 0x00 || input.sighashType === 0x01)) return "VALID";
  if (scriptType === "P2WPKH" && input.sighashType === 0x01) return "VALID";
  return "UNSUPPORTED_SIGHASH";
}

function instructionHasCanonicalName(instruction: DeployInstruction, namePolicy: NamePolicyContext): boolean {
  try {
    validateCanonicalNameBytes(instruction.canonicalNameBytes, namePolicy);
    return instruction.name === instruction.canonicalNameBytes.toString("utf8");
  } catch {
    return false;
  }
}

export function validateDeploy(
  instruction: DeployInstruction,
  tx: TransactionContext,
  state: ProtocolState | undefined,
  namePolicy: NamePolicyContext,
): ReasonCode {
  if (!namePolicy) return "NAME_POLICY_CONTEXT_REQUIRED";
  if (!instructionHasCanonicalName(instruction, namePolicy)) return "INVALID_NAME";
  if (instruction.totalSupply <= 0n) return "ZERO_SUPPLY";
  if (instruction.totalSupply > MAX_U128) return "U128_OVERFLOW";
  const auth = validateAuthorization(tx.inputs[instruction.deployAuthInputIndex]);
  if (auth !== "VALID") return auth;
  const owner = tx.outputs[instruction.ownerOutputIndex];
  if (!owner) return "INVALID_OWNER_OUTPUT";
  if (classifyScriptPubKey(owner.scriptPubKeyHex) === "UNSUPPORTED") {
    return isOpReturnScript(owner.scriptPubKeyHex) ? "INVALID_OWNER_OUTPUT" : "UNSUPPORTED_SCRIPT";
  }
  // instructionHasCanonicalName has already proven that the Map key and the
  // consensus bytes are the same canonical UTF-8 name.  assetIdByName is the
  // single name index, so its O(1) lookup is equivalent to scanning and
  // re-encoding every key.
  if (state?.assetIdByName.has(instruction.name)) return "DUPLICATE_NAME";
  return "VALID";
}

export function validateTransfer(instruction: TransferInstruction, tx: TransactionContext, state: ProtocolState): ReasonCode {
  const auth = validateAuthorization(tx.inputs[instruction.authInputIndex]);
  if (auth !== "VALID") return auth;
  if (instruction.allocations.length === 0) return "EMPTY_ALLOCATIONS";
  if (instruction.allocations.length > MAX_ALLOCATIONS) return "TOO_MANY_ALLOCATIONS";
  const assetId = state.assetIdByLocator.get(locatorKey(instruction.assetLocator));
  if (!assetId) return "UNKNOWN_ASSET";
  let total = 0n;
  for (const allocation of instruction.allocations) {
    if (!Number.isInteger(allocation.receiverOutputIndex) || allocation.receiverOutputIndex < 0 || allocation.receiverOutputIndex > 0xffff) {
      return "RECEIVER_OUTPUT_INDEX_OUT_OF_RANGE";
    }
    if (allocation.amount <= 0n) return "ZERO_AMOUNT";
    if (allocation.amount > MAX_U128) return "U128_OVERFLOW";
    const receiver = tx.outputs[allocation.receiverOutputIndex];
    if (!receiver) return "INVALID_RECEIVER_OUTPUT";
    if (classifyScriptPubKey(receiver.scriptPubKeyHex) === "UNSUPPORTED") {
      return isOpReturnScript(receiver.scriptPubKeyHex) ? "INVALID_RECEIVER_OUTPUT" : "UNSUPPORTED_SCRIPT";
    }
    total += allocation.amount;
    if (total > MAX_U128) return "U128_OVERFLOW";
  }
  const sender = tx.inputs[instruction.authInputIndex]!;
  const senderBalance = state.balances.get(balanceKey(assetId, deriveAccountKey(sender.prevoutScriptPubKeyHex))) ?? 0n;
  return senderBalance >= total ? "VALID" : "INSUFFICIENT_BALANCE";
}

export function applyDeploy(
  instruction: DeployInstruction,
  tx: TransactionContext,
  state: ProtocolState,
  namePolicy: NamePolicyContext,
): ApplyResult {
  const reason = validateDeploy(instruction, tx, state, namePolicy);
  if (reason !== "VALID") return { status: "NO_OP", reason };
  const owner = tx.outputs[instruction.ownerOutputIndex]!;
  const assetId = deriveAssetId({
    network: instruction.network,
    deployTxid: tx.txid,
    ownerOutputIndex: instruction.ownerOutputIndex,
    canonicalNameBytes: instruction.canonicalNameBytes,
  }, namePolicy);
  const locator = { blockHeight: tx.blockHeight, txIndex: tx.txIndex };
  const asset: AssetRecord = {
    assetId,
    name: instruction.name,
    network: instruction.network,
    totalSupply: instruction.totalSupply,
    deployTxid: tx.txid,
    ownerOutputIndex: instruction.ownerOutputIndex,
    locator,
  };
  state.assetsById.set(assetId, asset);
  state.assetIdByName.set(instruction.name, assetId);
  state.assetIdByLocator.set(locatorKey(locator), assetId);
  state.balances.set(balanceKey(assetId, deriveAccountKey(owner.scriptPubKeyHex)), instruction.totalSupply);
  return { status: "APPLIED", reason: "VALID", assetId };
}

export function applyTransfer(instruction: TransferInstruction, tx: TransactionContext, state: ProtocolState): ApplyResult {
  const reason = validateTransfer(instruction, tx, state);
  if (reason !== "VALID") return { status: "NO_OP", reason };
  const assetId = state.assetIdByLocator.get(locatorKey(instruction.assetLocator))!;
  const senderAccount = deriveAccountKey(tx.inputs[instruction.authInputIndex]!.prevoutScriptPubKeyHex);
  const senderKey = balanceKey(assetId, senderAccount);
  const total = instruction.allocations.reduce((sum, allocation) => sum + allocation.amount, 0n);
  const deltas = new Map<string, bigint>([[senderKey, -total]]);
  for (const allocation of instruction.allocations) {
    const account = deriveAccountKey(tx.outputs[allocation.receiverOutputIndex]!.scriptPubKeyHex);
    const key = balanceKey(assetId, account);
    deltas.set(key, (deltas.get(key) ?? 0n) + allocation.amount);
  }
  for (const [key, delta] of deltas) {
    const next = (state.balances.get(key) ?? 0n) + delta;
    if (next === 0n) state.balances.delete(key);
    else state.balances.set(key, next);
  }
  return { status: "APPLIED", reason: "VALID", assetId };
}

export function serializeCanonicalState(state: ProtocolState): Buffer {
  const compareStrings = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
  const compareCanonicalNames = (left: string, right: string) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
  const compareLocators = ([left]: [string, string], [right]: [string, string]) => {
    const [leftHeight, leftIndex] = left.split(":").map(Number) as [number, number];
    const [rightHeight, rightIndex] = right.split(":").map(Number) as [number, number];
    return leftHeight - rightHeight || leftIndex - rightIndex;
  };
  const canonical = {
    assets: [...state.assetsById.values()]
      .sort((left, right) => compareStrings(left.assetId, right.assetId))
      .map((asset) => ({
        assetId: asset.assetId,
        name: asset.name,
        network: asset.network,
        totalSupply: asset.totalSupply.toString(),
        deployTxid: asset.deployTxid,
        ownerOutputIndex: asset.ownerOutputIndex,
        locator: [asset.locator.blockHeight, asset.locator.txIndex],
      })),
    names: [...state.assetIdByName.entries()].sort(([left], [right]) => compareCanonicalNames(left, right)),
    locators: [...state.assetIdByLocator.entries()].sort(compareLocators),
    balances: [...state.balances.entries()]
      .filter(([, balance]) => balance > 0n)
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([key, balance]) => [key, balance.toString()]),
  };
  return Buffer.from(JSON.stringify(canonical), "utf8");
}

export function deriveStateHash(state: ProtocolState): string {
  return sha256Bytes(serializeCanonicalState(state)).toString("hex");
}

export * from "./op-return.js";
