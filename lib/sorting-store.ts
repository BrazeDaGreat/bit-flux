"use client";

/**
 * Tracks which dumps are being sorted right now. Sorting is started on the
 * capture screen but reported in the window's corner, which lives in the
 * layout — so the state can't hang off either component.
 *
 * A module store rather than context: no provider to thread through, and the
 * indicator re-renders without re-rendering the composer the user is typing
 * into.
 */

type Listener = () => void;

const active = new Set<string>();
const listeners = new Set<Listener>();

/** useSyncExternalStore compares by reference, so the snapshot is cached and
 *  only replaced when the set actually changes. Returning a fresh array each
 *  call makes React loop. */
const EMPTY: string[] = [];
let snapshot: string[] = EMPTY;

function emit() {
  snapshot = active.size === 0 ? EMPTY : [...active];
  for (const listener of listeners) listener();
}

export const sortingStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): string[] {
    return snapshot;
  },
  getServerSnapshot(): string[] {
    return EMPTY;
  },
  start(id: string) {
    if (active.has(id)) return;
    active.add(id);
    emit();
  },
  finish(id: string) {
    if (!active.delete(id)) return;
    emit();
  },
};
