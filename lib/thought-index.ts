"use client";

import { pb } from "./pb";

/**
 * Every thought you could refer to, by title.
 *
 * The picker has to answer a keystroke, so it cannot go to the network for
 * each one. Titles are short and there are not many of them, so the whole
 * list is fetched once — the first time a `#` is typed anywhere in the app —
 * and shared by every composer after that.
 *
 * Archived thoughts are not in it. Archiving is how a person takes something
 * out of circulation, and retrieval already honours that (`NOT_ARCHIVED` in
 * `lib/search.ts`); a list you can still point at would put it back.
 */

export interface IndexedThought {
  id: string;
  title: string;
  status: "open" | "done";
  created: string;
}

export interface IndexState {
  thoughts: IndexedThought[];
  status: "idle" | "loading" | "ready" | "error";
}

type Listener = () => void;

const listeners = new Set<Listener>();

let state: IndexState = { thoughts: [], status: "idle" };
const SERVER_STATE = state;

/** Titles change under you — an edit on another screen, a dump just sorted.
 *  Short enough that a stale row is rare, long enough that opening the list
 *  four times in a minute is one request. */
const FRESH_FOR = 60_000;
let fetchedAt = 0;
let inFlight: Promise<void> | null = null;

function set(next: Partial<IndexState>) {
  state = { ...state, ...next };
  for (const notify of listeners) notify();
}

async function fetchThoughts(): Promise<void> {
  set({ status: "loading" });
  try {
    const records = await pb()
      .collection("flux_thoughts")
      .getFullList<IndexedThought>({
        filter: 'status != "archived"',
        fields: "id,title,status,created",
        sort: "-created",
      });
    fetchedAt = Date.now();
    set({ thoughts: records, status: "ready" });
  } catch {
    // A picker with nothing in it says so on its own; there is no second
    // screen to send anyone to, so there is no message worth raising.
    set({ status: "error" });
  } finally {
    inFlight = null;
  }
}

export const thoughtIndex = {
  /** Called every time a `#` opens the list. Cheap after the first one. */
  load(): void {
    if (inFlight) return;
    if (state.status === "ready" && Date.now() - fetchedAt < FRESH_FOR) return;
    inFlight = fetchThoughts();
  },
  /** After a thought is created or renamed, the next `#` should see it. */
  invalidate(): void {
    fetchedAt = 0;
  },
  subscribe(notify: Listener) {
    listeners.add(notify);
    return () => {
      listeners.delete(notify);
    };
  },
  getSnapshot(): IndexState {
    return state;
  },
  getServerSnapshot(): IndexState {
    return SERVER_STATE;
  },
};

/**
 * Ranking, in the order a person thinks: the thought whose title *starts* the
 * way they typed, then one that merely contains it, then the most recent. No
 * fuzzy matching — a list that reorders itself around a typo is a list you
 * have to re-read, which is the one thing this control cannot cost.
 */
export function matchThoughts(
  thoughts: IndexedThought[],
  query: string,
  limit = 7
): IndexedThought[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return thoughts.slice(0, limit);

  const starts: IndexedThought[] = [];
  const contains: IndexedThought[] = [];

  for (const thought of thoughts) {
    const title = thought.title.toLowerCase();
    if (title.startsWith(needle)) starts.push(thought);
    else if (title.includes(needle)) contains.push(thought);
    if (starts.length >= limit) break;
  }

  return [...starts, ...contains].slice(0, limit);
}
