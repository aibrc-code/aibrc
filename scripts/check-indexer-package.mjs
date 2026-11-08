import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), 'aibrc-indexer-package-'));
try {
  const archives = ['@aibrc/protocol', '@aibrc/indexer'].map(workspace => {
    const packed = JSON.parse(execFileSync('npm', ['pack', '--workspace', workspace,
      '--pack-destination', temporary, '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8' }));
    assert.equal(packed.length, 1);
    assert.ok(packed[0].files.every(file => !file.path.includes('node_modules/')));
    return join(temporary, packed[0].filename);
  });
  const consumer = join(temporary, 'consumer');
  execFileSync(process.execPath, ['-e', "require('node:fs').mkdirSync(process.argv[1])", consumer]);
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  // Registry downloads and lifecycle installation scripts are both disabled.
  execFileSync('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', ...archives], { cwd: consumer, stdio: 'inherit' });
  execFileSync('npm', ['exec', '--offline', '--no', '--', 'aibrc-indexer', '--help'], { cwd: consumer, stdio: 'inherit' });
  const installed = join(consumer, 'node_modules/@aibrc/indexer/dist');
  assert.equal(readFileSync(join(installed, 'release.json'), 'utf8'), readFileSync(join(root, 'config/release.json'), 'utf8'));
  const sdk = join(consumer, 'node_modules/@aibrc/protocol/dist');
  const result = spawnSync(process.execPath, ['--test', join(root, 'packages/indexer/test/indexer.test.mjs')], {
    cwd: consumer, stdio: 'inherit', timeout: 120_000,
    env: { ...process.env, INDEXER_TEST_MODULE: pathToFileURL(join(installed, 'index.js')).href,
      INDEXER_TEST_CLI: join(installed, 'cli.js'), INDEXER_TEST_SDK: pathToFileURL(join(sdk, 'index.js')).href,
      INDEXER_TEST_DECODER: pathToFileURL(join(sdk, 'decoder.js')).href },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, 'Installed package must pass the same isolated runtime tests');
} finally { rmSync(temporary, { recursive: true, force: true }); }
