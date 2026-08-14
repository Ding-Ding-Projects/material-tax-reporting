import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(appRoot, '..', '..');
const distRoot = path.join(appRoot, 'dist');

function repositoryCommit() {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
}

await rm(distRoot, { recursive: true, force: true });
await Promise.all([
  mkdir(path.join(distRoot, 'main'), { recursive: true }),
  mkdir(path.join(distRoot, 'preload'), { recursive: true }),
  mkdir(path.join(distRoot, 'renderer'), { recursive: true }),
]);

await build({
  entryPoints: [path.join(appRoot, 'src', 'main', 'main.js')],
  outfile: path.join(distRoot, 'main', 'main.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  sourcemap: false,
  legalComments: 'none',
});

await build({
  entryPoints: [path.join(appRoot, 'src', 'preload', 'index.js')],
  outfile: path.join(distRoot, 'preload', 'index.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  sourcemap: false,
  legalComments: 'none',
});

const [htmlTemplate, rendererSource, styleSource] = await Promise.all([
  readFile(path.join(appRoot, 'src', 'renderer', 'index.html'), 'utf8'),
  readFile(path.join(appRoot, 'src', 'renderer', 'app.js'), 'utf8'),
  readFile(path.join(appRoot, 'src', 'renderer', 'styles.css'), 'utf8'),
]);
const rendererBuild = await build({
  stdin: { contents: rendererSource, resolveDir: path.join(appRoot, 'src', 'renderer'), sourcefile: 'app.js' },
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'chrome142',
  write: false,
  minify: false,
  legalComments: 'none',
});
const rendererScript = rendererBuild.outputFiles[0].text.replaceAll('</script', '<\\/script');
const indexHtml = htmlTemplate
  .replace('/* BUILD:STYLES */', styleSource)
  .replace('/* BUILD:SCRIPT */', rendererScript);
await writeFile(path.join(distRoot, 'renderer', 'index.html'), indexHtml, 'utf8');

const commit = repositoryCommit();
await writeFile(path.join(distRoot, 'build-provenance.json'), `${JSON.stringify({
  schemaVersion: 1,
  commit,
  application: '@material-tax-reporting/desktop',
  outputs: [
    'dist/main/main.js',
    'dist/preload/index.cjs',
    'dist/renderer/index.html',
  ],
}, null, 2)}\n`, 'utf8');
