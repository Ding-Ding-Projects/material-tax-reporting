import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { generatedContent } from "./build/sites-vite-plugin.ts";

const packageEntry = (name: string) =>
  fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  base: "/material-tax-reporting/",
  // The generated-content plugin runs first so the documentation and changelog
  // modules exist before the module graph is walked.
  plugins: [generatedContent(), react()],
  resolve: {
    // The workspace packages are linked into this application only. Resolving
    // them by absolute path lets one package import another without every
    // package directory carrying its own installed copy.
    alias: [
      { find: /^@material-tax-reporting\/surface-kernel$/, replacement: packageEntry("surface-kernel") },
      { find: /^@material-tax-reporting\/local-ollama$/, replacement: packageEntry("local-ollama") },
    ],
  },
  build: {
    outDir: "dist/pages",
    emptyOutDir: true,
  },
});
