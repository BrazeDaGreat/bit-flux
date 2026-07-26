"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { CaretPoint } from "@/lib/mention-dom";
import type { IndexedThought } from "@/lib/thought-index";

/**
 * The list a `#` opens. It is drawn to be read in one glance and then
 * forgotten:
 *
 * - **Seven rows, never a scrollbar.** A list you have to scroll is a list you
 *   have to re-read. Past seven the answer is not "look harder", it is "type
 *   another letter", and the footer says so.
 * - **Each row is the sentence you wrote**, in the same serif you wrote it in,
 *   on one line. No dates, no tags, no snippet, no icon — the title is how you
 *   recognise a thought in every other list in this app, so it is the whole
 *   row here.
 * - **The match is tinted, not boxed.** Finding your thought is a colour scan
 *   rather than a word-by-word read.
 * - **One dot for status**, mint when it is done. Six pixels, and it stops you
 *   pointing at something finished by accident.
 *
 * Who opens it, and what happens when a row is taken, is `MentionField`'s
 * business — this only draws.
 */

/** Seven is the most that can be taken in without counting. */
export const LIMIT = 7;
const WIDTH = 300;
const GAP = 8;
const EDGE = 10;

export function MentionPopover({
  open,
  point,
  query,
  matches,
  hidden,
  cursor,
  onHover,
  onPick,
  onReposition,
}: {
  open: boolean;
  point: CaretPoint | null;
  query: string;
  matches: IndexedThought[];
  hidden: number;
  cursor: number;
  onHover: (index: number) => void;
  onPick: (thought: IndexedThought) => void;
  onReposition: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [above, setAbove] = useState(false);

  // The list follows the field rather than floating away from it when the page
  // moves underneath — the composer sits at the bottom of a scrolling
  // transcript on one of these screens.
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open, onReposition]);

  // Below the caret unless below is off the screen. Measured rather than
  // guessed: the panel's height is however many rows matched.
  useLayoutEffect(() => {
    if (!open || !point || !panel.current) return;
    const height = panel.current.offsetHeight;
    const fitsBelow = point.top + point.height + GAP + height < window.innerHeight - EDGE;
    setAbove(!fitsBelow && point.top - GAP - height > EDGE);
  }, [open, point, matches.length]);

  useEffect(() => {
    if (!open) return;
    panel.current
      ?.querySelector(`[data-row="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor, open]);

  if (!open || !point || typeof document === "undefined") return null;

  const left = Math.min(
    Math.max(EDGE, point.left - 12),
    Math.max(EDGE, window.innerWidth - WIDTH - EDGE)
  );

  return createPortal(
    <div
      ref={panel}
      role="listbox"
      aria-label="Thoughts you can mention"
      className="fixed z-[70] overflow-hidden rounded-2xl border border-line bg-surface py-1 motion-safe:animate-[flux-unfold_140ms_ease-out]"
      style={{
        left,
        top: above ? undefined : point.top + point.height + GAP,
        bottom: above ? window.innerHeight - point.top + GAP : undefined,
        width: `min(${WIDTH}px, calc(100vw - ${EDGE * 2}px))`,
        boxShadow: "0 18px 40px -18px rgb(0 0 0 / 0.45)",
      }}
    >
      {matches.map((thought, index) => {
        const on = index === cursor;
        return (
          <button
            key={thought.id}
            type="button"
            role="option"
            aria-selected={on}
            data-row={index}
            // Keeps the caret in the field through the press: a blur here would
            // close the list before the click landed on it.
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => onHover(index)}
            onClick={() => onPick(thought)}
            className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors max-lg:min-h-[var(--tap)] ${
              on ? "bg-iris-soft" : ""
            }`}
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{
                background:
                  thought.status === "done" ? "var(--mint)" : "var(--line-strong)",
              }}
            />
            <span className="min-w-0 flex-1 truncate font-hand text-[0.95rem] leading-[1.5] text-ink max-lg:text-[1rem]">
              <Highlight title={thought.title} query={query} />
            </span>
          </button>
        );
      })}

      {/* One line, and only when it has something true to say: where the rest
          of the matches went, and how to take one. */}
      {(hidden > 0 || matches.length > 1) && (
        <div className="mt-0.5 flex items-baseline gap-2 border-t border-line px-3 pb-0.5 pt-1.5">
          <span className="min-w-0 flex-1 truncate font-data text-[0.62rem] text-ink-faint">
            {hidden > 0 ? `${hidden} more — keep typing` : ""}
          </span>
          <span className="shrink-0 font-data text-[0.62rem] text-ink-faint max-lg:hidden">
            ↑↓ ↵
          </span>
        </div>
      )}
    </div>,
    document.body
  );
}

/** The part you typed, in the accent. Everything else stays the colour of the
 *  sentence it came from. */
function Highlight({ title, query }: { title: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{title}</>;

  const at = title.toLowerCase().indexOf(needle.toLowerCase());
  if (at === -1) return <>{title}</>;

  return (
    <>
      {title.slice(0, at)}
      <span className="font-medium text-iris">
        {title.slice(at, at + needle.length)}
      </span>
      {title.slice(at + needle.length)}
    </>
  );
}
