"use client";

/**
 * The order the tag view stacks its piles in.
 *
 * This is an arrangement, not a fact about the tags: Family above Work is a
 * statement about whose week it is, and it belongs with the other things this
 * browser remembers about how you were looking — same shelf as `view-prefs`,
 * same reasoning. Keeping it local also means a drag lands in the frame it
 * happens in, with nothing to fail and nothing to undo.
 *
 * Ids that aren't in the stored list keep their natural order behind the ones
 * that are, so a tag made after the last drag appears rather than vanishing.
 */

const KEY = "flux.thoughts.tagorder";

let cache: string[] = [];
const listeners = new Set<() => void>();

const EMPTY: string[] = [];

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return EMPTY;
    const next = parsed.filter((id): id is string => typeof id === "string");
    // useSyncExternalStore compares by reference, so a re-read only produces a
    // new array when the contents actually moved.
    if (next.length !== cache.length || next.some((id, i) => id !== cache[i])) {
      cache = next;
    }
    return cache;
  } catch {
    return EMPTY;
  }
}

export const tagOrder = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    window.addEventListener("storage", listener);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", listener);
    };
  },
  getSnapshot: read,
  getServerSnapshot(): string[] {
    return EMPTY;
  },
  set(ids: string[]) {
    cache = ids;
    localStorage.setItem(KEY, JSON.stringify(ids));
    for (const listener of listeners) listener();
  },
};

/** Sorts by the stored order, with anything unplaced trailing in the order it
 *  arrived. Pure, so both the view and its drag handler can call it. */
export function applyTagOrder<T extends { id: string }>(
  items: T[],
  order: string[]
): T[] {
  if (order.length === 0) return items;
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const left = rank.get(a.id) ?? Infinity;
    const right = rank.get(b.id) ?? Infinity;
    if (left === right) return items.indexOf(a) - items.indexOf(b);
    return left - right;
  });
}

/** Moves one id to where another one sits, and returns the full new order —
 *  full, because a partial list would silently re-rank everything behind it. */
export function moveTag(
  ids: string[],
  from: string,
  to: string
): string[] {
  const next = ids.filter((id) => id !== from);
  const at = next.indexOf(to);
  if (at === -1) return [...ids];
  const before = ids.indexOf(from) < ids.indexOf(to);
  next.splice(before ? at + 1 : at, 0, from);
  return next;
}
