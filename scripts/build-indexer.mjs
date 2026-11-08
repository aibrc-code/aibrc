import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const dir = fileURLToPath(new URL('packages/indexer/', root));
rmSync(new URL('packages/indexer/dist/', root), { recursive: true, force: true });
mkdirSync(new URL('packages/indexer/dist/', root), { recursive: true });
execFileSync(process.execPath, [fileURLToPath(new URL('node_modules/typescript/bin/tsc', root)), '-p', 'tsconfig.json'], { cwd: dir, stdio: 'inherit' });
for (const name of ['cli', 'index']) {
  await build({ absWorkingDir: dir, entryPoints: [`src/${name}.ts`], outfile: `dist/${name}.js`,
    bundle: true, packages: 'external', platform: 'node', format: 'esm', target: 'node22.16', sourcemap: false,
    legalComments: 'eof' });
}
// The one published release source is copied verbatim, never independently edited.
copyFileSync(new URL('config/release.json', root), new URL('packages/indexer/dist/release.json', root));
