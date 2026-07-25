"use client";

import Link from "next/link";

import { Caret } from "@/components/Chips";
import { toDate } from "@/lib/time";
import type { TagRecord, ThoughtRecord } from "@/lib/types";
import { dueValue, whenOf } from "./filters";

/**
 * One thought, three ways to see it, one gesture for each thing you can do.
 *
 * The circle on the left is the whole completion story: click it and the
 * thought is done, click it again and it isn't. Nothing else in the row moves —
 * the title keeps its place, weight and padding whether it's open, done or
 * expanded, so a list never jumps under the cursor.
 */

export interface RowActions {
  onStatus: (id: string, status: ThoughtRecord["status"]) => void;
}

const TONE: Record<string, string> = {
  overdue: "blush",
  today: "iris",
  week: "sky",
  later: "ink-faint",
  none: "ink-faint",
};

export function StatusDot({
  thought,
  onStatus,
}: {
  thought: ThoughtRecord;
} & RowActions) {
  const done = thought.status === "done";
  const archived = thought.status === "archived";

  return (
    <button
      type="button"
      onClick={() => onStatus(thought.id, done || archived ? "open" : "done")}
      aria-pressed={done}
      aria-label={done ? `Reopen ${thought.title}` : `Mark ${thought.title} done`}
      title={done ? "Reopen" : archived ? "Bring back" : "Mark done"}
      className="grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors"
      style={{
        borderColor: done ? "var(--mint)" : "var(--line-strong)",
        background: done ? "var(--mint-soft)" : "transparent",
      }}
    >
      {done ? (
        <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
          <path
            d="M2.5 6.2 4.8 8.5 9.5 3.8"
            fill="none"
            stroke="var(--mint)"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : archived ? (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--sage)" }}
        />
      ) : null}
    </button>
  );
}

export function DateStamp({ thought }: { thought: ThoughtRecord }) {
  const value = dueValue(thought);
  if (!value) return null;
  const tone = TONE[whenOf(thought)] ?? "ink-faint";
  return (
    <span
      className="shrink-0 font-data text-[0.62rem]"
      style={{ color: `var(--${tone})` }}
      suppressHydrationWarning
    >
      {toDate(value).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      })}
    </span>
  );
}

export function ThoughtRow({
  thought,
  tags,
  expanded,
  onToggle,
  onStatus,
}: {
  thought: ThoughtRecord;
  tags: TagRecord[];
  expanded: boolean;
  onToggle: () => void;
} & RowActions) {
  const done = thought.status === "done";
  const panelId = `thought-${thought.id}-detail`;

  return (
    <li className="border-b border-line/60 last:border-b-0">
      <div className="group flex items-center gap-2.5 rounded-lg px-1.5 py-2 transition-colors hover:bg-surface-2">
        <StatusDot thought={thought} onStatus={onStatus} />
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            className={`min-w-0 flex-1 truncate text-[0.88rem] leading-snug text-ink ${
              done ? "line-through opacity-50" : ""
            }`}
          >
            {thought.title}
          </span>
          {thought.needs_review && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber"
              title="Needs a look"
            />
          )}
          <DateStamp thought={thought} />
          {/* The one affordance for both directions — same spot open or closed. */}
          <Caret
            open={expanded}
            className={`text-ink-faint group-hover:opacity-100 group-focus-within:opacity-100 ${
              expanded ? "opacity-100" : "opacity-0"
            }`}
          />
        </button>
      </div>

      {expanded && (
        <ThoughtDetail
          id={panelId}
          thought={thought}
          tags={tags}
          onStatus={onStatus}
        />
      )}
    </li>
  );
}

