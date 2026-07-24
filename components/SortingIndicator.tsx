"use client";

import { useSyncExternalStore } from "react";

import { sortingStore } from "@/lib/sorting-store";

/**
 * Pinned to the window's bottom-right corner. Sorting happens in the
 * background so capture never blocks, but silent background work is
 * unnerving — this is the receipt that something is happening.
 */
export default function SortingIndicator() {
  const active = useSyncExternalStore(
    sortingStore.subscribe,
    sortingStore.getSnapshot,
    sortingStore.getServerSnapshot
  );

  if (active.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-line bg-surface-2/90 px-3 py-1.5 backdrop-blur"
      style={{ boxShadow: "0 4px 16px -6px rgb(0 0 0 / 0.25)" }}
    >
      <Spinner />
      <span className="font-data text-[0.68rem] text-ink-soft">
        {active.length === 1 ? "sorting" : `sorting ${active.length}`}
      </span>
    </div>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 flux-spin" aria-hidden="true">
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="var(--line-strong)"
        strokeWidth="2"
      />
      <path
        d="M8 2a6 6 0 0 1 6 6"
        fill="none"
        stroke="var(--iris)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
