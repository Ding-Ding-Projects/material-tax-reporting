'use strict';

/**
 * The packaged changelog record.
 *
 * The build script parses the tracked changelog files and records the commit
 * history for the application paths. No version-control process is ever
 * started at application run time: this module only reads the bounded JSON
 * record the build produced, from an allowlisted packaged location.
 *
 * Entries are presented exactly as generated, including any statement about
 * which checks were and were not run. Nothing here labels a release, a tag or
 * a verified build.
 */

const fs = require('node:fs');
const path = require('node:path');

const RECORD_NAME = 'changelog.json';
const MAX_RECORD_BYTES = 2 * 1024 * 1024;
const MAX_ENTRIES = 5000;
const MAX_COMMITS = 2000;

class ChangelogLibrary {
  constructor({ resourcesPath, appPath }) {
    this.candidates = [...new Set([
      path.join(resourcesPath, RECORD_NAME),
      path.join(resourcesPath, 'resources', RECORD_NAME),
      path.join(appPath, 'dist', RECORD_NAME),
      path.join(appPath, RECORD_NAME),
    ].map((candidate) => path.resolve(candidate)))];
    this.cached = undefined;
  }

  load() {
    if (this.cached !== undefined) return this.cached;
    this.cached = {
      available: false,
      generatedAt: null,
      repository: null,
      entries: [],
      commits: [],
      areas: [],
      searchedLocations: this.candidates,
      missing: 'No packaged changelog record was found in any packaged resource location. Run the application build to generate one.',
    };
    for (const candidate of this.candidates) {
      try {
        const stat = fs.statSync(candidate);
        if (!stat.isFile() || stat.size > MAX_RECORD_BYTES) continue;
        const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.entries)) continue;
        const entries = parsed.entries.slice(0, MAX_ENTRIES).filter((entry) => entry && typeof entry.entry === 'string');
        this.cached = {
          available: true,
          generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : null,
          repository: typeof parsed.repository === 'string' ? parsed.repository : null,
          entries,
          commits: Array.isArray(parsed.commits) ? parsed.commits.slice(0, MAX_COMMITS) : [],
          areas: [...new Set(entries.map((entry) => String(entry.area)))].sort(),
          searchedLocations: this.candidates,
          missing: null,
        };
        break;
      } catch {
        continue;
      }
    }
    return this.cached;
  }
}

module.exports = { ChangelogLibrary, MAX_RECORD_BYTES, RECORD_NAME };
