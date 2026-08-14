/**
 * Build configuration for the render smoke check.
 *
 * It shares the application's package aliases so the workspace packages resolve
 * the same way they do in the published build, and writes a server bundle that
 * can be run with Node.
 */

import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const applicationRoot = fileURLToPath(new URL("../..", import.meta.url));

const packageEntry = (name: string) =>
  fileURLToPath(new URL(`../../../../packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  root: applicationRoot,
  resolve: {
    alias: [
      { find: /^@material-tax-reporting\/surface-kernel$/, replacement: packageEntry("surface-kernel") },
      { find: /^@material-tax-reporting\/local-ollama$/, replacement: packageEntry("local-ollama") },
    ],
  },
  plugins: [react()],
  build: {
    ssr: "./src/checks/render-smoke.entry.tsx",
    outDir: "dist/render-smoke",
    emptyOutDir: true,
    minify: false,
  },
});
