"use client";

/**
 * How you were last looking at your thoughts is a browser preference, not page
 * state: it should survive a reload and follow you between tabs. Filters
 * deliberately don't — coming back to a list that is quietly hiding most of
 * itself is how things get lost.
 */

const KEY = "flux.thoughts.view";

export interface ViewPrefs {
  view: string;
  bucket: string;
}

const DEFAULTS: ViewPrefs = { view: "list", bucket: "open" };

let cache: ViewPrefs = DEFAULTS;
const listeners = new Set<() => void>();

function read(): ViewPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ViewPrefs>;
    const next = {
      view: parsed.view ?? DEFAULTS.view,
      bucket: parsed.bucket ?? DEFAULTS.bucket,
    };
    // useSyncExternalStore compares by reference, so the parsed object is only
    // replaced when something actually changed.
    if (next.view !== cache.view || next.bucket !== cache.bucket) cache = next;
    return cache;
  } catch {
    return DEFAULTS;
  }
}

export const viewPrefs = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    window.addEventListener("storage", listener);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", listener);
    };
  },
  getSnapshot: read,
  getServerSnapshot(): ViewPrefs {
    return DEFAULTS;
  },
  set(next: Partial<ViewPrefs>) {
    cache = { ...read(), ...next };
    localStorage.setItem(KEY, JSON.stringify(cache));
    for (const listener of listeners) listener();
  },
};
