"use client";

/**
 * The tab strip.
 *
 * Ordering, pinning, grouping, keyboard movement, overflow and bulk close are
 * kernel functions; this component renders them and owns the accessibility
 * behaviour: one stop in the tab order with a roving tabindex, arrow keys
 * following the docked edge, Home and End, and Control with an arrow key to
 * move the active tab.
 *
 * Overflow is a menu button rather than a horizontal scroll region, so a tab
 * that does not fit is still reachable by keyboard.
 */

import {
  type LanguageMode,
  type TabModel,
  type TabsState,
  bulkCloseByQuery,
  computeOverflow,
  isVerticalDock,
  matchesSearch,
  reduceTabs,
  resolveKeyboardMove,
  sortTabs,
} from "@material-tax-reporting/surface-kernel";
import { type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { SITE_TAB_GROUPS, tabDescriptor, tabHaystack, tabLabel } from "./tabs.ts";
import { CompactSearchWithBuilder, type SearchBinding } from "./search-builder.tsx";

export type TabStripSearches = {
  tabs: SearchBinding;
  groups: SearchBinding;
  movePicker: SearchBinding;
  bulkClose: SearchBinding;
};

function labelOf(tab: TabModel, language: LanguageMode): string {
  const descriptor = tabDescriptor(tab.id);
  return descriptor === null ? tab.id : tabLabel(descriptor, language);
}

export function TabStrip({
  state,
  onChange,
  dock,
  language,
  searches,
  onNotify,
  registerRef,
  appearanceProps,
}: {
  state: TabsState;
  onChange: (next: TabsState, summary: string) => void;
  dock: "left" | "top" | "right" | "bottom";
  language: LanguageMode;
  searches: TabStripSearches;
  onNotify: (kind: "success" | "error", title: string, body: string) => void;
  registerRef: (id: string, element: HTMLButtonElement | null) => void;
  appearanceProps: (id: string) => { style?: Record<string, string>; onContextMenu?: (event: React.MouseEvent) => void };
}): ReactNode {
  const railRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(Number.POSITIVE_INFINITY);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

  const ordered = useMemo(() => sortTabs(state.tabs), [state.tabs]);
  const vertical = isVerticalDock(dock);

  // The strip measures itself, so the overflow menu holds exactly the tabs that
  // do not fit rather than a guessed number.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const buttons = [...rail.querySelectorAll<HTMLElement>("button[role='tab']")];
      if (buttons.length === 0) return;
      const railBox = rail.getBoundingClientRect();
      const limit = vertical ? railBox.height - 96 : railBox.width - 96;
      let used = 0;
      let fitting = 0;
      for (const button of buttons) {
        const box = button.getBoundingClientRect();
        used += vertical ? box.height + 6 : box.width + 6;
        if (used > limit) break;
        fitting += 1;
      }
      setVisibleCount(Math.max(1, fitting));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    measure();
    return () => observer.disconnect();
  }, [ordered.length, vertical]);

  const { visible, overflow } = useMemo(
    () => computeOverflow(state.tabs, visibleCount),
    [state.tabs, visibleCount],
  );

  const groups = useMemo(
    () => state.groups.filter((group) => matchesSearch(`${group.name} ${group.id}`, searches.groups.state)),
    [searches.groups.state, state.groups],
  );
  const groupIds = new Set(groups.map((group) => group.id));

  const searchedTabs = useMemo(
    () => visible.filter((tab) => matchesSearch(tabHaystack(tab, language), searches.tabs.state)),
    [language, searches.tabs.state, visible],
  );

  const renderable = searchedTabs.filter((tab) => {
    if (tab.groupId === null) return true;
    if (!groupIds.has(tab.groupId)) return false;
    const group = state.groups.find((entry) => entry.id === tab.groupId);
    return !(group?.collapsed ?? false);
  });

  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, tab: TabModel) => {
    if (event.ctrlKey && (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      const section = ordered.filter((entry) => entry.pinned === tab.pinned);
      const index = section.findIndex((entry) => entry.id === tab.id);
      const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
      const target = Math.min(section.length - 1, Math.max(0, index + (forward ? 1 : -1)));
      if (target === index) return;
      onChange(reduceTabs(state, { type: "move", id: tab.id, toIndex: target }), `Moved the ${labelOf(tab, language)} tab`);
      return;
    }
    const next = resolveKeyboardMove(state.tabs, tab.id, event.key, dock);
    if (next !== null && next !== tab.id) {
      event.preventDefault();
      onChange(reduceTabs(state, { type: "activate", id: next }), "Changed the active tab");
      window.requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus());
    }
  };

  const bulkMatches = useMemo(
    () => bulkCloseByQuery(state.tabs, searches.bulkClose.state, (tab) => labelOf(tab, language)),
    [language, searches.bulkClose.state, state.tabs],
  );

  const moveCandidates = useMemo(
    () => ordered.filter((tab) => matchesSearch(tabHaystack(tab, language), searches.movePicker.state)),
    [language, ordered, searches.movePicker.state],
  );

  return (
    <>
      <div
        className="tab-rail"
        id="tab-rail"
        ref={railRef}
        {...appearanceProps("tab-rail")}
      >
        <div role="tablist" aria-label="Primary documentation" aria-orientation={vertical ? "vertical" : "horizontal"}>
          {groups.map((group) => {
            const members = renderable.filter((tab) => tab.groupId === group.id);
            const collapsed = group.collapsed;
            const groupMembers = visible.filter((tab) => tab.groupId === group.id);
            if (groupMembers.length === 0) return null;
            return (
              <div className="tab-group" key={group.id} style={{ "--group-accent": group.accent } as React.CSSProperties}>
                <button
                  type="button"
                  className="tab-group-header"
                  aria-expanded={!collapsed}
                  onClick={() =>
                    onChange(
                      reduceTabs(state, { type: "collapse-group", groupId: group.id, collapsed: !collapsed }),
                      `${collapsed ? "Expanded" : "Collapsed"} the ${group.name} tab group`,
                    )
                  }
                >
                  <span aria-hidden="true" className="group-swatch" />
                  {group.name}
                  <span className="group-count">{groupMembers.length}</span>
                </button>
                {members.map((tab) => (
                  <TabButton
                    key={tab.id}
                    tab={tab}
                    state={state}
                    language={language}
                    active={state.activeId === tab.id}
                    dragging={dragging === tab.id}
                    onKeyDown={onKeyDown}
                    onChange={onChange}
                    registerRef={registerRef}
                    appearanceProps={appearanceProps}
                    onDragStart={() => setDragging(tab.id)}
                    onDragEnd={() => setDragging(null)}
                    onDropOn={(targetId) => {
                      if (dragging === null || dragging === targetId) return;
                      const section = ordered.filter((entry) => entry.pinned === tab.pinned);
                      const toIndex = section.findIndex((entry) => entry.id === targetId);
                      if (toIndex === -1) return;
                      onChange(reduceTabs(state, { type: "move", id: dragging, toIndex }), "Reordered the tab strip");
                      setDragging(null);
                    }}
                    onOpenMovePicker={() => setMoveTarget(tab.id)}
                  />
                ))}
              </div>
            );
          })}
          {renderable
            .filter((tab) => tab.groupId === null)
            .map((tab) => (
              <TabButton
                key={tab.id}
                tab={tab}
                state={state}
                language={language}
                active={state.activeId === tab.id}
                dragging={dragging === tab.id}
                onKeyDown={onKeyDown}
                onChange={onChange}
                registerRef={registerRef}
                appearanceProps={appearanceProps}
                onDragStart={() => setDragging(tab.id)}
                onDragEnd={() => setDragging(null)}
                onDropOn={(targetId) => {
                  if (dragging === null || dragging === targetId) return;
                  const toIndex = ordered.findIndex((entry) => entry.id === targetId);
                  if (toIndex === -1) return;
                  onChange(reduceTabs(state, { type: "move", id: dragging, toIndex }), "Reordered the tab strip");
                  setDragging(null);
                }}
                onOpenMovePicker={() => setMoveTarget(tab.id)}
              />
            ))}
        </div>

        {overflow.length > 0 && (
          <div className="tab-overflow">
            <button
              type="button"
              className="outlined-button"
              aria-expanded={overflowOpen}
              aria-controls="tab-overflow-menu"
              onClick={() => setOverflowOpen((open) => !open)}
            >
              {overflow.length} more tab{overflow.length === 1 ? "" : "s"}
            </button>
            {overflowOpen && (
              <ul className="tab-overflow-menu" id="tab-overflow-menu">
                {overflow.map((tab) => (
                  <li key={tab.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(reduceTabs(state, { type: "activate", id: tab.id }), "Changed the active tab");
                        setOverflowOpen(false);
                      }}
                    >
                      {labelOf(tab, language)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <details className="tab-tools">
          <summary>Find and manage tabs</summary>
          <CompactSearchWithBuilder {...searches.tabs} />
          <CompactSearchWithBuilder {...searches.groups} />
          <button type="button" className="outlined-button" onClick={() => setBulkOpen(true)}>
            Close tabs by query
          </button>
        </details>
      </div>

      {moveTarget !== null && (
        <div className="dialog-scrim" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setMoveTarget(null);
        }}>
          <section className="command-palette" role="dialog" aria-modal="true" aria-labelledby="move-tab-title">
            <div className="palette-heading">
              <div>
                <p className="eyebrow">Reorder</p>
                <h2 id="move-tab-title">Move {labelOf(ordered.find((tab) => tab.id === moveTarget) ?? ordered[0]!, language)}</h2>
              </div>
              <button type="button" className="icon-button" aria-label="Close the move picker" onClick={() => setMoveTarget(null)}>
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <CompactSearchWithBuilder {...searches.movePicker} />
            <ul className="command-list">
              {moveCandidates.map((tab, index) => (
                <li key={tab.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(
                        reduceTabs(state, { type: "move", id: moveTarget, toIndex: index }),
                        "Moved a tab with the picker",
                      );
                      setMoveTarget(null);
                    }}
                  >
                    <span>
                      <strong>Place before {labelOf(tab, language)}</strong>
                      <small>Position {index + 1}</small>
                    </span>
                  </button>
                </li>
              ))}
              {moveCandidates.length === 0 && <li className="empty-command">No tab matches the filter.</li>}
            </ul>
          </section>
        </div>
      )}

      {bulkOpen && (
        <div className="dialog-scrim" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setBulkOpen(false);
        }}>
          <section className="command-palette" role="dialog" aria-modal="true" aria-labelledby="bulk-close-title">
            <div className="palette-heading">
              <div>
                <p className="eyebrow">Bulk action</p>
                <h2 id="bulk-close-title">Close tabs by query</h2>
              </div>
              <button type="button" className="icon-button" aria-label="Close the bulk-close dialog" onClick={() => setBulkOpen(false)}>
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <CompactSearchWithBuilder {...searches.bulkClose} />
            <p>
              {bulkMatches.length} tab{bulkMatches.length === 1 ? "" : "s"} would close. Pinned tabs and the Home
              tab are never included.
            </p>
            <ul className="command-list">
              {bulkMatches.map((tab) => (
                <li key={tab.id}>
                  <span className="command-row">{labelOf(tab, language)}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="filled-button"
              disabled={bulkMatches.length === 0}
              onClick={() => {
                let next = state;
                for (const tab of bulkMatches) next = reduceTabs(next, { type: "close", id: tab.id });
                onChange(next, `Closed ${bulkMatches.length} tabs by query`);
                onNotify("success", "Tabs closed", `${bulkMatches.length} tab${bulkMatches.length === 1 ? "" : "s"} closed.`);
                setBulkOpen(false);
              }}
            >
              Close these {bulkMatches.length} tabs
            </button>
          </section>
        </div>
      )}
    </>
  );
}

function TabButton({
  tab,
  state,
  language,
  active,
  dragging,
  onKeyDown,
  onChange,
  registerRef,
  appearanceProps,
  onDragStart,
  onDragEnd,
  onDropOn,
  onOpenMovePicker,
}: {
  tab: TabModel;
  state: TabsState;
  language: LanguageMode;
  active: boolean;
  dragging: boolean;
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>, tab: TabModel) => void;
  onChange: (next: TabsState, summary: string) => void;
  registerRef: (id: string, element: HTMLButtonElement | null) => void;
  appearanceProps: (id: string) => { style?: Record<string, string>; onContextMenu?: (event: React.MouseEvent) => void };
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropOn: (targetId: string) => void;
  onOpenMovePicker: () => void;
}): ReactNode {
  const descriptor = tabDescriptor(tab.id);
  const label = descriptor === null ? tab.id : tabLabel(descriptor, language);

  return (
    <div className={dragging ? "tab-entry dragging" : "tab-entry"}>
      <button
        ref={(element) => registerRef(tab.id, element)}
        id={`tab-${tab.id}`}
        role="tab"
        aria-selected={active}
        aria-controls={`panel-${tab.id}`}
        tabIndex={active ? 0 : -1}
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onDropOn(tab.id);
        }}
        onClick={() => onChange(reduceTabs(state, { type: "activate", id: tab.id }), "Changed the active tab")}
        onKeyDown={(event) => onKeyDown(event, tab)}
        {...appearanceProps(`tab-${tab.id}`)}
      >
        <span className="tab-icon" aria-hidden="true">
          {descriptor?.short ?? "?"}
        </span>
        {!tab.pinned && <span className="tab-label">{label}</span>}
        {tab.pinned && <span className="visually-hidden">{label} (pinned)</span>}
      </button>
      <div className="tab-entry-actions">
        <button
          type="button"
          className="icon-button"
          aria-label={`${tab.pinned ? "Unpin" : "Pin"} ${label}`}
          onClick={() =>
            onChange(
              reduceTabs(state, { type: "pin", id: tab.id, pinned: !tab.pinned }),
              `${tab.pinned ? "Unpinned" : "Pinned"} the ${label} tab`,
            )
          }
        >
          <span aria-hidden="true">{tab.pinned ? "◆" : "◇"}</span>
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={`Move ${label}`}
          onClick={onOpenMovePicker}
        >
          <span aria-hidden="true">⇅</span>
        </button>
        {tab.closable && (
          <button
            type="button"
            className="icon-button"
            aria-label={`Close ${label}`}
            onClick={() => onChange(reduceTabs(state, { type: "close", id: tab.id }), `Closed the ${label} tab`)}
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>
    </div>
  );
}
