"use client";

/**
 * The changelog viewer.
 *
 * Entries are parsed at build time from the tracked changelog files, so this
 * view cannot drift from the repository. A commit link is rendered only where
 * the kernel produced one from a real recorded identifier; a missing identifier
 * shows no link rather than a guessed address.
 */

import { type ChangelogEntry, commitUrl, filterChangelogEntries, matchesSearch } from "@material-tax-reporting/surface-kernel";
import { type ReactNode, useMemo } from "react";
import { CHANGELOG_AREAS, CHANGELOG_ENTRIES, CHANGELOG_REPOSITORY } from "./data/changelog.ts";
import { CompactSearchWithBuilder, SearchWithBuilder, type SearchBinding } from "./search-builder.tsx";
import { type ExportRequest } from "./exports.ts";

export type ChangelogRange = {
  from: string;
  to: string;
};

export const EMPTY_RANGE: ChangelogRange = { from: "", to: "" };

/** The export shape for the filtered changelog view. */
export function changelogExportRequest(
  entries: readonly ChangelogEntry[],
  filterDescription: string,
): ExportRequest {
  return {
    collection: "Changelog",
    filterDescription,
    columns: [
      { key: "area", label: "Area" },
      { key: "version", label: "Release" },
      { key: "date", label: "Date" },
      { key: "section", label: "Section" },
      { key: "entry", label: "Entry" },
      { key: "commit", label: "Commit" },
      { key: "verification", label: "Verification" },
    ],
    rows: entries.map((entry) => ({
      area: entry.area,
      version: entry.version,
      date: entry.date ?? "",
      section: entry.section,
      entry: entry.entry,
      commit: entry.commit ?? "",
      verification: entry.verification ?? "",
    })),
    format: "markdown",
  };
}

export function ChangelogViewer({
  search,
  areaFilter,
  range,
  onRangeChange,
  onExport,
  copy,
}: {
  search: SearchBinding;
  areaFilter: SearchBinding;
  range: ChangelogRange;
  onRangeChange: (range: ChangelogRange) => void;
  onExport: (request: ExportRequest) => void;
  copy: (key: string) => string;
}): ReactNode {
  const areas = useMemo(
    () => CHANGELOG_AREAS.filter((area) => matchesSearch(area, areaFilter.state)),
    [areaFilter.state],
  );

  const entries = useMemo(
    () =>
      filterChangelogEntries(
        CHANGELOG_ENTRIES,
        {
          areas,
          ...(range.from ? { from: range.from } : {}),
          ...(range.to ? { to: range.to } : {}),
        },
        search.state,
      ),
    [areas, range.from, range.to, search.state],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, ChangelogEntry[]>>();
    for (const entry of entries) {
      const byRelease = map.get(entry.area) ?? new Map<string, ChangelogEntry[]>();
      byRelease.set(entry.version, [...(byRelease.get(entry.version) ?? []), entry]);
      map.set(entry.area, byRelease);
    }
    return [...map.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [entries]);

  const filterDescription = `Search: ${search.state.regex ? search.state.pattern : search.state.query || "none"}; areas: ${areas.join("|") || "none"}; from: ${range.from || "any"}; to: ${range.to || "any"}`;

  return (
    <div className="changelog-view">
      <SearchWithBuilder {...search} visibleCount={entries.length} totalCount={CHANGELOG_ENTRIES.length} />
      <div className="changelog-filters">
        <div id="changelog-area-filter" tabIndex={-1}>
          <p className="field-label">Areas</p>
          <CompactSearchWithBuilder {...areaFilter} />
          <p className="filter-summary">{areas.join(", ") || "No area matches the filter."}</p>
        </div>
        <div className="date-range">
          <label className="field-label" htmlFor="changelog-from">
            Dated on or after
          </label>
          <input
            id="changelog-from"
            type="date"
            value={range.from}
            onChange={(event) => onRangeChange({ ...range, from: event.target.value })}
          />
          <label className="field-label" htmlFor="changelog-to">
            Dated on or before
          </label>
          <input
            id="changelog-to"
            type="date"
            value={range.to}
            onChange={(event) => onRangeChange({ ...range, to: event.target.value })}
          />
          <small>
            A release heading without a date is excluded while a date range is set, because its date is
            unknown rather than assumed.
          </small>
        </div>
      </div>

      <button
        type="button"
        className="outlined-button"
        onClick={() => onExport(changelogExportRequest(entries, filterDescription))}
      >
        Export the filtered view
      </button>

      {grouped.length === 0 && (
        <div className="empty-state">
          <h3>{copy("docs.emptyTitle")}</h3>
          <p>{copy("docs.emptyBody")}</p>
        </div>
      )}

      {grouped.map(([area, releases]) => (
        <section key={area} id={`changelog-area-${area}`} tabIndex={-1} aria-labelledby={`changelog-${area}-title`}>
          <h2 id={`changelog-${area}-title`}>{area}</h2>
          {[...releases.entries()].map(([version, items]) => (
            <article key={version} className="changelog-release">
              <h3>{version}</h3>
              {items[0]?.date && <p className="doc-source">Dated {items[0].date}</p>}
              <ul>
                {items.map((entry, index) => {
                  const link = commitUrl(CHANGELOG_REPOSITORY, entry.commit);
                  return (
                    <li key={`${entry.entry}-${index}`}>
                      <span className="status-chip">{entry.section}</span> {entry.entry}
                      {link !== null && (
                        <>
                          {" "}
                          <a href={link} target="_blank" rel="noreferrer">
                            {entry.commit} <span aria-hidden="true">↗</span>
                          </a>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
              {items[0]?.verification && (
                <blockquote className="verification-block">
                  <p className="field-label">Verification</p>
                  <p>{items[0].verification}</p>
                </blockquote>
              )}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
