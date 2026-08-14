"use client";

/**
 * The documentation browser.
 *
 * The whole tracked corpus is parsed at build time into `app/data/docs.ts`, so
 * this browser works from the bundle with no runtime fetch. The parser produces
 * typed nodes rather than markup, so nothing here injects HTML.
 *
 * Internal links between articles are resolved at build time and are followed
 * inside the page; an external address opens as an ordinary link.
 */

import {
  type DocNode,
  type DocsIndexEntry,
  type InlineNode,
  matchesSearch,
  searchDocs,
} from "@material-tax-reporting/surface-kernel";
import { type ReactNode, useMemo, useState } from "react";
import { DOCS_INDEX, DOC_AREAS, DOC_ENTRIES } from "./data/docs.ts";
import { FEATURE_ROWS } from "./data/features.ts";
import { CompactSearchWithBuilder, SearchWithBuilder, type SearchBinding } from "./search-builder.tsx";
import { type ExportRequest } from "./exports.ts";

const VERIFICATION_SLUG = "docs-site-verification-status";

/** The topic of an article, taken from the directory it lives in. */
function topicOf(entry: DocsIndexEntry): string {
  const parts = entry.path.split("/");
  return parts.length > 2 ? (parts[parts.length - 2] ?? "general") : "general";
}

export const DOC_AREA_NAMES: readonly string[] = [...new Set(Object.values(DOC_AREAS))].sort();
export const DOC_TOPIC_NAMES: readonly string[] = [...new Set(DOC_ENTRIES.map(topicOf))].sort();

/**
 * The "what was not run" statements, read from the tracked verification-status
 * article rather than written in this component.
 */
export function verificationStatements(): string[] {
  const entry = DOCS_INDEX.bySlug[VERIFICATION_SLUG];
  if (!entry) return [];
  let capturing = false;
  const statements: string[] = [];
  for (const node of entry.nodes) {
    if (node.kind === "heading") {
      capturing = /what was not run/i.test(node.text);
      continue;
    }
    if (capturing && node.kind === "list") {
      for (const item of node.items) statements.push(inlineText(item).replace(/[;.]$/, ""));
    }
  }
  return statements;
}

function inlineText(nodes: readonly InlineNode[]): string {
  return nodes.map((node) => (node.kind === "link" ? node.text : node.value)).join("");
}

function Inline({
  nodes,
  onNavigate,
  fromSlug,
}: {
  nodes: readonly InlineNode[];
  onNavigate: (slug: string) => void;
  fromSlug: string;
}): ReactNode {
  const entry = DOCS_INDEX.bySlug[fromSlug];
  return (
    <>
      {nodes.map((node, index) => {
        if (node.kind === "text") return <span key={index}>{node.value}</span>;
        if (node.kind === "code") return <code key={index}>{node.value}</code>;
        if (node.href.startsWith("#")) {
          return (
            <a key={index} href={node.href}>
              {node.text}
            </a>
          );
        }
        const resolved = entry?.links.find((link) => link.href === node.href)?.targetSlug ?? null;
        if (resolved !== null) {
          return (
            <button key={index} type="button" className="doc-link" onClick={() => onNavigate(resolved)}>
              {node.text}
            </button>
          );
        }
        if (/^https?:/i.test(node.href)) {
          return (
            <a key={index} href={node.href} target="_blank" rel="noreferrer">
              {node.text} <span aria-hidden="true">↗</span>
            </a>
          );
        }
        return <span key={index}>{node.text}</span>;
      })}
    </>
  );
}

