"use client";

/**
 * When each screen's data was last known to be current.
 *
 * Its own module, not state inside `FreshData`, for two reasons: it has to
 * survive that component unmounting — which happens on every navigation — and
 * the code that needs to invalidate it is a PocketBase hook, not a component.
 */

const fetched = new Map<string, number>();

export const freshness = {
  /** Milliseconds since this route was last known current, or `null` if it has
   *  never been seen — which means the server is rendering it right now. */
  age(path: string): number | null {
    const at = fetched.get(path);
    return at === undefined ? null : Date.now() - at;
  },

  mark(path: string) {
    fetched.set(path, Date.now());
  },

  /**
   * Something was written, so every screen's kept copy is now suspect —
   * including the ones this write wasn't about. Renaming a tag changes the
   * filter list on Thoughts and the roster on Ask; there is no map from a write
   * to the screens it touches, and guessing one wrong is how a screen quietly
   * shows something that stopped being true.
   *
   * Nothing is thrown away and nothing is re-fetched here: this only removes
   * permission to skip the next background refresh. The screen still paints
   * instantly from what the browser has, and corrects a moment later.
   */
  forget() {
    fetched.clear();
  },
};
