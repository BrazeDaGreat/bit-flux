"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useIsCompact } from "@/lib/breakpoint";
import {
  deleteThought,
  setStatus,
  setThoughtTags,
} from "@/lib/thought-actions";
import type { TagRecord, ThoughtRecord } from "@/lib/types";
import { viewPrefs } from "@/lib/view-prefs";
import {
  activeCount,
  applyFilters,
  EMPTY_FILTERS,
  type Bucket,
  type Filters,
  type Pane,
  type ViewMode,
  type WhenKey,
} from "./filters";

export const BUCKETS: { key: Bucket; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "done", label: "Done" },
  { key: "archived", label: "Archived" },
];

export const VIEWS: { key: ViewMode; label: string }[] = [
  { key: "tags", label: "Tags" },
  { key: "list", label: "List" },
  { key: "timeline", label: "Timeline" },
  { key: "calendar", label: "Calendar" },
];

export const WHEN: { value: WhenKey; label: string }[] = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "week", label: "Next 7 days" },
  { value: "none", label: "No date" },
];

export interface SearchHit {
  id: string;
  title: string;
  via?: string;
}

export interface ThoughtsBrowserInput {
  thoughts: ThoughtRecord[];
  tags: TagRecord[];
  people: string[];
  settingsId: string | null;
  corrections: string[];
  /** Set when arrived at via /thoughts?pane=review. */
  initialPane?: Pane;
}

/**
 * Everything the thoughts screen knows and everything it can do, with no
 * opinion about how any of it looks.
 *
 * The screen is drawn twice — a pointer-first layout above 1024px and a
 * touch-first one below — and this is what stops that being two screens. One
 * copy of the optimistic status move, one copy of the search, one copy of the
 * undo timer. A shell that wanted its own state would be a second place for
 * the same bug to live.
 */
export function useThoughtsBrowser({
  thoughts,
  tags,
  people,
  initialPane,
}: ThoughtsBrowserInput) {
  const router = useRouter();
  const compact = useIsCompact();

  const prefs = useSyncExternalStore(
    viewPrefs.subscribe,
    viewPrefs.getSnapshot,
    viewPrefs.getServerSnapshot
  );
  const view = prefs.view as ViewMode;
  const pane = prefs.bucket as Pane;
  const bucket: Bucket = pane === "review" ? "open" : pane;

  // A link can point straight at a tab; after that the stored preference is
  // what decides, so returning to the page doesn't drop you back into a queue.
  useEffect(() => {
    if (initialPane) viewPrefs.set({ bucket: initialPane });
  }, [initialPane]);

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

  /** Archiving something is deciding you've stopped caring about it, so it
   *  never asks to be looked at again. Least sure first. */
  const pending = useMemo(
    () =>
      items
        .filter((thought) => thought.needs_review && thought.status !== "archived")
        .sort((a, b) => (a.confidence ?? 0) - (b.confidence ?? 0)),
    [items]
  );

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

  const toggleTag = useCallback(
    async (id: string, tagId: string) => {
      const before = items.find((thought) => thought.id === id);
      if (!before) return;
      const current = before.tags ?? [];
      const next = current.includes(tagId)
        ? current.filter((value) => value !== tagId)
        : [...current, tagId];

      setError(null);
      setItems((prev) =>
        prev.map((thought) =>
          thought.id === id ? { ...thought, tags: next } : thought
        )
      );

      try {
        await setThoughtTags(id, next);
        router.refresh();
      } catch {
        setItems((prev) =>
          prev.map((thought) => (thought.id === id ? before : thought))
        );
        setError("That tag change didn't stick. Try again.");
      }
    },
    [items, router]
  );

  const remove = useCallback(
    async (id: string) => {
      const index = items.findIndex((thought) => thought.id === id);
      const before = items[index];
      if (!before) return;

      setError(null);
      setItems((prev) => prev.filter((thought) => thought.id !== id));

      try {
        await deleteThought(id);
        router.refresh();
      } catch {
        setItems((prev) => {
          if (prev.some((thought) => thought.id === id)) return prev;
          const restored = [...prev];
          restored.splice(Math.min(index, restored.length), 0, before);
          return restored;
        });
        setError("Couldn't delete that thought. Try again.");
      }
    },
    [items, router]
  );

  /** Typing filters what's here; Enter also asks the server, which can match
   *  on meaning rather than on the words you typed. */
  const searchMeaning = useCallback(
    async (event: React.FormEvent) => {
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
    },
    [filters.query]
  );

  const clearAll = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setMatches(null);
  }, []);

  // 1–4 switch view, Escape clears. Nothing fires while a field has focus, or
  // while the review queue is up — it has no views to switch between. A phone
  // has no number row to hold down, and registering it there would only mean a
  // stray keystroke from a paired keyboard changing a view nobody asked about.
  useEffect(() => {
    if (pane === "review" || compact) return;
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
  }, [pane, compact]);

  const viewProps = {
    thoughts: visible,
    tags,
    onStatus: move,
    onToggleTag: toggleTag,
    onDelete: remove,
  };

  /** Lets the pending count drop the moment a decision is made in the queue. */
  const onReviewResolved = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((thought) =>
        thought.id === id ? { ...thought, needs_review: false } : thought
      )
    );
  }, []);

  return {
    tags,
    people,
    view,
    pane,
    bucket,
    reviewing: pane === "review",
    filters,
    setFilters,
    clearAll,
    matches,
    setMatches,
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
    viewProps,
    onReviewResolved,
  };
}

export type ThoughtsBrowserState = ReturnType<typeof useThoughtsBrowser>;
