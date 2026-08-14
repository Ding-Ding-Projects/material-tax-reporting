'use strict';

/**
 * The offline documentation library.
 *
 * Articles are copied into the packaged resources by the build script. At run
 * time they are located with the same bounded, allowlisted discipline the
 * packaged offline runtime lookup uses: a fixed list of candidate roots, an
 * evidence file that has to exist, and a strict name pattern so nothing
 * outside the packaged root can ever be read.
 *
 * No process is started here, and no network access takes place.
 */

const fs = require('node:fs');
const path = require('node:path');

const MANIFEST_NAME = 'docs-manifest.json';
const MAX_ARTICLE_BYTES = 512 * 1024;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,80}$/;
const AREA_PATTERN = /^[a-z0-9][a-z0-9-]{0,40}$/;

class DocsLibrary {
  constructor({ resourcesPath, appPath }) {
    this.candidates = [...new Set([
      path.join(resourcesPath, 'docs'),
      path.join(resourcesPath, 'resources', 'docs'),
      path.join(appPath, 'dist', 'docs'),
      path.join(appPath, 'docs'),
      path.resolve(appPath, '..', 'docs'),
    ].map((candidate) => path.resolve(candidate)))];
    this.resolved = undefined;
  }

  root() {
    if (this.resolved !== undefined) return this.resolved;
    this.resolved = null;
    for (const candidate of this.candidates) {
      const manifest = path.join(candidate, MANIFEST_NAME);
      try {
        if (fs.statSync(manifest).isFile()) { this.resolved = candidate; break; }
      } catch {
        continue;
      }
    }
    return this.resolved;
  }

  manifest() {
    const root = this.root();
    if (!root) return null;
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(root, MANIFEST_NAME), 'utf8'));
      if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.articles)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  /** Lists the packaged articles, or reports honestly that none are packaged. */
  list() {
    const manifest = this.manifest();
    if (!manifest) {
      return {
        available: false,
        articles: [],
        searchedLocations: this.candidates,
        missing: 'No packaged documentation manifest was found in any packaged resource location. Run the application build to generate one.',
      };
    }
    const articles = manifest.articles
      .filter((article) => article && SLUG_PATTERN.test(String(article.slug)) && AREA_PATTERN.test(String(article.area)))
      .map((article) => ({
        slug: String(article.slug),
        area: String(article.area),
        title: String(article.title ?? article.slug).slice(0, 160),
        path: String(article.path ?? '').slice(0, 200),
      }));
    return { available: true, articles, searchedLocations: this.candidates, missing: null, generatedAt: manifest.generatedAt ?? null };
  }

  /** Reads one packaged article by area and slug. */
  read(area, slug) {
    const listing = this.list();
    if (!listing.available) return { ok: false, reason: listing.missing, markdown: null };
    const entry = listing.articles.find((article) => article.area === area && article.slug === slug);
    if (!entry) {
      return { ok: false, reason: `No packaged article is named "${String(area)}/${String(slug)}".`, markdown: null };
    }
    const root = this.root();
    const filePath = path.join(root, entry.area, `${entry.slug}.md`);
    if (path.relative(root, filePath).startsWith('..')) {
      return { ok: false, reason: 'That article path resolves outside the packaged documentation root.', markdown: null };
    }
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile() || stat.size > MAX_ARTICLE_BYTES) {
        return { ok: false, reason: 'That packaged article is missing or exceeds its size limit.', markdown: null };
      }
      return { ok: true, reason: null, area: entry.area, slug: entry.slug, title: entry.title, markdown: fs.readFileSync(filePath, 'utf8') };
    } catch {
      return { ok: false, reason: 'That packaged article could not be read.', markdown: null };
    }
  }
}

module.exports = { DocsLibrary, MANIFEST_NAME, MAX_ARTICLE_BYTES };
