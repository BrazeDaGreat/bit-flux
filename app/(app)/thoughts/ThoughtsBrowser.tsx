"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { setStatus } from "@/lib/thought-actions";
import type { TagRecord, ThoughtRecord } from "@/lib/types";
import { viewPrefs } from "@/lib/view-prefs";
import {
  activeCount,
  applyFilters,
  EMPTY_FILTERS,
  type Bucket,
  type Filters,
  type ViewMode,
  type WhenKey,
} from "./filters";
import QuickFilter from "./QuickFilter";
import { CalendarView, ListView, TagsView, TimelineView } from "./views";

const BUCKETS: { key: Bucket; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "done", label: "Done" },
  { key: "archived", label: "Archived" },
];

const VIEWS: { key: ViewMode; label: string }[] = [
  { key: "tags", label: "Tags" },
  { key: "list", label: "List" },
  { key: "timeline", label: "Timeline" },
  { key: "calendar", label: "Calendar" },
];

const WHEN: { value: WhenKey; label: string }[] = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "week", label: "Next 7 days" },
  { value: "none", label: "No date" },
];

interface SearchHit {
  id: string;
  title: string;
  via?: string;
}

/**
 * Everything on this screen is already in the browser, so narrowing it is
 * instant and nothing navigates. Two decisions sit above the list and never
 * move: which pile you are in — open work, finished work, or the archive,
 * which are three separate places and never mix — and which shape you want to
 * see it in.
 */
export default function ThoughtsBrowser({
  thoughts,
  tags,
  people,
}: {
  thoughts: ThoughtRecord[];
  tags: TagRecord[];
  people: string[];
}) {
  const router = useRouter();

  const prefs = useSyncExternalStore(
    viewPrefs.subscribe,
    viewPrefs.getSnapshot,
    viewPrefs.getServerSnapshot
  );
  const view = prefs.view as ViewMode;
  const bucket = prefs.bucket as Bucket;

  const [items, setItems] = useState(thoughts);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [matches, setMatches] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<{
    id: string;
    title: string;
    from: ThoughtRecord["status"];
    to: ThoughtRecord["status"];
  } | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  // A server refresh (after an edit elsewhere) replaces what's on screen.
  useEffect(() => setItems(thoughts), [thoughts]);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 7000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  const counts = useMemo(() => {
    const out: Record<Bucket, number> = { open: 0, done: 0, archived: 0 };
    for (const thought of items) {
      if (thought.status in out) out[thought.status as Bucket] += 1;
    }
    return out;
  }, [items]);

  const visible = useMemo(
    () => applyFilters(items, bucket, filters),
    [items, bucket, filters]
  );

  const applied = activeCount(filters);
  const inBucket = counts[bucket];

  const move = useCallback(
    async (id: string, status: ThoughtRecord["status"]) => {
      const before = items.find((t) => t.id === id);
      if (!before || before.status === status) return;

      setError(null);
      setItems((prev) =>
        prev.map((thought) =>
          thought.id === id
            ? {
                ...thought,
                status,
                ...(status === "archived"
                  ? { embedding: null, embedding_model: "" }
                  : {}),
              }
            : thought
        )
      );
      setUndo({ id, title: before.title, from: before.status, to: status });

      try {
        await setStatus(id, status);
        router.refresh();
      } catch {
        setItems((prev) =>
          prev.map((thought) => (thought.id === id ? before : thought))
        );
        setUndo(null);
        setError("That change didn't stick. Try again.");
      }
    },
    [items, router]
  );

  /** Typing filters what's here; Enter also asks the server, which can match
   *  on meaning rather than on the words you typed. */
  async function searchMeaning(event: React.FormEvent) {
    event.preventDefault();
    const q = filters.query.trim();
    if (!q) {
      setMatches(null);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
      });
      const data = (await res.json()) as { hits?: SearchHit[] };
      setMatches(data.hits ?? []);
    } catch {
      setError("Couldn't run that search.");
    } finally {
      setSearching(false);
    }
  }

  // 1–4 switch view, Escape clears. Nothing fires while a field has focus.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

      if (event.key === "Escape") {
        setFilters(EMPTY_FILTERS);
        setMatches(null);
        if (typing && target instanceof HTMLElement) target.blur();
        return;
      }
      if (typing) return;

      const index = Number(event.key) - 1;
      if (index >= 0 && index < VIEWS.length) {
        event.preventDefault();
        viewPrefs.set({ view: VIEWS[index].key });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const viewProps = { thoughts: visible, tags, onStatus: move };

  return (
    <div className="flex flex-col gap-3.5">
      {/* Three piles, one line. Done work stays visible as an achievement;
          archived work stays out of the way until asked for. */}
      <div
        className="flex items-baseline gap-4 border-b pb-2"
        style={{ borderColor: "var(--line)" }}
        role="group"
        aria-label="Which thoughts"
      >
        {BUCKETS.map((option) => {
          const on = bucket === option.key;
          // The underline sits exactly on the rule below the row.
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={on}
              onClick={() => viewPrefs.set({ bucket: option.key })}
              className={`flex items-baseline gap-1.5 border-b-2 pb-1.5 text-[0.88rem] transition-colors ${
                on
                  ? "border-iris text-ink"
                  : "border-transparent text-ink-faint hover:text-ink-soft"
              }`}
              style={{ marginBottom: "calc(-0.5rem - 1px)" }}
            >
              {option.label}
              <span className="font-data text-[0.66rem] opacity-70">
                {counts[option.key]}
              </span>
            </button>
          );
        })}
      </div>

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
    </div>
  );
}