export function ThoughtDetail({
  id,
  thought,
  tags,
  onStatus,
}: {
  id: string;
  thought: ThoughtRecord;
  tags: TagRecord[];
} & RowActions) {
  const rowTags = (thought.tags ?? [])
    .map((tagId) => tags.find((t) => t.id === tagId))
    .filter((t): t is TagRecord => Boolean(t));

  return (
    <div
      id={id}
      className="relative flex flex-col gap-2.5 pb-3.5 pl-[2.1rem] pr-1.5 motion-safe:animate-[flux-unfold_180ms_ease-out]"
    >
      <span
        aria-hidden="true"
        className="absolute bottom-1 left-[0.95rem] top-0 w-[2px] rounded-full opacity-45"
        style={{ background: "var(--line-strong)" }}
      />

      {thought.body && thought.body !== thought.title && (
        <p className="font-hand text-[0.95rem] leading-[1.55] text-ink">
          {thought.body}
        </p>
      )}

      <dl className="flex flex-col gap-1">
        {thought.action_date && (
          <Detail
            label="do"
            value={formatDate(thought.action_date, thought.date_precision)}
          />
        )}
        {thought.deadline && (
          <Detail
            label="due"
            value={formatDate(thought.deadline, thought.date_precision)}
          />
        )}
        {thought.reminder_at && (
          <Detail label="remind" value={formatDate(thought.reminder_at, "exact")} />
        )}
        {thought.date_source_text && (
          <Detail label="you wrote" value={`“${thought.date_source_text}”`} />
        )}
        {(thought.people?.length ?? 0) > 0 && (
          <Detail
            label="people"
            value={thought.people!.map((p) => p.name).join(", ")}
          />
        )}
        {rowTags.length > 0 && (
          <div className="flex items-baseline gap-2">
            <dt className="w-[4.5rem] shrink-0 font-data text-[0.62rem] uppercase tracking-[0.1em] text-ink-soft">
              tags
            </dt>
            <dd className="flex flex-wrap gap-1">
              {rowTags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full px-2 py-0.5 text-[0.7rem]"
                  style={{
                    background: `var(--${tag.color || "iris"}-soft)`,
                    color: `var(--${tag.color || "iris"})`,
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/thoughts/${thought.id}`}
          className="font-data text-[0.66rem] uppercase tracking-[0.1em] text-ink-soft transition-colors hover:text-ink"
        >
          Open →
        </Link>
        {thought.status === "archived" ? (
          <button
            type="button"
            onClick={() => onStatus(thought.id, "open")}
            className="font-data text-[0.66rem] uppercase tracking-[0.1em] text-ink-faint transition-colors hover:text-ink"
          >
            Unarchive
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onStatus(thought.id, "archived")}
            className="font-data text-[0.66rem] uppercase tracking-[0.1em] text-ink-faint transition-colors hover:text-sage"
          >
            Archive
          </button>
        )}
        {thought.needs_review && (
          <span className="font-data text-[0.66rem] text-amber">needs a look</span>
        )}
      </div>
    </div>
  );
}

/** The card the tag view and a calendar day share. Same information as a row,
 *  stacked instead of ruled. */
export function ThoughtCard({
  thought,
  tags,
  onStatus,
}: {
  thought: ThoughtRecord;
  tags: TagRecord[];
} & RowActions) {
  const done = thought.status === "done";
  const rowTags = (thought.tags ?? [])
    .map((tagId) => tags.find((t) => t.id === tagId))
    .filter((t): t is TagRecord => Boolean(t));

  return (
    <li className="rounded-xl border border-line bg-surface p-2.5 transition-colors hover:border-line-strong">
      <div className="flex items-start gap-2">
        <span className="pt-0.5">
          <StatusDot thought={thought} onStatus={onStatus} />
        </span>
        <Link
          href={`/thoughts/${thought.id}`}
          className={`min-w-0 flex-1 text-[0.82rem] leading-snug text-ink hover:text-iris ${
            done ? "line-through opacity-50" : ""
          }`}
        >
          {thought.title}
        </Link>
        {thought.needs_review && (
          <span
            className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber"
            title="Needs a look"
          />
        )}
      </div>

      {(rowTags.length > 0 || dueValue(thought)) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-[1.75rem]">
          <DateStamp thought={thought} />
          {rowTags.slice(0, 2).map((tag) => (
            <span
              key={tag.id}
              className="rounded-full px-1.5 py-0.5 text-[0.64rem]"
              style={{
                background: `var(--${tag.color || "iris"}-soft)`,
                color: `var(--${tag.color || "iris"})`,
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-[4.5rem] shrink-0 font-data text-[0.62rem] uppercase tracking-[0.1em] text-ink-soft">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-[0.8rem] text-ink" suppressHydrationWarning>
        {value}
      </dd>
    </div>
  );
}

function formatDate(value: string, precision?: string): string {
  const date = toDate(value);
  const vague = precision === "week" || precision === "month" || precision === "vague";
  const day = date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  if (vague) {
    return `${day} · ${precision === "week" ? "sometime that week" : precision === "month" ? "sometime that month" : "no fixed time"}`;
  }
  return `${day}, ${date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
