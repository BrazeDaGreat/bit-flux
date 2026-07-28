"use client";

import Link from "next/link";

import { viewPrefs } from "@/lib/view-prefs";
import { EMPTY_FILTERS, type ViewMode, type WhenKey } from "./filters";
import QuickFilter from "./QuickFilter";
import ReviewQueue from "./ReviewQueue";
import { Empty, ViewIcon } from "./shared";
import ThoughtsBucketActions from "./ThoughtsBucketActions";
import type { ThoughtsBrowserState } from "./useThoughtsBrowser";
import { BUCKETS, VIEWS, WHEN } from "./useThoughtsBrowser";
import { CalendarView, ListView, TagsView, TimelineView } from "./views";

/**
 * The thoughts screen as it has always been, moved out of `ThoughtsBrowser`
 * whole. Only the root's `flex` became `hidden … lg:flex` — at the desktop
 * breakpoint that computes to the same `display: flex` it had before.
 *
 * Two decisions sit above the list and never move: which pile you are in —
 * open work, finished work, or the archive, which are three separate places and
 * never mix — and which shape you want to see it in. Pending review sits on the
 * far right of the same row, because it is the one tab that asks something of
 * you rather than showing you a pile.
 */
export default function ThoughtsBrowserDesktop({
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
    matches,
    searching,
    searchMeaning,
    searchRef,
    error,
    undo,
    setUndo,
    counts,
    pending,
    visible,
    applied,
    inBucket,
    move,
    moveAll,
    removeAll,
    bulkBusy,
    viewProps,
    onReviewResolved,
    setMatches,
  } = state;

  return (
    <div className="hidden flex-col gap-3.5 lg:flex">
      {/* Three piles, one line. Done work stays visible as an achievement;
          archived work stays out of the way until asked for. */}
      <div
        className="flex items-baseline gap-4 border-b pb-2"
        style={{ borderColor: "var(--line)" }}
        role="group"
        aria-label="Which thoughts"
      >
        {BUCKETS.map((option) => {
          const on = pane === option.key;
          // The underline sits exactly on the rule below the row. Long-term
          // keeps the sky it wears everywhere else — the ink for "far off" —
          // so the tab and the dot on its rows say the same thing.
          const tone = option.key === "longterm" ? "border-sky" : "border-iris";
          return (
            <ThoughtsBucketActions
              key={option.key}
              bucket={option.key}
              label={option.label}
              count={counts[option.key]}
              active={on}
              busy={bulkBusy}
              onSelect={() => viewPrefs.set({ bucket: option.key })}
              onMoveAll={moveAll}
              onRemoveAll={removeAll}
              className={`flex items-baseline gap-1.5 border-b-2 pb-1.5 text-[0.88rem] transition-colors ${
                on
                  ? `${tone} text-ink`
                  : "border-transparent text-ink-faint hover:text-ink-soft"
              }`}
              style={{ marginBottom: "calc(-0.5rem - 1px)" }}
            >
              {option.label}
              <span className="font-data text-[0.66rem] opacity-70">
                {counts[option.key]}
              </span>
            </ThoughtsBucketActions>
          );
        })}

        {/* Amber wherever the AI is unsure — the same colour as the Unsure
            filter, so the signal means one thing across the screen. */}
        <button
          type="button"
          aria-pressed={reviewing}
          onClick={() => viewPrefs.set({ bucket: "review" })}
          className={`ml-auto flex items-baseline gap-1.5 border-b-2 pb-1.5 text-[0.88rem] transition-colors ${
            reviewing
              ? "border-amber text-ink"
              : "border-transparent text-ink-faint hover:text-ink-soft"
          }`}
          style={{ marginBottom: "calc(-0.5rem - 1px)" }}
        >
          Pending review
          <span
            className={`font-data text-[0.66rem] ${
              pending.length > 0 ? "text-amber" : "opacity-70"
            }`}
          >
            {pending.length}
          </span>
        </button>
      </div>

      {reviewing ? (
        <ReviewQueue
          initialItems={pending}
          settingsId={settingsId}
          corrections={corrections}
          onResolved={onReviewResolved}
          onLeave={() => viewPrefs.set({ bucket: "open" })}
        />
      ) : (
        <>
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={searchMeaning} className="min-w-[10rem] flex-1">
            <input
              ref={searchRef}
              value={filters.query}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, query: e.target.value }));
                if (!e.target.value) setMatches(null);
              }}
              placeholder={searching ? "Searching…" : "Search — enter for meaning"}
              aria-label="Search your thoughts"
              className="input h-8 py-0"
            />
          </form>

          <QuickFilter
            label="Tags"
            options={tags.map((tag) => ({
              value: tag.id,
              label: tag.name,
              tone: tag.color || "iris",
            }))}
            selected={filters.tags}
            onToggle={(value) =>
              setFilters((prev) => ({
                ...prev,
                tags: prev.tags.includes(value)
                  ? prev.tags.filter((id) => id !== value)
                  : [...prev.tags, value],
              }))
            }
            onClear={() => setFilters((prev) => ({ ...prev, tags: [] }))}
          />

          <QuickFilter
            label="People"
            options={people.map((name) => ({ value: name, label: name }))}
            selected={filters.people}
            onToggle={(value) =>
              setFilters((prev) => ({
                ...prev,
                people: prev.people.includes(value)
                  ? prev.people.filter((name) => name !== value)
                  : [...prev.people, value],
              }))
            }
            onClear={() => setFilters((prev) => ({ ...prev, people: [] }))}
          />

          <QuickFilter
            label="When"
            single
            options={WHEN}
            selected={filters.when ? [filters.when] : []}
            onToggle={(value) =>
              setFilters((prev) => ({
                ...prev,
                when: prev.when === value ? null : (value as WhenKey),
              }))
            }
            onClear={() => setFilters((prev) => ({ ...prev, when: null }))}
          />

          <button
            type="button"
            onClick={() => setFilters((prev) => ({ ...prev, flagged: !prev.flagged }))}
            aria-pressed={filters.flagged}
            title="Only the ones the AI wasn't sure about"
            className={`flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[0.76rem] transition-colors ${
              filters.flagged
                ? "border-amber bg-amber-soft text-amber"
                : "border-line-strong text-ink-soft hover:border-amber hover:text-ink"
            }`}
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-amber"
            />
            Unsure
          </button>

          <ViewSwitch
            view={view}
            onPick={(next) => viewPrefs.set({ view: next })}
          />
        </div>

        <div className="flex min-h-[1.15rem] items-center gap-3 px-0.5">
          <p className="font-data text-[0.66rem] text-ink-faint">
            {matches !== null
              ? `${matches.length} match${matches.length === 1 ? "" : "es"} · open and done, never archived`
              : applied || filters.query
                ? `${visible.length} of ${inBucket}`
                : ""}
          </p>
          {(applied > 0 || filters.query) && (
            <button
              type="button"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setMatches(null);
              }}
              className="font-data text-[0.66rem] text-ink-faint transition-colors hover:text-ink"
            >
              clear filters
            </button>
          )}
          {undo && (
            <p role="status" className="ml-auto flex items-center gap-2 text-[0.74rem] text-ink-soft">
              <span className="max-w-[16ch] truncate">{undo.title}</span>
              <span className="font-data text-[0.66rem] text-ink-faint">
                → {undo.to}
              </span>
              <button
                type="button"
                onClick={() => {
                  void move(undo.id, undo.from);
                  setUndo(null);
                }}
                className="text-iris underline underline-offset-2"
              >
                undo
              </button>
            </p>
          )}
          {error && (
            <p role="alert" className="ml-auto text-[0.74rem] text-blush">
              {error}
            </p>
          )}
        </div>

        {matches !== null ? (
          <section>
            {matches.length === 0 ? (
              <p className="px-1.5 py-3 text-[0.82rem] text-ink-soft">
                Nothing matched. Try fewer words.
              </p>
            ) : (
              <ul>
                {matches.map((hit) => (
                  <li key={hit.id} className="border-b border-line/60 last:border-b-0">
                    <Link
                      href={`/thoughts/${hit.id}`}
                      className="flex items-center gap-3 rounded-lg px-1.5 py-2.5 transition-colors hover:bg-surface-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-[0.88rem] text-ink">
                        {hit.title}
                      </span>
                      {hit.via && (
                        <span className="shrink-0 font-data text-[0.62rem] text-ink-faint">
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
          <Empty bucket={bucket} filtered={applied > 0 || Boolean(filters.query)} onClear={() => setFilters(EMPTY_FILTERS)} />
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
    </div>
  );
}

/** Four shapes, drawn as themselves. The label is on the tooltip rather than
 *  on screen — this control is used constantly and named once. */
function ViewSwitch({
  view,
  onPick,
}: {
  view: ViewMode;
  onPick: (view: ViewMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="How to show your thoughts"
      className="flex items-center gap-0.5 rounded-full border border-line-strong p-0.5"
    >
      {VIEWS.map((option, index) => {
        const on = view === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onPick(option.key)}
            aria-pressed={on}
            aria-label={option.label}
            title={`${option.label} · ${index + 1}`}
            className={`rounded-full p-1.5 transition-colors ${
              on ? "bg-iris-soft text-iris" : "text-ink-faint hover:text-ink"
            }`}
          >
            <ViewIcon view={option.key} />
          </button>
        );
      })}
    </div>
  );
}
