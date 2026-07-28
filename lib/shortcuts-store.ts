"use client";

/**
 * The keyboard guide lives in the app shell, while triggers for it can live
 * anywhere. Keep the request synchronous and tiny, like the PiP trigger store,
 * so opening the guide does not require coupling those surfaces together.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export const shortcutsStore = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  request() {
    for (const listener of listeners) listener();
  },
};
