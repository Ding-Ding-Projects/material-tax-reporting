import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, stat, symlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run this suite with npm run test:package-builds.');

function run(args, cwd) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

for (const name of ['tax-domain', 'cra-pdf', 'local-ollama']) {
  test(`${name} builds from source with its declared compiler`, async (context) => {
    const source = path.join(root, 'packages', name);
    const manifest = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
    // A hoisted compiler from another workspace must not hide a missing dependency.
    assert.match(manifest.devDependencies?.typescript ?? '', /^\d+\.\d+\.\d+$/);
    const require = createRequire(path.join(source, 'package.json'));
    assert.equal(require('typescript/package.json').version, manifest.devDependencies.typescript);

    const fixture = await mkdtemp(path.join(os.tmpdir(), `package-build-${name}-`));
    context.after(() => rm(fixture, { recursive: true, force: true }));
    for (const entry of ['package.json', 'tsconfig.json', 'src']) {
      await cp(path.join(source, entry), path.join(fixture, entry), { recursive: true });
    }
    await symlink(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'junction');
    // Invoke the actual package script with no pre-existing dist or TypeScript loader.
    run([npmCli, 'run', 'build', '--workspaces=false'], fixture);
    for (const entry of ['dist/index.js', 'dist/index.d.ts']) {
      assert.ok((await stat(path.join(fixture, entry))).size > 0, `${name}: ${entry} is empty`);
    }
    // The two compiled-entry packages must resolve by their public names. Ollama
    // is consumed as TypeScript by bundlers; check its emitted JavaScript directly.
    const entry = name === 'local-ollama' ? './dist/index.js' : manifest.name;
    run([
      '--no-experimental-strip-types', '--input-type=module', '-e',
      `const built = await import(${JSON.stringify(entry)}); if (!Object.keys(built).length) throw new Error('Empty package entry');`,
    ], fixture);
  });
}
