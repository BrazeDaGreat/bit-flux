"use client";

import { useSyncExternalStore } from "react";

/**
 * Which size class the browser is in — for *behaviour*, never for layout.
 *
 * A layout that differs by width belongs in CSS (`lg:hidden`, `hidden lg:block`),
 * because CSS is correct during the server render and this hook cannot be: the
 * server has no width, so it answers "desktop" and the browser corrects it on
 * mount. Anything that would be visibly wrong for that one frame must not use
 * this.
 *
 * What it is for is the handful of decisions that are not renderable — whether
 * a popover opens as a bottom sheet, whether a field takes focus on load,
 * whether Enter sends or makes a newline. Those all happen after a user action,
 * long past hydration, so the first-frame answer never reaches the screen.
 *
 * The boundaries match the Tailwind ones the app already uses, stated once so
 * a component can't drift a pixel away from the stylesheet.
 */
export const MEDIA = {
  /** Phones and tablets — everything the desktop layout is not designed for. */
  compact: "(max-width: 1023.98px)",
  /** Tablets only: the floating window is back, the sill is not. */
  medium: "(min-width: 768px) and (max-width: 1023.98px)",
  /** Phones only. */
  phone: "(max-width: 767.98px)",
} as const;

/** One store per query, so subscribing twice to the same media query costs one
 *  listener and returns one identity. */
const stores = new Map<
  string,
  { subscribe: (listener: () => void) => () => void; getSnapshot: () => boolean }
>();

function storeFor(query: string) {
  const existing = stores.get(query);
  if (existing) return existing;

  const store = {
    subscribe(listener: () => void) {
      const list = window.matchMedia(query);
      list.addEventListener("change", listener);
      return () => list.removeEventListener("change", listener);
    },
    getSnapshot() {
      return window.matchMedia(query).matches;
    },
  };
  stores.set(query, store);
  return store;
}

function serverSnapshot(): boolean {
  return false;
}

export function useMediaQuery(query: string): boolean {
  const store = storeFor(query);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, serverSnapshot);
}

/** True below 1024px — a phone or a tablet. */
export function useIsCompact(): boolean {
  return useMediaQuery(MEDIA.compact);
}

/** True below 768px — a phone, where the sill replaces the rail. */
export function useIsPhone(): boolean {
  return useMediaQuery(MEDIA.phone);
}
