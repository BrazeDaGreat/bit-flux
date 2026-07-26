"use client";

import Link from "next/link";

import { Caret } from "@/components/Chips";
import MentionText from "@/components/MentionText";
import { toDate } from "@/lib/time";
import type { TagRecord, ThoughtRecord } from "@/lib/types";
import { dueValue, whenOf } from "./filters";
import { useThoughtContextMenu } from "./ThoughtContextMenu";

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
  onToggleTag: (id: string, tagId: string) => void;
  onDelete: (id: string) => void;
}

const TONE: Record<string, string> = {
  overdue: "blush",
  today: "iris",
  week: "sky",
  later: "ink-faint",
  none: "ink-faint",
};

/**
 * Hovering shows the answer rather than announcing it: an open thought fills
 * in a ghost of the tick it is about to get, a done one lets its tick fade
 * towards gone. Nothing grows, moves, or appears beside it — the circle is
 * already where the eye is, so the whole hint fits inside it.
 */
export function StatusDot({
  thought,
  onStatus,
}: {
  thought: ThoughtRecord;
} & Pick<RowActions, "onStatus">) {
  const done = thought.status === "done";
  const archived = thought.status === "archived";

  return (
    // The circle stays 20px at every size — the whole list's rhythm is built
    // on it. What grows below the desktop breakpoint is the button around it,
    // which is invisible and is the part a thumb actually needs.
    <button
      type="button"
      onClick={() => onStatus(thought.id, done || archived ? "open" : "done")}
      aria-pressed={done}
      aria-label={done ? `Reopen ${thought.title}` : `Mark ${thought.title} done`}
      title={done ? "Reopen" : archived ? "Bring back" : "Mark done"}
      className="group/dot grid h-5 w-5 shrink-0 place-items-center rounded-full max-lg:h-11 max-lg:w-11"
    >
      <span
        className={`grid h-5 w-5 place-items-center rounded-full border transition-colors ${
          done
            ? "border-mint bg-mint-soft group-hover/dot:bg-transparent"
            : archived
              ? "border-line-strong group-hover/dot:border-sage"
              : "border-line-strong group-hover/dot:border-mint"
        }`}
      >
        {archived ? (
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-sage transition-opacity group-hover/dot:opacity-45"
          />
        ) : (
          <Tick
            className={`text-mint transition-opacity ${
              done ? "group-hover/dot:opacity-40" : "opacity-0 group-hover/dot:opacity-45"
            }`}
          />
        )}
      </span>
    </button>
  );
}

