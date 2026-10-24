import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const packageDir = fileURLToPath(new URL('../packages/protocol/', import.meta.url));
rmSync(new URL('../packages/protocol/dist/', import.meta.url), { recursive: true, force: true });
mkdirSync(new URL('../packages/protocol/dist/', import.meta.url), { recursive: true });
execFileSync(process.execPath, [fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)), '-p', 'tsconfig.json'], { cwd: packageDir, stdio: 'inherit' });
for (const entry of ['index', 'decoder']) {
  await build({ absWorkingDir: packageDir, entryPoints: [`src/${entry}.ts`], outfile: `dist/${entry}.js`, bundle: true, packages: 'external', platform: 'node', format: 'esm', target: 'es2022', sourcemap: false, legalComments: 'eof' });
  await build({ absWorkingDir: packageDir, entryPoints: [`src/${entry}.ts`], outfile: entry === 'index' ? 'dist/browser.js' : 'dist/decoder.browser.js', bundle: true, platform: 'browser', format: 'esm', target: 'es2022', sourcemap: false, legalComments: 'eof' });
}

const notices = ['@noble/hashes', 'buffer', 'base64-js', 'ieee754'].map((name) => {
  const root = new URL(`../node_modules/${name}/`, import.meta.url);
  const metadata = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
  return `${name}@${metadata.version}\n${readFileSync(new URL('LICENSE', root), 'utf8')}`;
}).join('\n\n');
writeFileSync(new URL('../packages/protocol/dist/THIRD_PARTY_LICENSES.txt', import.meta.url), notices + '\n');
