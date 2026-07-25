"use client";

/**
 * Whether a composer somewhere in the app currently has the caret.
 *
 * One screen needs this: Ask on a phone. A conversation, a keyboard, a
 * two-row composer and a nav bar above the home indicator leaves almost
 * nothing for the answer you are reading — so the sill steps out while you
 * type and comes back the moment you stop. That is the single, deliberate
 * exception to navigation always being visible, and it only applies to a state
 * the user entered on purpose.
 *
 * It lives in a store rather than in React state because the two components
 * involved — the composer and the sill — are on opposite sides of the app
 * layout and share no ancestor below it.
 */
const listeners = new Set<() => void>();
let typing = false;

export const composerStore = {
  set(next: boolean) {
    if (typing === next) return;
    typing = next;
    for (const notify of listeners) notify();
  },
  subscribe(notify: () => void) {
    listeners.add(notify);
    return () => {
      listeners.delete(notify);
    };
  },
  getSnapshot(): boolean {
    return typing;
  },
  /** The server has no caret. */
  getServerSnapshot(): boolean {
    return false;
  },
};