function Tick({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={`h-3 w-3 ${className}`} aria-hidden="true">
      <path
        d="M2.5 6.2 4.8 8.5 9.5 3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DateStamp({
  thought,
  className = "",
}: {
  thought: ThoughtRecord;
  className?: string;
}) {
  const value = dueValue(thought);
  if (!value) return null;
  const tone = TONE[whenOf(thought)] ?? "ink-faint";
  return (
    <span
      className={`shrink-0 font-data text-[0.62rem] max-lg:text-[0.75rem] ${className}`}
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
  onToggleTag,
  onDelete,
}: {
  thought: ThoughtRecord;
  tags: TagRecord[];
  expanded: boolean;
  onToggle: () => void;
} & RowActions) {
  const done = thought.status === "done";
  const panelId = `thought-${thought.id}-detail`;
  const { contextMenuProps, contextMenu } = useThoughtContextMenu({
    thought,
    tags,
    onStatus,
    onToggleTag,
    onDelete,
  });

  return (
    <li
      className="border-b border-line/60 last:border-b-0"
      {...contextMenuProps}
    >
      <div className="group flex items-center gap-2.5 rounded-lg px-1.5 py-2 transition-colors hover:bg-surface-2 max-lg:min-h-[3.5rem] max-lg:py-1.5">
        <StatusDot thought={thought} onStatus={onStatus} />
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {/* Below the desktop breakpoint the stamp and the review dot drop to
              their own line, so the title gets the full width instead of
              competing with two things at the end of it. The row is the same
              height either way. */}
          <span className="min-w-0 flex-1">
            <span
              className={`block truncate text-[0.88rem] leading-snug text-ink max-lg:text-[0.95rem] ${
                done ? "line-through opacity-50" : ""
              }`}
            >
              {thought.title}
            </span>
            <MetaLine thought={thought} />
          </span>
          {thought.needs_review && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber max-lg:hidden"
              title="Needs a look"
            />
          )}
          <DateStamp thought={thought} className="max-lg:hidden" />
          {/* The one affordance for both directions — same spot open or closed. */}
          <Caret
            open={expanded}
            className={`text-ink-faint group-hover:opacity-100 group-focus-within:opacity-100 max-lg:h-3.5 max-lg:w-3.5 ${
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
      {contextMenu}
    </li>
  );
}

/** The second line of a row, below the desktop breakpoint only: what the
 *  desktop puts at the end of the title, where a 360px screen has no room for
 *  it. Renders nothing when there is nothing to say. */
function MetaLine({ thought }: { thought: ThoughtRecord }) {
  if (!dueValue(thought) && !thought.needs_review) return null;
  return (
    <span className="mt-0.5 hidden items-center gap-2 max-lg:flex">
      <DateStamp thought={thought} />
      {thought.needs_review && (
        <span className="flex items-center gap-1.5 font-data text-[0.75rem] text-amber">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber" />
          needs a look
        </span>
      )}
    </span>
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
} & Pick<RowActions, "onStatus">) {
  const rowTags = (thought.tags ?? [])
    .map((tagId) => tags.find((t) => t.id === tagId))
    .filter((t): t is TagRecord => Boolean(t));

  return (
    <div
      id={id}
      className="relative flex flex-col gap-2.5 pb-3.5 pl-[2.1rem] pr-1.5 motion-safe:animate-[flux-unfold_180ms_ease-out] max-lg:pl-[3.4rem]"
    >
      <span
        aria-hidden="true"
        className="absolute bottom-1 left-[0.95rem] top-0 w-[2px] rounded-full opacity-45 max-lg:left-[1.35rem]"
        style={{ background: "var(--line-strong)" }}
      />

      {thought.body && thought.body !== thought.title && (
        <p className="whitespace-pre-wrap font-hand text-[0.95rem] leading-[1.55] text-ink">
          <MentionText text={thought.body} />
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
          <div className="flex items-baseline gap-2 max-lg:flex-col max-lg:items-start max-lg:gap-1">
            <dt className="w-[4.5rem] shrink-0 font-data text-[0.62rem] uppercase tracking-[0.1em] text-ink-soft max-lg:w-auto max-lg:text-[0.75rem]">
              tags
            </dt>
            <dd className="flex flex-wrap gap-1">
              {rowTags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full px-2 py-0.5 text-[0.7rem] max-lg:text-[0.8rem]"
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

      <div className="flex flex-wrap items-center gap-3 max-lg:gap-2">
        <Link
          href={`/thoughts/${thought.id}`}
          className="font-data text-[0.66rem] uppercase tracking-[0.1em] text-ink-soft transition-colors hover:text-ink max-lg:inline-flex max-lg:h-11 max-lg:items-center max-lg:rounded-full max-lg:border max-lg:border-line-strong max-lg:px-4 max-lg:text-[0.75rem]"
        >
          Open →
        </Link>
        {thought.status === "archived" ? (
          <button
            type="button"
            onClick={() => onStatus(thought.id, "open")}
            className="font-data text-[0.66rem] uppercase tracking-[0.1em] text-ink-faint transition-colors hover:text-ink max-lg:h-11 max-lg:rounded-full max-lg:px-4 max-lg:text-[0.75rem]"
          >
            Unarchive
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onStatus(thought.id, "archived")}
            className="font-data text-[0.66rem] uppercase tracking-[0.1em] text-ink-faint transition-colors hover:text-sage max-lg:h-11 max-lg:rounded-full max-lg:px-4 max-lg:text-[0.75rem]"
          >
            Archive
          </button>
        )}
        {/* Already said on the row's own second line below `lg`. */}
        {thought.needs_review && (
          <span className="font-data text-[0.66rem] text-amber max-lg:hidden">
            needs a look
          </span>
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
  onToggleTag,
  onDelete,
}: {
  thought: ThoughtRecord;
  tags: TagRecord[];
} & RowActions) {
  const done = thought.status === "done";
  const rowTags = (thought.tags ?? [])
    .map((tagId) => tags.find((t) => t.id === tagId))
    .filter((t): t is TagRecord => Boolean(t));
  const { contextMenuProps, contextMenu } = useThoughtContextMenu({
    thought,
    tags,
    onStatus,
    onToggleTag,
    onDelete,
  });

  return (
    <li
      className="rounded-xl border border-line bg-surface p-2.5 transition-colors hover:border-line-strong"
      {...contextMenuProps}
    >
      <div className="flex items-start gap-2">
        <span className="pt-0.5">
          <StatusDot thought={thought} onStatus={onStatus} />
        </span>
        <Link
          href={`/thoughts/${thought.id}`}
          className={`min-w-0 flex-1 text-[0.82rem] leading-snug text-ink hover:text-iris max-lg:flex max-lg:min-h-[2.75rem] max-lg:items-center max-lg:text-[0.95rem] ${
            done ? "line-through opacity-50" : ""
          }`}
        >
          {thought.title}
        </Link>
        {thought.needs_review && (
          <span
            className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber max-lg:mt-4"
            title="Needs a look"
          />
        )}
      </div>

      {(rowTags.length > 0 || dueValue(thought)) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-[1.75rem] max-lg:pl-[3.4rem]">
          <DateStamp thought={thought} />
          {rowTags.slice(0, 2).map((tag) => (
            <span
              key={tag.id}
              className="rounded-full px-1.5 py-0.5 text-[0.64rem] max-lg:text-[0.75rem]"
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
      {contextMenu}
    </li>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    // A 4.5rem label column beside a value is a fifth of a phone spent on the
    // word "remind". Below `lg` the label sits above its value instead.
    <div className="flex items-baseline gap-2 max-lg:flex-col max-lg:gap-0">
      <dt className="w-[4.5rem] shrink-0 font-data text-[0.62rem] uppercase tracking-[0.1em] text-ink-soft max-lg:w-auto max-lg:text-[0.75rem]">
        {label}
      </dt>
      <dd
        className="min-w-0 flex-1 text-[0.8rem] text-ink max-lg:w-full max-lg:text-[0.95rem]"
        suppressHydrationWarning
      >
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
