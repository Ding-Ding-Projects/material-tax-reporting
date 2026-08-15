/**
 * Produces the compiled JavaScript entry that Node's own loader resolves.
 *
 * The package's `exports` map offers the TypeScript source to bundlers and this
 * compiled file to Node. Node cannot load a `.ts` file: type stripping arrived
 * in Node 22.18.0 and the toolchain this repository pins is older, so any script
 * Node executes directly would otherwise fail with `ERR_UNKNOWN_FILE_EXTENSION`.
 * See the `//` note in this package's manifest for the whole story, including
 * why no workspace runs this build yet.
 *
 * This step transpiles and bundles; it does not type-check. That is deliberate.
 * A type error must never withhold a release, so the release path may depend on
 * a compiler that produces an artifact and never on a checker that produces a
 * verdict.
 */
import { build } from 'esbuild';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entryPoint = path.join(packageRoot, 'src', 'index.ts');
const outfile = path.join(packageRoot, 'dist', 'index.js');

await build({
  entryPoints: [entryPoint],
  outfile,
  bundle: true,
  // esbuild labels each bundled module with a path relative to its working
  // directory, so without this the bytes differ depending on where the script
  // was invoked from. A consumer's `prebuild` would run it from that consumer's
  // own directory while a developer runs it from the repository root, and both
  // must produce the same artifact — once something folds this file into a
  // bundle, the release path hashes the result.
  absWorkingDir: packageRoot,
  // Unlike the framework-neutral surface kernel, this package genuinely reaches
  // for Node: `src/offline-ocr.ts` imports `node:fs/promises`, `node:module`
  // and `node:path`, so a neutral profile would refuse to resolve them.
  platform: 'node',
  // Keep every third-party dependency an import rather than inlined source.
  // Two of them cannot survive being bundled at all — `@napi-rs/canvas` is a
  // native binding and `tesseract.js` ships worker entry points that the OCR
  // adapter resolves by package name at run time through `createRequire` — and
  // inlining the rest would only bloat an artifact whose dependencies are
  // installed beside it anyway. The assertion below enforces this.
  //
  // Moving the entry from src/ to dist/ does not disturb that run-time
  // resolution: both directories sit one level below the package root, so the
  // only difference in the lookup is a first candidate directory that exists in
  // neither case. Checked by resolving the same specifier through
  // `createRequire` from both locations and comparing the answers.
  packages: 'external',
  format: 'esm',
  target: 'es2022',
  sourcemap: false,
  legalComments: 'none',
});

// Assert against the produced file rather than the exit code. esbuild reporting
// success proves it ran; only the artifact proves anything was written.
const written = await stat(outfile).catch(() => null);
if (!written?.isFile() || written.size === 0) {
  throw new Error(`The slip parser build produced no usable entry at ${outfile}.`);
}

// `packages: 'external'` is one word away from silently producing a very
// different artifact, and the difference is invisible from the exit code. When
// esbuild inlines a dependency it labels the inlined module with its own path
// comment, so a `node_modules` label in the output means a third-party package
// was folded in rather than imported.
const emitted = await readFile(outfile, 'utf8');
const inlined = emitted.match(/^\/\/ .*node_modules[/\\].*$/m);
if (inlined) {
  throw new Error(
    `The slip parser build inlined a third-party package (${inlined[0].trim()}). ` +
      'The compiled entry must import its dependencies rather than bundle them; ' +
      "check that `packages: 'external'` is still set.",
  );
}

process.stdout.write(`slip-parser: wrote ${path.relative(packageRoot, outfile)} (${written.size} bytes)\n`);
