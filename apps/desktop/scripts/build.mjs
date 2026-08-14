import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseChangelog } from '@material-tax-reporting/surface-kernel';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(appRoot, '..', '..');
const distRoot = path.join(appRoot, 'dist');

/** Paths whose commits the packaged changelog record reports. */
const APPLICATION_PATHS = ['apps/desktop', 'docs/features/desktop', 'CHANGELOG.desktop.md'];
const MAX_COMMITS = 500;
const MAX_CHANGELOG_ENTRIES = 5000;

function git(args) {
  return execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8', windowsHide: true }).trim();
}

function repositoryCommit() {
  return git(['rev-parse', 'HEAD']);
}

/**
 * The repository address recorded with the changelog, used only to build a
 * commit link. It is read from the configured origin; when there is none, no
 * link is offered rather than a guessed one.
 */
function repositoryAddress() {
  try {
    const remote = git(['config', '--get', 'remote.origin.url']);
    const https = remote.replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/i, '');
    return /^https:\/\/[^/]+\/[^/]+\/[^/]+$/i.test(https) ? https : null;
  } catch {
    return null;
  }
}

function commitRecords() {
  try {
    const raw = git(['log', `--max-count=${MAX_COMMITS}`, '--date=short', '--format=%H%x1F%ad%x1F%s', '--', ...APPLICATION_PATHS]);
    if (!raw) return [];
    return raw.split('\n').map((line) => {
      const [sha, date, subject] = line.split('\u001f');
      return { sha, date, subject };
    }).filter((entry) => /^[0-9a-f]{40}$/i.test(entry.sha ?? ''));
  } catch {
    return [];
  }
}

await rm(distRoot, { recursive: true, force: true });
await Promise.all([
  mkdir(path.join(distRoot, 'main'), { recursive: true }),
  mkdir(path.join(distRoot, 'preload'), { recursive: true }),
  mkdir(path.join(distRoot, 'renderer'), { recursive: true }),
  mkdir(path.join(distRoot, 'docs'), { recursive: true }),
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

const kernelTokensPath = path.join(repositoryRoot, 'packages', 'surface-kernel', 'src', 'tokens.css');
const [htmlTemplate, rendererSource, styleSource, kernelTokens] = await Promise.all([
  readFile(path.join(appRoot, 'src', 'renderer', 'index.html'), 'utf8'),
  readFile(path.join(appRoot, 'src', 'renderer', 'app.js'), 'utf8'),
  readFile(path.join(appRoot, 'src', 'renderer', 'styles.css'), 'utf8'),
  readFile(kernelTokensPath, 'utf8'),
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
  .replace('/* BUILD:STYLES */', `${kernelTokens}\n${styleSource}`)
  .replace('/* BUILD:SCRIPT */', rendererScript);
await writeFile(path.join(distRoot, 'renderer', 'index.html'), indexHtml, 'utf8');

// --- packaged documentation --------------------------------------------------

const docsSource = path.join(repositoryRoot, 'docs', 'features');
const docsArticles = [];
for (const areaEntry of await readdir(docsSource, { withFileTypes: true })) {
  if (!areaEntry.isDirectory() || !/^[a-z0-9][a-z0-9-]{0,40}$/.test(areaEntry.name)) continue;
  const areaPath = path.join(docsSource, areaEntry.name);
  const targetArea = path.join(distRoot, 'docs', areaEntry.name);
  await mkdir(targetArea, { recursive: true });
  for (const fileEntry of await readdir(areaPath, { withFileTypes: true })) {
    if (!fileEntry.isFile() || !fileEntry.name.endsWith('.md')) continue;
    const slug = fileEntry.name.replace(/\.md$/, '').toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug)) continue;
    const sourceFile = path.join(areaPath, fileEntry.name);
    const info = await stat(sourceFile);
    if (info.size > 512 * 1024) continue;
    await cp(sourceFile, path.join(targetArea, `${slug}.md`));
    const markdown = await readFile(sourceFile, 'utf8');
    const heading = /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim();
    docsArticles.push({
      area: areaEntry.name,
      slug,
      title: heading || slug,
      path: `docs/features/${areaEntry.name}/${fileEntry.name}`,
    });
  }
}
docsArticles.sort((left, right) => `${left.area}/${left.slug}`.localeCompare(`${right.area}/${right.slug}`));
await writeFile(path.join(distRoot, 'docs', 'docs-manifest.json'), `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  articles: docsArticles,
}, null, 2)}\n`, 'utf8');

// --- packaged changelog record ----------------------------------------------

const changelogEntries = [];
for (const name of (await readdir(repositoryRoot)).filter((entry) => /^CHANGELOG\..+\.md$/.test(entry)).sort()) {
  const area = name.replace(/^CHANGELOG\./, '').replace(/\.md$/, '');
  const markdown = await readFile(path.join(repositoryRoot, name), 'utf8');
  changelogEntries.push(...parseChangelog(markdown, area));
  if (changelogEntries.length > MAX_CHANGELOG_ENTRIES) break;
}
await writeFile(path.join(distRoot, 'changelog.json'), `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  repository: repositoryAddress(),
  entries: changelogEntries.slice(0, MAX_CHANGELOG_ENTRIES),
  commits: commitRecords(),
}, null, 2)}\n`, 'utf8');

const commit = repositoryCommit();
await writeFile(path.join(distRoot, 'build-provenance.json'), `${JSON.stringify({
  schemaVersion: 1,
  commit,
  application: '@material-tax-reporting/desktop',
  outputs: [
    'dist/main/main.js',
    'dist/preload/index.cjs',
    'dist/renderer/index.html',
    'dist/changelog.json',
    'dist/docs/docs-manifest.json',
    ...docsArticles.map((article) => `dist/docs/${article.area}/${article.slug}.md`),
  ],
}, null, 2)}\n`, 'utf8');