const EMPTY_COPY: Record<Bucket, { title: string; hint: string }> = {
  open: {
    title: "Nothing open.",
    hint: "Write something and it'll show up sorted.",
  },
  done: {
    title: "Nothing finished yet.",
    hint: "Tick a thought's circle and it lands here.",
  },
  archived: {
    title: "The archive is empty.",
    hint: "Archiving takes a thought out of every list, and out of what Ask can see.",
  },
};

function Empty({
  bucket,
  filtered,
  onClear,
}: {
  bucket: Bucket;
  filtered: boolean;
  onClear: () => void;
}) {
  const copy = EMPTY_COPY[bucket];
  return (
    <div className="rounded-2xl border border-dashed border-line-strong px-5 py-10 text-center">
      <p className="font-hand text-[1.05rem] text-ink">
        {filtered ? "Nothing matches." : copy.title}
      </p>
      <p className="mt-1 text-[0.8rem] text-ink-soft">
        {filtered ? "Those filters are too narrow." : copy.hint}
      </p>
      {filtered ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-3 rounded-full bg-iris px-4 py-1.5 text-[0.8rem] font-medium text-white dark:text-[#1a1622]"
        >
          Clear filters
        </button>
      ) : bucket === "open" ? (
        <Link
          href="/"
          className="mt-3 inline-block rounded-full bg-iris px-4 py-1.5 text-[0.8rem] font-medium text-white dark:text-[#1a1622]"
        >
          Write something
        </Link>
      ) : null}
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

function ViewIcon({ view }: { view: ViewMode }) {
  const common = {
    viewBox: "0 0 16 16",
    className: "h-3.5 w-3.5",
    "aria-hidden": true,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
  };

  if (view === "timeline") {
    // A line with stops on it.
    return (
      <svg {...common}>
        <path d="M4 2.5v11" />
        <circle cx="4" cy="5.5" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="4" cy="10.5" r="1.3" fill="currentColor" stroke="none" />
        <path d="M7 5.5h6M7 10.5h4" />
      </svg>
    );
  }
  if (view === "calendar") {
    return (
      <svg {...common}>
        <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
        <path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2" />
      </svg>
    );
  }
  if (view === "tags") {
    return (
      <svg {...common}>
        <path d="M8.6 2.5H13v4.4l-6 6-4.4-4.4z" strokeLinejoin="round" />
        <circle cx="10.6" cy="5" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M3 4.5h10M3 8h10M3 11.5h6" />
    </svg>
  );
}
