"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

import { freshness } from "@/lib/freshness";

/**
 * Serves what the browser already has, then quietly replaces it.
 *
 * With `staleTimes` on, arriving at a screen you have seen recently costs no
 * request at all — Next.js paints the copy it kept. That is the speed. This is
 * the honesty: once the screen is up, the same route is asked for again in the
 * background and the answer is merged in. `router.refresh()` clears the client
 * cache for the current route only, and swaps the payload without touching
 * component state or scroll, so a list you are already reading updates under
 * you rather than flashing.
 *
 * The rules it follows are the ones that keep this from becoming a poll:
 *
 * - **Never on arrival.** The first time a route is seen the server has just
 *   rendered it. Refreshing then is asking twice for the same thing.
 * - **Not if it was just here.** Bouncing between two screens is one gesture,
 *   not two reasons to re-fetch.
 * - **On return to the tab**, because that is where the data has actually had
 *   time to go stale — a morning away, another device, a phone.
 * - **Always after a write**, wherever it happened. `freshness.forget()` runs
 *   on every non-GET through the PocketBase client, so a tag renamed on Tags is
 *   right on Thoughts a moment after you get there.
 */

/** How long a route's data is treated as good enough to reuse untouched. Below
 *  `staleTimes.dynamic`, so the browser's own copy is always still there when
 *  this decides not to bother. */
const FRESH_MS = 45_000;

export default function FreshData() {
  const router = useRouter();
  const pathname = usePathname();

  const refreshIfStale = useCallback(() => {
    const age = freshness.age(pathname);

    // Nothing known about this route: it is on screen because the server just
    // built it, so it is as fresh as it will ever be.
    if (age === null) {
      freshness.mark(pathname);
      return;
    }
    if (age < FRESH_MS) return;

    freshness.mark(pathname);
    router.refresh();
  }, [pathname, router]);

  useEffect(() => {
    // After paint, not during it. The point is that nothing on screen waits for
    // this, and a refresh started inside the navigation would be queued behind
    // the same work it is trying to stay out of the way of.
    const id = window.setTimeout(refreshIfStale, 0);
    return () => window.clearTimeout(id);
  }, [refreshIfStale]);

  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState === "visible") refreshIfStale();
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [refreshIfStale]);

  return null;
}
