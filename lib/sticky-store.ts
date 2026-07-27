"use client";

/**
 * The button that asks for the note window and the thing that owns it are on
 * opposite sides of the app.
 *
 * They have to be. A picture-in-picture window is not a window in the way a
 * popup is — its document is a portal out of this one, so it lives exactly as
 * long as the React tree that renders into it. Owned by Capture, it would close
 * the moment you went to look at your thoughts, which is most of the reason to
 * have opened it. So the owner sits in the app layout, which outlives every
 * page, and the trigger stays where it belongs on Capture and shouts across.
 *
 * Listeners are called synchronously inside the click, because a picture-in-
 * picture window can only be requested while the browser still considers a
 * gesture to be in progress.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export const stickyStore = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Call straight from an event handler — never from an effect or a promise. */
  request() {
    for (const listener of listeners) listener();
  },
};
