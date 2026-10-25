import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('packed Node and explicit browser entry points resolve strict TypeScript types', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const stage = mkdtempSync(join(tmpdir(), 'aibrc-package-types-'));
  try {
    const packed = JSON.parse(execFileSync('npm', [
      'pack', '--workspace', '@aibrc/protocol', '--ignore-scripts',
      '--json', '--pack-destination', stage,
    ], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
    const consumer = join(stage, 'consumer');
    const installed = join(consumer, 'node_modules', '@aibrc', 'protocol');
    mkdirSync(installed, { recursive: true });
    execFileSync('tar', ['-xzf', join(stage, packed[0].filename), '--strip-components=1', '-C', installed]);
    for (const dependency of ['@noble/hashes', 'buffer', 'base64-js', 'ieee754']) {
      cpSync(join(root, 'node_modules', dependency), join(consumer, 'node_modules', dependency), { recursive: true });
    }
    writeFileSync(join(consumer, 'package.json'), '{"private":true,"type":"module"}\n');
    const fixture = (suffix: string) => `
import { createProtocolState, deriveStateHash } from '@aibrc/protocol${suffix}';
import { decodeBitcoinTransaction } from '@aibrc/protocol/decoder${suffix}';
const hash: string = deriveStateHash(createProtocolState());
const decoder: typeof import('@aibrc/protocol/decoder').decodeBitcoinTransaction = decodeBitcoinTransaction;
void [hash, decoder];
`;
    writeFileSync(join(consumer, 'node-entry.ts'), fixture(''));
    writeFileSync(join(consumer, 'browser-entry.ts'), fixture('/browser'));
    const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
    for (const [module, resolution, conditions] of [
      ['NodeNext', 'NodeNext', []],
      ['ESNext', 'Bundler', ['--customConditions', 'browser']],
    ] as const) {
      for (const entry of ['node-entry.ts', 'browser-entry.ts']) {
        const result = spawnSync(process.execPath, [
          tsc, '--module', module, '--moduleResolution', resolution,
          '--target', 'ES2022', '--lib', 'ES2022,DOM', '--strict',
          '--skipLibCheck', '--noEmit', ...conditions, entry,
        ], { cwd: consumer, encoding: 'utf8' });
        assert.equal(result.status, 0, `${resolution} ${entry}:\n${result.stdout}\n${result.stderr}`);
      }
    }
    const metadata = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
    assert.equal(metadata.name, '@aibrc/protocol');
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
});
