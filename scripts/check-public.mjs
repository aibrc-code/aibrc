import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const excluded = new Set(['node_modules', 'dist', '.git', '.docs-venv', 'site-build', '__pycache__']);
function files(dir) {
  return readdirSync(dir).flatMap(name => {
    if (excluded.has(name) || name.endsWith('.tgz')) return [];
    const path = resolve(dir, name);
    const stat = lstatSync(path);
    assert.ok(!stat.isSymbolicLink(), 'Public source must not contain a symlink');
    return stat.isDirectory() ? files(path) : [path];
  });
}
const read = path => readFileSync(resolve(root, path), 'utf8');
const slug = text => text.toLowerCase().replace(/<[^>]*>/g, '').replace(/[`*_]/g, '')
  .replace(/[^\p{L}\p{N} _-]/gu, '').replace(/ /g, '-');
function anchors(path) {
  if (!path.endsWith('.md')) return null;
  let fence = false;
  const result = new Set(), seen = new Map();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (/^\s*```/.test(line)) { fence = !fence; continue; }
    const match = !fence && /^#{1,6}\s+(.+?)\s*#*$/.exec(line);
    if (!match) continue;
    const base = slug(match[1]), n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    result.add(base + (n ? '-' + n : ''));
  }
  return result;
}
const all = files(root);
const names = all.map(path => relative(root, path).replaceAll('\\', '/'));
const required = ['README.md', 'LICENSE-CODE', 'LICENSE-DOCS', 'TRUST_MODEL.md',
  'CONTRIBUTING.md', 'THIRD_PARTY_NOTICES.md', 'docs/glossary.md',
  'spec/AIBRC_PROTOCOL_V0.25.md', 'spec/naming-policy.md', 'spec/reason-codes.md',
  'spec/covenants/R1.md', 'spec/covenants/X1.md', 'merkle/STATE_PROOF_REFERENCE.md',
  'site/mkdocs.yml', 'site/source_files.py', 'site/requirements.txt',
  'config/release.json', 'config/network.example.json',
  ...['00-overview', '01-introduction', '02-protocol-model', '03-instructions',
    '04-smart-covenant', '05-cross-protocol', '06-indexer-guide', '07-applications',
    '08-extensions', '99-closing'].map(name => 'docs/' + name + '.md')];
for (const name of required) assert.ok(names.includes(name), 'Missing ' + name);
assert.ok(!existsSync(resolve(root, 'SECURITY.md')), 'Legacy trust document remains');
const forbidden = /(?:\/(?:home|srv|etc|run)\/[A-Za-z0-9._-]+\/|postgres(?:ql)?:\/\/|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bxprv[1-9A-HJ-NP-Za-km-z]{40,}|\bgh[pousr]_[A-Za-z0-9]{20,})/;
for (const path of all) assert.ok(!forbidden.test(readFileSync(path, 'utf8')), 'Private marker: ' + relative(root, path));
let links = 0;
for (const path of all.filter(name => name.endsWith('.md'))) {
  const text = readFileSync(path, 'utf8');
  assert.ok(!/\p{Script=Han}/u.test(text), 'Non-English main text: ' + relative(root, path));
  assert.ok(!/address[- ]level|address account|SECURITY_CONTACT|MIT (?:draft|license draft)/i.test(text), 'Retired terminology: ' + relative(root, path));
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const raw = match[1].split(/\s+"/)[0].replace(/^<|>$/g, '');
    if (/^(?:https?:|mailto:)/.test(raw)) continue;
    const [linkPath, anchor] = raw.split('#');
    const target = linkPath ? resolve(dirname(path), decodeURIComponent(linkPath)) : path;
    assert.ok(target === root || target.startsWith(root + '/'), 'Link escapes package');
    assert.ok(existsSync(target), 'Missing link ' + relative(root, path) + ' -> ' + raw);
    assert.ok(lstatSync(target).isFile(), 'Use an explicit file link instead of a directory: ' + raw);
    const headings = anchor && anchors(target);
    if (headings) assert.ok(headings.has(decodeURIComponent(anchor)), 'Missing anchor ' + relative(root, path) + ' -> ' + raw);
    links++;
  }
}
const aip = names.filter(name => /^proposals\/AIP-\d{4}-.*\.md$/.test(name));
const apps = names.filter(name => /^docs\/applications\/.*\.md$/.test(name));
assert.equal(aip.length, 7);
assert.equal(apps.length, 14);
const release = JSON.parse(read('config/release.json'));
assert.deepEqual(Object.keys(release).sort(), ['protocolVersion', 'bitcoinNetwork', 'genesisHeight', 'namePolicyVersion', 'inputAuthorizationRuleId'].sort(), 'Unexpected release fields');
assert.equal(release.protocolVersion, '0.25', 'Unexpected protocol release version');
assert.equal(release.bitcoinNetwork, 'mainnet', 'Unexpected release network');
assert.equal(release.namePolicyVersion, 2, 'Unexpected release name policy');
assert.equal(release.inputAuthorizationRuleId, 'aibrc-input-authorization/bip341-keypath-v1', 'Unexpected authorization identity');
assert.ok(Object.hasOwn(release, 'genesisHeight'), 'Missing genesisHeight');
assert.ok(release.genesisHeight === null ||
  (Number.isInteger(release.genesisHeight) && release.genesisHeight >= 0 && release.genesisHeight <= 0xffffffff),
  'genesisHeight must be null or an unsigned 32-bit integer');
const reference = JSON.parse(read('config/network.example.json'));
assert.equal(reference.releaseFile, './release.json', 'Example must reference the single release source');
assert.ok(!Object.hasOwn(reference, 'genesisHeight') && !Object.hasOwn(reference, 'namePolicy'), 'Example must not duplicate release heights');
const r1 = /## Complete frozen English text[\s\S]*?```text\n([\s\S]*?)```/.exec(read('spec/covenants/R1.md'))?.[1];
assert.ok(r1, 'Missing frozen R1 block');
assert.equal(Buffer.byteLength(r1), 7340, 'R1 byte length');
assert.equal(createHash('sha256').update(r1).digest('hex'), '3c0b91af6cbfce5ea8eb8c6d1174c117ff34233695f480f5e6c9b3db7ddaa73b', 'Frozen R1 changed');
assert.equal(read('packages/protocol/LICENSE'), read('LICENSE-CODE'), 'SDK license differs');
console.log(JSON.stringify({ publicSourceFiles: names.length, relativeLinksChecked: links,
  proposals: aip.length, applicationPages: apps.length, frozenR1Bytes: Buffer.byteLength(r1),
  releaseParameters: release.genesisHeight === null ? 'NOT_SELECTED' : 'CONFIGURED',
  genesisHeight: release.genesisHeight, namePolicyActivationHeight: release.genesisHeight,
  privateMarkerMatches: 0, scope: 'Static public-content consistency, not a security audit' }));
