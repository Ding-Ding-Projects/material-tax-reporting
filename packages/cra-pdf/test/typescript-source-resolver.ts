/**
 * Lets a test import this package's TypeScript sources directly.
 *
 * The sources are written for a bundler and reference their siblings with the
 * compiled `.js` extension. Node runs the `.ts` files as written, so this hook
 * rewrites a relative `.js` specifier to the `.ts` file beside it when, and
 * only when, that file exists. It changes nothing about how the package is
 * built or published; it exists so the suites below can exercise the real
 * calculation instead of a copy of it.
 *
 * Without it, `node --test` resolves `./rules.js` literally and dies on the
 * first import with ERR_MODULE_NOT_FOUND naming a file that was never meant to
 * exist in a source checkout. This is the same hook the local-coding-assistants
 * suite installs, kept per package so neither can quietly change the other.
 */

import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

let installed = false;

export function useTypeScriptSources(): void {
  if (installed) return;
  installed = true;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.startsWith(".") && specifier.endsWith(".js") && context.parentURL) {
        const candidate = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);
        if (candidate.protocol === "file:" && existsSync(fileURLToPath(candidate))) {
          return nextResolve(candidate.href, context);
        }
      }
      return nextResolve(specifier, context);
    },
  });
}