function DocBody({
  entry,
  onNavigate,
}: {
  entry: DocsIndexEntry;
  onNavigate: (slug: string) => void;
}): ReactNode {
  return (
    <>
      {entry.nodes.map((node: DocNode, index) => {
        if (node.kind === "heading") {
          const level = Math.min(6, Math.max(2, node.level + 1));
          const Tag = `h${level}` as "h2";
          return (
            <Tag key={index} id={`${entry.slug}-${node.id}`}>
              {node.text}
            </Tag>
          );
        }
        if (node.kind === "paragraph") {
          return (
            <p key={index}>
              <Inline nodes={node.inline} onNavigate={onNavigate} fromSlug={entry.slug} />
            </p>
          );
        }
        if (node.kind === "list") {
          const items = node.items.map((item, itemIndex) => (
            <li key={itemIndex}>
              <Inline nodes={item} onNavigate={onNavigate} fromSlug={entry.slug} />
            </li>
          ));
          return node.ordered ? <ol key={index}>{items}</ol> : <ul key={index}>{items}</ul>;
        }
        if (node.kind === "code") {
          return (
            <pre key={index} tabIndex={0} aria-label={node.language ? `${node.language} code sample` : "Code sample"}>
              <code>{node.value}</code>
            </pre>
          );
        }
        return (
          <div className="table-scroll" key={index}>
            <table className="data-table">
              <thead>
                <tr>
                  {node.headers.map((header, headerIndex) => (
                    <th scope="col" key={headerIndex}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {node.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cellValue, cellIndex) => (
                      <td key={cellIndex}>{cellValue}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}

/** The export shape for the documentation index. */
export function docsExportRequest(entries: readonly DocsIndexEntry[], filterDescription: string): ExportRequest {
  return {
    collection: "Documentation index",
    filterDescription,
    columns: [
      { key: "slug", label: "Slug" },
      { key: "title", label: "Title" },
      { key: "path", label: "Source path" },
      { key: "area", label: "Area" },
      { key: "headings", label: "Headings" },
    ],
    rows: entries.map((entry) => ({
      slug: entry.slug,
      title: entry.title,
      path: entry.path,
      area: DOC_AREAS[entry.slug] ?? "",
      headings: entry.outline.map((heading) => heading.text).join(" › "),
    })),
    format: "json",
    omitted: ["article body text"],
  };
}

export function DocumentationBrowser({
  search,
  areaFilter,
  topicFilter,
  activeSlug,
  onSelect,
  onExport,
  copy,
}: {
  search: SearchBinding;
  areaFilter: SearchBinding;
  topicFilter: SearchBinding;
  activeSlug: string | null;
  onSelect: (slug: string) => void;
  onExport: (request: ExportRequest) => void;
  copy: (key: string) => string;
}): ReactNode {
  const [showLibrary, setShowLibrary] = useState(false);

  const areas = useMemo(
    () => DOC_AREA_NAMES.filter((area) => matchesSearch(area, areaFilter.state)),
    [areaFilter.state],
  );
  const topics = useMemo(
    () => DOC_TOPIC_NAMES.filter((topic) => matchesSearch(topic, topicFilter.state)),
    [topicFilter.state],
  );

  const results = useMemo(() => searchDocs(DOCS_INDEX, search.state), [search.state]);
  const visible = useMemo(
    () =>
      results.filter((result) => {
        const entry = DOCS_INDEX.bySlug[result.slug];
        if (!entry) return false;
        return areas.includes(DOC_AREAS[entry.slug] ?? "") && topics.includes(topicOf(entry));
      }),
    [areas, results, topics],
  );

  const active = activeSlug === null ? null : (DOCS_INDEX.bySlug[activeSlug] ?? null);
  const statements = useMemo(verificationStatements, []);

  return (
    <div className="docs-browser">
      <div className="docs-index-pane">
        <SearchWithBuilder
          {...search}
          visibleCount={visible.length}
          totalCount={DOC_ENTRIES.length}
        />
        <div className="docs-filters">
          <div id="documentation-area-filter" tabIndex={-1}>
            <p className="field-label">Areas</p>
            <CompactSearchWithBuilder {...areaFilter} />
            <p className="filter-summary">{areas.join(", ") || "No area matches the filter."}</p>
          </div>
          <div id="documentation-topic-filter" tabIndex={-1}>
            <p className="field-label">Topics</p>
            <CompactSearchWithBuilder {...topicFilter} />
            <p className="filter-summary">{topics.join(", ") || "No topic matches the filter."}</p>
          </div>
        </div>
        <ul className="docs-index-list">
          {visible.map((result) => (
            <li key={result.slug} id={`doc-entry-${result.slug}`}>
              <button
                type="button"
                aria-current={result.slug === activeSlug}
                onClick={() => onSelect(result.slug)}
              >
                <strong>{result.title}</strong>
                <small>{DOC_AREAS[result.slug] ?? "Documentation"}</small>
                {result.heading && <small>Matched under: {result.heading}</small>}
                <small className="doc-excerpt">{result.excerpt}</small>
              </button>
            </li>
          ))}
          {visible.length === 0 && (
            <li className="empty-state">
              <h3>{copy("docs.emptyTitle")}</h3>
              <p>{copy("docs.emptyBody")}</p>
            </li>
          )}
        </ul>
        <div className="docs-index-actions">
          <button
            type="button"
            className="outlined-button"
            onClick={() =>
              onExport(
                docsExportRequest(
                  visible
                    .map((result) => DOCS_INDEX.bySlug[result.slug])
                    .filter((entry): entry is DocsIndexEntry => entry !== undefined),
                  `Search: ${search.state.regex ? search.state.pattern : search.state.query || "none"}; areas: ${areas.join("|")}; topics: ${topics.join("|")}`,
                ),
              )
            }
          >
            Export the filtered index
          </button>
          <button type="button" className="tonal-button" onClick={() => setShowLibrary((value) => !value)}>
            {showLibrary ? "Hide the feature library" : copy("docs.featureLibraryTitle")}
          </button>
        </div>
      </div>

      <div className="docs-reading-pane" aria-label={copy("docs.readingPaneLabel")}>
        {showLibrary ? (
          <section aria-labelledby="feature-library-title">
            <h2 id="feature-library-title">{copy("docs.featureLibraryTitle")}</h2>
            <p>{copy("docs.featureLibraryLede")}</p>
            <div className="table-scroll">
              <table className="data-table">
                <caption>
                  Capability, documentation and current state. The state column repeats what the tracked
                  verification-status article records was not run.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Capability</th>
                    <th scope="col">What it does</th>
                    <th scope="col">Documentation</th>
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_ROWS.map((row) => (
                    <tr key={row.id}>
                      <th scope="row">{row.label}</th>
                      <td>{row.summary}</td>
                      <td>
                        {DOCS_INDEX.bySlug[row.docSlug] ? (
                          <button type="button" className="doc-link" onClick={() => onSelect(row.docSlug)}>
                            Open the article
                          </button>
                        ) : (
                          "No article is bundled for this row."
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>Current state of every row</h3>
            {statements.length === 0 ? (
              <p>The verification-status article is not bundled, so no state statement can be shown.</p>
            ) : (
              <>
                <p>
                  Every capability above is present in this bundle. The tracked verification-status article
                  records that this work did not run:
                </p>
                <ul>
                  {statements.map((statement) => (
                    <li key={statement}>{statement}</li>
                  ))}
                </ul>
              </>
            )}
          </section>
        ) : active === null ? (
          <div className="empty-state">
            <h2>Choose an article</h2>
            <p>The index on the left lists every tracked article bundled with this site.</p>
          </div>
        ) : (
          <article aria-labelledby={`${active.slug}-title`}>
            <p className="eyebrow">{DOC_AREAS[active.slug] ?? "Documentation"}</p>
            <h2 id={`${active.slug}-title`}>{active.title}</h2>
            <p className="doc-source">Source: {active.path}</p>
            {active.outline.length > 1 && (
              <nav className="doc-outline" aria-label={`${active.title}: headings`}>
                <ul>
                  {active.outline.map((heading) => (
                    <li key={heading.id} data-level={heading.level}>
                      <a href={`#${active.slug}-${heading.id}`}>{heading.text}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            <DocBody entry={active} onNavigate={onSelect} />
          </article>
        )}
      </div>
    </div>
  );
}
