"use client";

import Link from "next/link";

import { viewPrefs } from "@/lib/view-prefs";
import type { Filters } from "./filters";
import { FilterButton, ViewButton } from "./MobileFilters";
import ReviewQueue from "./ReviewQueue";
import { Empty } from "./shared";
import type { ThoughtsBrowserState } from "./useThoughtsBrowser";
import { BUCKETS, WHEN } from "./useThoughtsBrowser";
import { CalendarView, ListView, TagsView, TimelineView } from "./views";

/**
 * The thoughts screen for a thumb.
 *
 * Same data, same handlers, three deliberate departures from the desktop:
 *
 * - **The piles become a segmented control.** Three underlined tabs plus a
 *   fourth pushed to the right does not survive 360px, and it is the same
 *   control the thought editor uses for status — so one vocabulary, not two.
 * - **Pending review leaves the tab row.** It is the one tab that asks
 *   something of you rather than showing a pile, so it becomes an amber line
 *   above the list, present only when there is something in it. Zero pending
 *   is zero clutter.
 * - **Nine controls become three.** Search, Filter, View. Everything else is
 *   inside the sheet one of those opens, and what is applied is spelled out as
 *   chips under the field.
 */
export default function ThoughtsBrowserMobile({
  state,
  settingsId,
  corrections,
}: {
  state: ThoughtsBrowserState;
  settingsId: string | null;
  corrections: string[];
}) {
  const {
    tags,
    people,
    view,
    pane,
    bucket,
    reviewing,
    filters,
    setFilters,
    clearAll,
    matches,
    setMatches,
    searching,
    searchMeaning,
    error,
    undo,
    setUndo,
    counts,
    pending,
    visible,
    applied,
    inBucket,
    move,
    viewProps,
    onReviewResolved,
  } = state;

  return (
    <div className="flex flex-col gap-3 lg:hidden">
      <div
        role="group"
        aria-label="Which thoughts"
        className="flex rounded-full border border-line-strong p-0.5"
      >
        {BUCKETS.map((option) => {
          const on = pane === option.key;
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={on}
              onClick={() => viewPrefs.set({ bucket: option.key })}
              className={`tap flex flex-1 items-center justify-center gap-1.5 rounded-full text-[0.9rem] transition-colors ${
                on ? "bg-iris-soft text-iris" : "text-ink-soft"
              }`}
            >
              {option.label}
              <span className="font-data text-[0.75rem] opacity-70">
                {counts[option.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* The one thing on this screen that asks something of you. It is here
          only when it has something to ask. */}
      {pending.length > 0 && !reviewing && (
        <button
          type="button"
          onClick={() => viewPrefs.set({ bucket: "review" })}
          className="tap flex items-center gap-2 rounded-xl bg-amber-soft px-3.5 text-left text-[0.9rem] text-amber"
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber"
          />
          {pending.length} to check
          <span aria-hidden="true" className="ml-auto">
            →
          </span>
        </button>
      )}

      {reviewing ? (
        <>
          <button
            type="button"
            onClick={() => viewPrefs.set({ bucket: "open" })}
            className="tap self-start rounded-full px-2 font-data text-[0.75rem] uppercase tracking-[0.12em] text-ink-faint"
          >
            ← back to open
          </button>
          <ReviewQueue
            initialItems={pending}
            settingsId={settingsId}
            corrections={corrections}
            onResolved={onReviewResolved}
            onLeave={() => viewPrefs.set({ bucket: "open" })}
          />
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <form onSubmit={searchMeaning} className="min-w-0 flex-1">
              <input
                value={filters.query}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, query: e.target.value }));
                  if (!e.target.value) setMatches(null);
                }}
                type="search"
                enterKeyHint="search"
                placeholder={searching ? "Searching…" : "Search"}
                aria-label="Search your thoughts"
                className="input h-11 appearance-none py-0"
              />
            </form>

            <FilterButton
              filters={filters}
              setFilters={setFilters}
              tags={tags}
              people={people}
              applied={applied}
            />

            {/* A tablet's toolbar can afford a fourth control, and this is the
                one worth promoting: it is a single on/off, it is checked far
                more often than it is changed, and the sheet still holds it for
                anyone who opens that instead. */}
            <button
              type="button"
              onClick={() =>
                setFilters((prev) => ({ ...prev, flagged: !prev.flagged }))
              }
              aria-pressed={filters.flagged}
              className={`tap hidden shrink-0 items-center gap-1.5 rounded-full border px-4 text-[0.9rem] transition-colors md:flex ${
                filters.flagged
                  ? "border-amber bg-amber-soft text-amber"
                  : "border-line-strong text-ink-soft"
              }`}
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-amber"
              />
              Unsure
            </button>

            <ViewButton
              view={view}
              onPick={(next) => viewPrefs.set({ view: next })}
            />
          </div>

          {applied > 0 && (
            <AppliedChips
              filters={filters}
              setFilters={setFilters}
              tags={tags}
              onClearAll={clearAll}
            />
          )}

          {/* One line, always here, so nothing under it shifts when a search
              starts or a filter lands. */}
          <p className="min-h-[1.15rem] px-0.5 font-data text-[0.75rem] text-ink-faint">
            {error ? (
              <span role="alert" className="text-blush">
                {error}
              </span>
            ) : matches !== null ? (
              `${matches.length} match${matches.length === 1 ? "" : "es"} · open and done, never archived`
            ) : applied || filters.query ? (
              `${visible.length} of ${inBucket}`
            ) : (
              "Press enter to search by meaning."
            )}
          </p>

          {matches !== null ? (
            <section>
              {matches.length === 0 ? (
                <p className="px-1.5 py-3 text-[0.95rem] text-ink-soft">
                  Nothing matched. Try fewer words.
                </p>
              ) : (
                <ul>
                  {matches.map((hit) => (
                    <li
                      key={hit.id}
                      className="border-b border-line/60 last:border-b-0"
                    >
                      <Link
                        href={`/thoughts/${hit.id}`}
                        className="flex min-h-[3.5rem] items-center gap-3 rounded-lg px-1.5 py-2.5"
                      >
                        <span className="min-w-0 flex-1 truncate text-[0.95rem] text-ink">
                          {hit.title}
                        </span>
                        {hit.via && (
                          <span className="shrink-0 font-data text-[0.75rem] text-ink-faint">
                            {hit.via}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : visible.length === 0 ? (
            <Empty
              bucket={bucket}
              filtered={applied > 0 || Boolean(filters.query)}
              onClear={clearAll}
            />
          ) : view === "tags" ? (
            <TagsView {...viewProps} />
          ) : view === "timeline" ? (
            <TimelineView {...viewProps} />
          ) : view === "calendar" ? (
            <CalendarView {...viewProps} />
          ) : (
            <ListView {...viewProps} />
          )}
        </>
      )}

      {/* Undo is a decision with a clock on it, so on a phone it sits where the
          thumb already is — over the list, above the sill, never in the
          metadata row where it would be missed and then expire. */}
      {undo && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-[calc(var(--sill-h)+var(--safe-bottom)+0.75rem)] z-50 px-4 md:bottom-8 lg:hidden"
        >
          <div
            className="mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-1.5 motion-safe:animate-[flux-rise_160ms_ease-out]"
            style={{ boxShadow: "var(--shadow-window)" }}
          >
            <span className="min-w-0 flex-1 truncate text-[0.875rem] text-ink-soft">
              {undo.title}
              <span className="font-data text-[0.75rem] text-ink-faint">
                {" "}
                → {undo.to}
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                void move(undo.id, undo.from);
                setUndo(null);
              }}
              className="tap shrink-0 rounded-full px-3 text-[0.95rem] font-medium text-iris"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** What is currently narrowing the list, spelled out and removable one at a
 *  time. The sheet is where filters are chosen; this is where they are read. */
function AppliedChips({
  filters,
  setFilters,
  tags,
  onClearAll,
}: {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  tags: { id: string; name: string; color?: string }[];
  onClearAll: () => void;
}) {
  const chips: { key: string; label: string; tone?: string; remove: () => void }[] =
    [];

  for (const id of filters.tags) {
    const tag = tags.find((t) => t.id === id);
    if (!tag) continue;
    chips.push({
      key: `tag-${id}`,
      label: tag.name,
      tone: tag.color || "iris",
      remove: () =>
        setFilters((prev) => ({
          ...prev,
          tags: prev.tags.filter((value) => value !== id),
        })),
    });
  }

  for (const name of filters.people) {
    chips.push({
      key: `person-${name}`,
      label: name,
      tone: "sky",
      remove: () =>
        setFilters((prev) => ({
          ...prev,
          people: prev.people.filter((value) => value !== name),
        })),
    });
  }

  if (filters.when) {
    const option = WHEN.find((w) => w.value === filters.when);
    chips.push({
      key: "when",
      label: option?.label ?? filters.when,
      remove: () => setFilters((prev) => ({ ...prev, when: null })),
    });
  }

  if (filters.flagged) {
    chips.push({
      key: "flagged",
      label: "Unsure",
      tone: "amber",
      remove: () => setFilters((prev) => ({ ...prev, flagged: false })),
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.remove}
          className="tap flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 pl-3.5 pr-3 text-[0.875rem] text-ink-soft"
        >
          {chip.tone && (
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: `var(--${chip.tone})` }}
            />
          )}
          {chip.label}
          <span aria-hidden="true" className="text-ink-faint">
            ×
          </span>
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="tap px-2.5 text-[0.875rem] text-ink-faint"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
