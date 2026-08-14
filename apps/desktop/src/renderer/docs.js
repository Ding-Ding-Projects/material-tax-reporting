'use strict';

/**
 * The offline documentation browser.
 *
 * Markdown is rendered from the shared kernel's typed node list, never from an
 * HTML string, so the content security policy keeps holding. Headings,
 * paragraphs, lists, code, tables and links to other bundled articles are
 * supported; anything else is shown as text.
 *
 * When an article is not packaged, the pane names the missing article instead
 * of going blank.
 */

import { buildDocsIndex, headingId, parseMarkdown, searchDocs } from '@material-tax-reporting/surface-kernel';
import { announce, el } from './dom.js';
import { createSearchField } from './regex-builder.js';

function renderInline(nodes, onLink) {
  return nodes.map((node) => {
    if (node.kind === 'code') return el('code', { text: node.value });
    if (node.kind === 'link') {
      const internal = !/^[a-z][a-z0-9+.-]*:/i.test(node.href) && !node.href.startsWith('#');
      return el('button', {
        type: 'button',
        class: 'text-button inline-link',
        onClick: () => onLink(node.href, internal),
      }, node.text);
    }
    return document.createTextNode(node.value);
  });
}

/** Renders one parsed article into real elements. */
export function renderNodes(nodes, onLink) {
  return nodes.map((node) => {
    if (node.kind === 'heading') {
      const level = Math.min(Math.max(node.level, 1), 6);
      return el(`h${level}`, { id: `doc-${node.id || headingId(node.text)}`, text: node.text });
    }
    if (node.kind === 'paragraph') return el('p', {}, renderInline(node.inline, onLink));
    if (node.kind === 'list') {
      return el(node.ordered ? 'ol' : 'ul', {}, node.items.map((item) => el('li', {}, renderInline(item, onLink))));
    }
    if (node.kind === 'code') {
      return el('pre', { class: 'code-block', 'aria-label': node.language ? `${node.language} code sample` : 'Code sample' }, [el('code', { text: node.value })]);
    }
    if (node.kind === 'table') {
      return el('div', { class: 'table-scroll' }, [el('table', {}, [
        el('thead', {}, [el('tr', {}, node.headers.map((header) => el('th', { scope: 'col', text: header })))]),
        el('tbody', {}, node.rows.map((row) => el('tr', {}, row.map((cell) => el('td', { text: cell }))))),
      ])]);
    }
    return el('p', { class: 'supporting', text: 'This block uses a Markdown feature the offline reader does not render.' });
  });
}

export function createDocsView({ api, container }) {
  let listing = { available: false, articles: [], searchedLocations: [], missing: '' };
  let index = { articles: [], bySlug: {}, unresolvedLinks: [] };
  let current = null;

  const search = createSearchField({
    id: 'docs-search',
    label: 'Search the packaged articles',
    placeholder: 'Type part of a title or a sentence',
    onChange: () => renderList(),
  });

  const articleList = el('div', { class: 'docs-list', role: 'list' });
  const articleBody = el('article', { class: 'card docs-article', id: 'docs-article', 'data-appearance-id': 'docs-article', tabindex: '-1' });
  const status = el('p', { class: 'supporting', 'aria-live': 'polite' });

  async function load() {
    const result = await api.docs.list();
    listing = result?.ok ? result.data : { available: false, articles: [], searchedLocations: [], missing: 'The packaged documentation could not be listed.' };
    if (!listing.available) {
      status.textContent = listing.missing;
      articleList.replaceChildren();
      articleBody.replaceChildren(el('p', { text: listing.missing }));
      return;
    }
    const loaded = [];
    for (const article of listing.articles) {
      const read = await api.docs.read({ area: article.area, slug: article.slug });
      if (read?.ok && read.data.ok) loaded.push({ slug: `${article.area}/${article.slug}`, title: article.title, path: article.path, markdown: read.data.markdown });
    }
    index = buildDocsIndex(loaded);
    status.textContent = `${index.articles.length} packaged article${index.articles.length === 1 ? '' : 's'} are available offline.`;
    renderList();
    if (index.articles.length > 0) show(index.articles[0].slug);
  }

  function renderList() {
    const results = searchDocs(index, search.state);
    search.reportCounts(results.length, index.articles.length);
    articleList.replaceChildren(...(results.length === 0
      ? [el('p', { class: 'supporting', text: 'No packaged article matches this search.' })]
      : results.map((result) => el('button', {
        type: 'button',
        class: `docs-list-item${current === result.slug ? ' selected' : ''}`,
        role: 'listitem',
        onClick: () => show(result.slug),
      }, [
        el('strong', { text: result.title }),
        result.heading ? el('span', { class: 'supporting', text: `Under: ${result.heading}` }) : null,
        el('span', { class: 'supporting', text: result.excerpt }),
      ]))));
  }

  function onLink(href, internal) {
    if (!internal) { announce('Only links to other packaged articles are followed here.'); return; }
    const entry = index.articles.find((article) => article.links.some((link) => link.href === href && link.targetSlug))
      ?.links.find((link) => link.href === href)?.targetSlug;
    if (entry && index.bySlug[entry]) { show(entry); return; }
    articleBody.replaceChildren(el('p', { class: 'error-text', text: `No packaged article answers the link "${href}". The article may not be part of this build.` }));
  }

  function show(slug) {
    current = slug;
    const entry = index.bySlug[slug];
    if (!entry) {
      articleBody.replaceChildren(el('p', { class: 'error-text', text: `No packaged article is named "${slug}".` }));
      return;
    }
    articleBody.replaceChildren(
      el('nav', { 'aria-label': 'Article outline' }, [
        el('h2', { text: 'On this page' }),
        el('ul', {}, entry.outline.map((item) => el('li', {}, [el('button', {
          type: 'button',
          class: 'text-button',
          onClick: () => document.getElementById(`doc-${item.id}`)?.scrollIntoView({ block: 'start' }),
        }, item.text)]))),
      ]),
      ...renderNodes(entry.nodes, onLink),
    );
    articleBody.focus();
    renderList();
  }

  container.replaceChildren(
    el('div', { class: 'page-heading' }, [
      el('div', {}, [el('p', { class: 'eyebrow', text: 'Packaged and offline' }), el('h1', { id: 'docs-heading', text: 'Documentation' })]),
    ]),
    el('div', { class: 'docs-grid' }, [
      el('div', { class: 'card' }, [search.element, status, articleList]),
      articleBody,
    ]),
  );

  return {
    refresh: load,
    /** Opens the article that owns one wizard step. */
    openArticle: (area, slug) => show(`${area}/${slug}`),
    parse: parseMarkdown,
  };
}
