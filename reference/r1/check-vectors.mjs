// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as r1 from './index.mjs';

const ARTIFACTS = new URL('./artifacts/', import.meta.url);
const MANIFEST_FILE_SHA256 = '1b56df40041bb9ff99ef1966a9e2b7bdcf8bf2ece478deb3c33516cdf6eb4a6f';
const INIT_CODE_HASH = '0x63e052342164ef3c4fe9669d29f00c9ff789097a409dc81a64557e4d9ff9f029';
const functions = Object.freeze({
  isValidRule: r1.isValidRule,
  ceilBps: r1.ceilBps,
  quoteUserBuy: r1.quoteUserBuy,
  quoteUserSell: r1.quoteUserSell,
  routeRuleFee: r1.routeRuleFee,
  planBuyback: r1.planBuyback,
});

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const serializable = (value) => JSON.parse(JSON.stringify(value,
  (_key, entry) => typeof entry === 'bigint' ? entry.toString() : entry));

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function checkManifest(value) {
  const { manifestSha256, ...body } = value;
  assert.equal(sha256(canonicalJson(body)), manifestSha256, 'canonical manifest identity');
}

export function checkArtifacts(directory = ARTIFACTS) {
  const read = (name) => readFileSync(new URL(name, directory));
  const json = (name) => JSON.parse(read(name));
  const manifestBytes = read('artifact-hashes.json');
  assert.equal(sha256(manifestBytes), MANIFEST_FILE_SHA256, 'frozen artifact manifest');
  const manifest = JSON.parse(manifestBytes);
  checkManifest(manifest);
  assert.deepEqual(readdirSync(directory).sort(), [...Object.keys(manifest.files), 'artifact-hashes.json'].sort());
  for (const [name, digest] of Object.entries(manifest.files)) {
    assert.equal(sha256(read(name)), digest, `SHA-256: ${name}`);
  }

  const build = json('build-manifest.json');
  const deployment = json('deployment-manifest.json');
  const release = json('release.json');
  const input = json('standard-input.json');
  const output = json('standard-output.json');
  const contract = output.contracts['AIBTCInscription.sol'].AIBTCInscription;
  const text = read('inscription.en.txt').toString('utf8');
  const textSource = read('InscriptionText.sol').toString('utf8');
  const embeddedText = textSource.match(/^string constant TEXT = (".*");$/m);
  assert.ok(embeddedText, 'embedded text source');
  assert.equal(JSON.parse(embeddedText[1]), text);
  const textHash = r1.INSCRIPTION_TEXT_SHA256.slice(2);
  assert.equal(sha256(text), textHash, 'frozen English text');
  assert.ok(textSource.includes(`bytes32 constant TEXT_SHA256 = hex"${textHash}";`));
  assert.equal(build.statuteTextSha256, textHash);
  assert.equal(build.translationSha256, sha256(read('inscription.zh-CN.txt')));
  assert.equal(build.vectorsSha256, sha256(read('vectors.json')));
  assert.equal(build.abiSha256, sha256(canonicalJson(json('abi.json'))));
  for (const [name, digest] of Object.entries(build.sourceHashes)) {
    assert.equal(sha256(read(name)), digest, `source: ${name}`);
    assert.equal(input.sources[name].content, read(name).toString('utf8'));
  }
  const { outputSelection: _selection, ...settings } = input.settings;
  assert.equal(sha256(canonicalJson(settings)), build.compiler.settingsSha256);
  assert.equal(build.compiler.version, '0.8.36+commit.8a079791.Emscripten.clang');
  assert.equal(build.contractName, 'AIBTCInscription');
  checkManifest(build);
  checkManifest(deployment);
  assert.equal(build.manifestSha256, r1.BUILD_MANIFEST_SHA256);
  assert.equal(deployment.buildManifestSha256, build.manifestSha256);
  assert.equal(deployment.target, r1.INSCRIPTION_ADDRESS);
  assert.equal(build.runtimeCodeHash, r1.RUNTIME_CODE_HASH);
  assert.equal(build.initCodeHash, INIT_CODE_HASH);

  const runtimeCode = read('runtime.hex').toString('utf8').trim();
  const initCode = read('creation.hex').toString('utf8').trim();
  assert.equal(runtimeCode, `0x${contract.evm.deployedBytecode.object}`);
  assert.equal(initCode, `0x${contract.evm.bytecode.object}`);
  assert.equal(BigInt((runtimeCode.length - 2) / 2).toString(), build.runtimeCodeBytes);
  assert.equal(BigInt((initCode.length - 2) / 2).toString(), build.initCodeBytes);
  assert.deepEqual(contract.abi, json('abi.json'));
  assert.deepEqual(release.abi, contract.abi);
  assert.deepEqual(release.buildManifest, build);
  assert.deepEqual(release.deploymentManifest, deployment);
  assert.equal(release.statuteText, text);
  assert.equal(release.runtimeCode, runtimeCode);
  assert.equal(release.initCode, initCode);
  return { files: Object.keys(manifest.files).length + 1, sha256Files: Object.keys(manifest.files).length };
}

export function readVectors() {
  const document = JSON.parse(readFileSync(new URL('vectors.json', ARTIFACTS)));
  assert.equal(document.schemaVersion, '1');
  assert.equal(document.cases.length, 68);
  assert.equal(new Set(document.cases.map(({ id }) => id)).size, 68);
  return document;
}

export function checkVector(vector) {
  const { id, function: name, args } = vector;
  assert.ok(Object.hasOwn(functions, name), `known function: ${id}`);
  assert.equal(args.length, functions[name].length, `argument count: ${id}`);
  const decoded = args.map((value) => {
    if (typeof value === 'boolean') return value;
    assert.equal(typeof value, 'string', `decimal string: ${id}`);
    assert.match(value, /^(?:0|[1-9][0-9]*)$/, `canonical integer: ${id}`);
    return BigInt(value);
  });
  const invoke = () => functions[name](...decoded);
  assert.notEqual(Object.hasOwn(vector, 'expected'), Object.hasOwn(vector, 'error'), `one outcome: ${id}`);
  if (Object.hasOwn(vector, 'error')) {
    assert.equal(vector.error, true);
    assert.throws(invoke, r1.R1Error, id);
  } else {
    assert.deepEqual(serializable(invoke()), vector.expected, id);
  }
}

export function checkVectors() {
  const { cases } = readVectors();
  for (const vector of cases) checkVector(vector);
  const rejected = cases.filter((vector) => Object.hasOwn(vector, 'error')).length;
  assert.equal(rejected, 18);
  return { cases: cases.length, results: cases.length - rejected, rejected };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  console.log(JSON.stringify({ artifacts: checkArtifacts(), vectors: checkVectors() }, null, 2));
}
