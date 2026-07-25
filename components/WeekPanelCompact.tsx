"use client";

import Link from "next/link";
import { useState } from "react";

import { Caret } from "@/components/Chips";
import type { DashboardData } from "@/lib/dashboard";
import { tone, weekItems, when } from "./week-panel-data";

/**
 * The same week, one line high.
 *
 * On a phone this is below the composer rather than beside it, which means it
 * is competing with the screen's whole job for attention. So it opens closed:
 * a count and how much of it is late, which is the entire answer most of the
 * time, and the list itself is one tap away. Same inline disclosure a thought
 * row uses — no sheet, no new page, nothing above the thing you came here to
 * do moves.
 */
export default function WeekPanelCompact({ data }: { data: DashboardData }) {
  const [open, setOpen] = useState(false);
  const items = weekItems(data);
  const late = data.overdue.length;

  if (items.length === 0 && data.needsReview === 0) return null;

  return (
    <aside className="rounded-2xl border border-line bg-surface-2">
      {items.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="this-week"
          className="tap flex w-full items-center gap-2 px-3.5 text-left"
        >
          <span className="font-data text-[0.75rem] uppercase tracking-[0.14em] text-ink-faint">
            this week
          </span>
          <span className="font-data text-[0.75rem] text-ink-soft">
            {items.length}
          </span>
          {late > 0 && (
            <span className="font-data text-[0.75rem] text-blush">
              {late} late
            </span>
          )}
          <Caret open={open} className="ml-auto text-ink-faint" />
        </button>
      )}

      {open && (
        <ul
          id="this-week"
          className="flex flex-col px-1.5 pb-1.5 motion-safe:animate-[flux-unfold_180ms_ease-out]"
        >
          {items.map((thought) => (
            <li key={thought.id}>
              <Link
                href={`/thoughts/${thought.id}`}
                className="tap flex items-center gap-2.5 rounded-xl px-2 text-[0.95rem]"
              >
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: `var(--${tone(thought, data)})` }}
                />
                <span className="min-w-0 flex-1 truncate leading-snug text-ink">
                  {thought.title}
                </span>
                <span
                  className="shrink-0 font-data text-[0.75rem] text-ink-faint"
                  suppressHydrationWarning
                >
                  {when(thought)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {data.needsReview > 0 && (
        <Link
          href="/thoughts?pane=review"
          className={`tap flex items-center gap-1.5 px-3.5 font-data text-[0.75rem] text-amber ${
            items.length > 0 ? "border-t border-line" : ""
          }`}
        >
          {data.needsReview} to check →
        </Link>
      )}
    </aside>
  );
}
