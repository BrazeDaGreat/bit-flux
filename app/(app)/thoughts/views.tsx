"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

import { dayKey, dayLabel, toDate } from "@/lib/time";
import type { TagRecord, ThoughtRecord } from "@/lib/types";
import { byDate, dueValue } from "./filters";
import { ThoughtCard, ThoughtRow, type RowActions } from "./ThoughtRow";

/**
 * Four ways to look at the same set. Each answers a different question, so each
 * is shaped differently and none is a rearrangement of another: Tags asks
 * "what is this about", List asks "what have I been writing", Timeline asks
 * "what is coming and how far off", Calendar asks "what does the month look
 * like".
 */

interface ViewProps extends RowActions {
  thoughts: ThoughtRecord[];
  tags: TagRecord[];
}

export function GroupHeader({
  label,
  note,
  tone,
}: {
  label: string;
  note?: string;
  tone?: string;
}) {
  return (
    <div className="mb-1 flex items-baseline gap-2 px-1.5">
      {tone && (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: `var(--${tone})` }}
        />
      )}
      <h2
        className="font-data text-[0.64rem] uppercase tracking-[0.14em] text-ink-faint max-lg:text-[0.75rem]"
        suppressHydrationWarning
      >
        {label}
      </h2>
      {note && (
        <span className="font-data text-[0.62rem] text-ink-faint opacity-70 max-lg:text-[0.75rem]">
          {note}
        </span>
      )}
    </div>
  );
}

export function ListView({ thoughts, tags, ...actions }: ViewProps) {
  const [open, setOpen] = useState<string | null>(null);

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: ThoughtRecord[] }[] = [];
    for (const thought of thoughts) {
      const key = dayKey(thought.created);
      const last = out.at(-1);
      if (last?.key === key) last.items.push(thought);
      else out.push({ key, label: dayLabel(thought.created), items: [thought] });
    }
    return out;
  }, [thoughts]);

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <section key={group.key}>
          <GroupHeader label={group.label} note={String(group.items.length)} />
          <ul>
            {group.items.map((thought) => (
              <ThoughtRow
                key={thought.id}
                thought={thought}
                tags={tags}
                expanded={open === thought.id}
                onToggle={() => setOpen(open === thought.id ? null : thought.id)}
                {...actions}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const DAY_MS = 86400000;

/** "in 3 days" / "5 days ago" — the distance, which is the thing a date is
 *  actually being read for here. */
function distance(target: Date, now = new Date()): string {
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(target) - startOf(now)) / DAY_MS);

  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0) {
    if (days < 7) return `in ${days} days`;
    if (days < 14) return "next week";
    if (days < 60) return `in ${Math.round(days / 7)} weeks`;
    return `in ${Math.round(days / 30)} months`;
  }
  const late = Math.abs(days);
  if (late < 7) return `${late} days late`;
  if (late < 60) return `${Math.round(late / 7)} weeks late`;
  return `${Math.round(late / 30)} months late`;
}

/**
 * Time as one continuous line, read top to bottom.
 *
 * The calendar answers "what does July look like"; this answers "what is
 * coming, in the order it arrives" — no month boundaries, no empty squares,
 * and no arithmetic to work out how far away something is, because the
 * distance is written next to it. Late things sit above today's line, which is
 * marked, so the amount of overdue is a length rather than a number.
 */
export function TimelineView({ thoughts, tags, ...actions }: ViewProps) {
  const { nodes, undated } = useMemo(() => {
    const byDay = new Map<string, { date: Date; items: ThoughtRecord[] }>();
    const undated: ThoughtRecord[] = [];

    for (const thought of thoughts) {
      const value = dueValue(thought);
      if (!value) {
        undated.push(thought);
        continue;
      }
      const key = dayKey(value);
      const node = byDay.get(key);
      if (node) node.items.push(thought);
      else byDay.set(key, { date: toDate(value), items: [thought] });
    }

    const nodes = [...byDay.entries()]
      .map(([key, node]) => ({ key, ...node, items: node.items.sort(byDate) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return { nodes, undated };
  }, [thoughts]);

  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();

  // Where today falls in the sequence — the line gets a marker there even when
  // nothing is due.
  const firstAhead = nodes.findIndex((node) => node.date.getTime() >= todayStart);
  const todayIndex = firstAhead === -1 ? nodes.length : firstAhead;
  const hasToday = nodes.some(
    (node) => dayKey(node.date.toISOString()) === dayKey(now.toISOString())
  );

  if (nodes.length === 0 && undated.length === 0) {
    return (
      <p className="px-1.5 py-6 text-center text-[0.82rem] text-ink-soft">
        Nothing with a date on it.
      </p>
    );
  }

  return (
    <div className="relative pl-[1.35rem]">
      {/* The line itself. It runs the height of the sequence and everything
          hangs off it. */}
      <span
        aria-hidden="true"
        className="absolute bottom-2 left-[0.3rem] top-2 w-px"
        style={{ background: "var(--line-strong)" }}
      />

      <div className="flex flex-col">
        {nodes.map((node, index) => {
          const late = node.date.getTime() < todayStart;
          const tone = late
            ? "blush"
            : node.date.getTime() < todayStart + DAY_MS
              ? "iris"
              : "sky";

          return (
            <Fragment key={node.key}>
              {/* Where now sits, when nothing happens to be due today. Its own
                  row, so the node below keeps its dot beside its heading. */}
              {!hasToday && index === todayIndex && <TodayMark />}

              <div className="relative pb-5">
                <span
                  aria-hidden="true"
                  className="absolute -left-[1.35rem] top-[0.3rem] h-2 w-2 rounded-full"
                  style={{
                    background: `var(--${tone})`,
                    boxShadow: "0 0 0 3px var(--surface)",
                    marginLeft: "0.05rem",
                  }}
                />

                <div className="flex items-baseline gap-2">
                  <h2
                    className="font-data text-[0.66rem] uppercase tracking-[0.12em] text-ink max-lg:text-[0.75rem]"
                    suppressHydrationWarning
                  >
                    {dayLabel(node.date.toISOString())}
                  </h2>
                  <span
                    className="font-data text-[0.62rem] max-lg:text-[0.75rem]"
                    style={{ color: `var(--${tone})` }}
                    suppressHydrationWarning
                  >
                    {distance(node.date, now)}
                  </span>
                  <span className="font-data text-[0.62rem] text-ink-faint opacity-70 max-lg:text-[0.75rem]">
                    {node.items.length}
                  </span>
                </div>

                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {node.items.map((thought) => (
                    <ThoughtCard
                      key={thought.id}
                      thought={thought}
                      tags={tags}
                      {...actions}
                    />
                  ))}
                </ul>
              </div>
            </Fragment>
          );
        })}

        {/* Everything on the line is already past: now goes at the end. */}
        {!hasToday && todayIndex === nodes.length && nodes.length > 0 && (
          <TodayMark />
        )}

        {/* Undated thoughts have no place on a line, so they sit past the end
            of it rather than being given a date they never had. */}
        {undated.length > 0 && (
          <div className="relative">
            <span
              aria-hidden="true"
              className="absolute -left-[1.3rem] top-[0.3rem] h-2 w-2 rounded-full border"
              style={{
                borderColor: "var(--line-strong)",
                background: "var(--surface)",
              }}
            />
            <div className="flex items-baseline gap-2">
              <h2 className="font-data text-[0.66rem] uppercase tracking-[0.12em] text-ink-faint">
                No date
              </h2>
              <span className="font-data text-[0.62rem] text-ink-faint opacity-70">
                {undated.length}
              </span>
            </div>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {undated.map((thought) => (
                <ThoughtCard
                  key={thought.id}
                  thought={thought}
                  tags={tags}
                  {...actions}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/** Where now is on the line. Drawn as a rule rather than a row, because it is
 *  a position in time and not a thing to do. */
function TodayMark() {
  return (
    <div className="relative mb-4 flex items-center gap-2">
      <span
        aria-hidden="true"
        className="absolute -left-[1.35rem] h-2 w-2 rounded-full"
        style={{
          background: "var(--iris)",
          boxShadow: "0 0 0 3px var(--surface)",
          marginLeft: "0.05rem",
        }}
      />
      <span className="font-data text-[0.62rem] uppercase tracking-[0.14em] text-iris">
        now
      </span>
      <span
        aria-hidden="true"
        className="h-px flex-1"
        style={{ background: "var(--iris)", opacity: 0.35 }}
      />
    </div>
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** A dot in the month strip carries the one thing a dot can: whether that day
 *  is behind you, on you, or ahead. Same three inks the timeline uses. */
function dotTone(thought: ThoughtRecord, date: Date): string {
  if (thought.status === "done") return "ink-faint";
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const day = startOf(date);
  const today = startOf(new Date());
  if (day < today) return "blush";
  if (day === today) return "iris";
  return "sky";
}

/** A month at a time, because dated thoughts are the ones with a shape in
 *  time. Anything without a date is counted, not scattered. */
export function CalendarView({ thoughts, tags, ...actions }: ViewProps) {
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState<{ key: string; date: Date } | null>(null);

  const now = new Date();
  const month = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  const { cells, undated, byDay } = useMemo(() => {
    const byDay = new Map<string, ThoughtRecord[]>();
    let undated = 0;
    for (const thought of thoughts) {
      const value = dueValue(thought);
      if (!value) {
        undated += 1;
        continue;
      }
      const key = dayKey(value);
      const list = byDay.get(key);
      if (list) list.push(thought);
      else byDay.set(key, [thought]);
    }

    // Weeks start on Monday: getDay() is Sunday-first, so Sunday folds to 6.
    const first = new Date(year, monthIndex, 1);
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(year, monthIndex + 1, 0).getDate();

    const cells: (Date | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let day = 1; day <= days; day++) {
      cells.push(new Date(year, monthIndex, day));
    }
    return { cells, undated, byDay };
  }, [thoughts, year, monthIndex]);

  const todayKey = dayKey(new Date().toISOString());
  const pickedItems = picked ? (byDay.get(picked.key) ?? []) : [];

  /** The month as a list rather than a grid: every day that has something,
   *  in order. This is the readable half of the compact calendar. */
  const agenda = useMemo(() => {
    const out: { key: string; date: Date; items: ThoughtRecord[] }[] = [];
    for (const date of cells) {
      if (!date) continue;
      const key = dayKey(date.toISOString());
      const items = byDay.get(key);
      if (items && items.length > 0) out.push({ key, date, items });
    }
    return out;
  }, [cells, byDay]);

  /** Tapping a day moves the agenda to it. The month strip is a map, not a
   *  container — nothing opens inside it. */
  function jumpTo(key: string) {
    document
      .getElementById(`agenda-${key}`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1.5">
        <h2
          className="font-data text-[0.68rem] uppercase tracking-[0.14em] text-ink max-lg:text-[0.8rem]"
          suppressHydrationWarning
        >
          {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h2>
        <div className="ml-auto flex items-center gap-1">
          <StepButton label="Previous month" onClick={() => setOffset(offset - 1)}>
            ←
          </StepButton>
          {offset !== 0 && (
            <button
              type="button"
              onClick={() => setOffset(0)}
              className="rounded-full px-2 py-1 font-data text-[0.66rem] text-ink-soft hover:text-ink max-lg:h-11 max-lg:px-3 max-lg:text-[0.8rem]"
            >
              today
            </button>
          )}
          <StepButton label="Next month" onClick={() => setOffset(offset + 1)}>
            →
          </StepButton>
        </div>
      </div>

      {/*
        Two calendars, one month.

        A seven-column grid of cells that can hold a title needs about 90px a
        column. A phone has 51. So below the desktop breakpoint the grid keeps
        only the thing a calendar is uniquely for — the shape of the month, how
        the busy days cluster — as a strip of days marked with dots, and the
        titles move into an agenda underneath where there is a full line for
        each of them.
      */}
      <div className="hidden grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="bg-surface-2 px-1.5 py-1 text-center font-data text-[0.6rem] uppercase tracking-[0.1em] text-ink-faint"
          >
            {day.slice(0, 1)}
          </div>
        ))}

        {cells.map((date, index) => {
          if (!date) {
            return <div key={`pad-${index}`} className="min-h-[4.5rem] bg-surface-2/40" />;
          }
          const key = dayKey(date.toISOString());
          const items = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          const isPicked = key === picked?.key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setPicked(isPicked ? null : { key, date })}
              aria-pressed={isPicked}
              className={`min-h-[4.5rem] p-1 text-left align-top transition-colors ${
                isPicked ? "bg-iris-soft" : "bg-surface hover:bg-surface-2"
              }`}
            >
              <span
                className={`font-data text-[0.62rem] ${
                  isToday ? "text-iris" : "text-ink-faint"
                }`}
              >
                {date.getDate()}
              </span>
              <span className="mt-0.5 flex flex-col gap-0.5">
                {items.slice(0, 2).map((thought) => (
                  <span
                    key={thought.id}
                    className={`truncate rounded px-1 py-0.5 text-[0.64rem] leading-tight ${
                      thought.status === "done"
                        ? "text-ink-faint line-through"
                        : "text-ink"
                    }`}
                    style={{ background: "var(--surface-3)" }}
                  >
                    {thought.title}
                  </span>
                ))}
                {items.length > 2 && (
                  <span className="px-1 font-data text-[0.6rem] text-ink-faint">
                    +{items.length - 2}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* The strip: the month's shape, and nothing it cannot hold. */}
      <div className="overflow-hidden rounded-xl border border-line lg:hidden">
        <div className="grid grid-cols-7 border-b border-line bg-surface-2">
          {WEEKDAYS.map((day) => (
            <span
              key={day}
              className="py-1 text-center font-data text-[0.7rem] uppercase tracking-[0.1em] text-ink-faint"
            >
              {day.slice(0, 1)}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, index) => {
            if (!date) return <span key={`strip-pad-${index}`} className="h-11" />;
            const key = dayKey(date.toISOString());
            const items = byDay.get(key) ?? [];
            const isToday = key === todayKey;
            const isPicked = key === picked?.key;

            return (
              <button
                key={key}
                type="button"
                disabled={items.length === 0}
                onClick={() => {
                  setPicked({ key, date });
                  jumpTo(key);
                }}
                aria-pressed={isPicked}
                aria-label={`${date.getDate()} — ${items.length} thought${
                  items.length === 1 ? "" : "s"
                }`}
                className={`flex h-11 flex-col items-center justify-center gap-1 transition-colors ${
                  isPicked ? "bg-iris-soft" : ""
                }`}
              >
                <span
                  className={`font-data text-[0.8rem] leading-none ${
                    isToday
                      ? "text-iris"
                      : items.length > 0
                        ? "text-ink"
                        : "text-ink-faint"
                  }`}
                >
                  {date.getDate()}
                </span>
                <span aria-hidden="true" className="flex h-1 items-center gap-0.5">
                  {items.slice(0, 3).map((thought) => (
                    <span
                      key={thought.id}
                      className="h-1 w-1 rounded-full"
                      style={{ background: `var(--${dotTone(thought, date)})` }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* The agenda: the same month, readable. */}
      <div className="flex flex-col gap-4 lg:hidden">
        {agenda.length === 0 ? (
          <p className="px-1.5 py-4 text-center text-[0.95rem] text-ink-soft">
            Nothing dated this month.
          </p>
        ) : (
          agenda.map((group) => (
            <section key={group.key} id={`agenda-${group.key}`}>
              <GroupHeader
                label={dayLabel(group.date.toISOString())}
                note={String(group.items.length)}
              />
              <ul className="flex flex-col gap-1.5">
                {group.items.map((thought) => (
                  <ThoughtCard
                    key={thought.id}
                    thought={thought}
                    tags={tags}
                    {...actions}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      {picked && (
        <section className="motion-safe:animate-[flux-unfold_180ms_ease-out] max-lg:hidden">
          <GroupHeader
            label={dayLabel(picked.date.toISOString())}
            note={String(pickedItems.length)}
          />
          <ul className="flex flex-col gap-1.5">
            {pickedItems.map((thought) => (
              <ThoughtCard
                key={thought.id}
                thought={thought}
                tags={tags}
                {...actions}
              />
            ))}
          </ul>
        </section>
      )}

      {undated > 0 && (
        <p className="px-1.5 font-data text-[0.66rem] text-ink-faint max-lg:text-[0.75rem]">
          {undated} without a date — find them in List, or at the end of
          Timeline.
        </p>
      )}
    </div>
  );
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-full border border-line-strong px-2 py-0.5 font-data text-[0.7rem] text-ink-soft transition-colors hover:border-iris hover:text-ink max-lg:h-11 max-lg:w-11 max-lg:px-0 max-lg:text-[0.9rem]"
    >
      {children}
    </button>
  );
}

export function TagsView({ thoughts, tags, ...actions }: ViewProps) {
  const groups = useMemo(() => {
    const out = tags
      .map((tag) => ({
        tag,
        items: thoughts.filter((t) => (t.tags ?? []).includes(tag.id)),
      }))
      .filter((group) => group.items.length > 0);

    const untagged = thoughts.filter((t) => (t.tags ?? []).length === 0);
    return { out, untagged };
  }, [thoughts, tags]);

  return (
    <div className="flex flex-col gap-5">
      {groups.out.map(({ tag, items }) => (
        <section key={tag.id}>
          <div className="mb-1.5 flex items-baseline gap-2 px-1.5">
            <span
              className="rounded-full px-2 py-0.5 text-[0.72rem]"
              style={{
                background: `var(--${tag.color || "iris"}-soft)`,
                color: `var(--${tag.color || "iris"})`,
              }}
            >
              {tag.name}
            </span>
            <span className="font-data text-[0.62rem] text-ink-faint">
              {items.length}
            </span>
            <Link
              href={`/ask?tag=${tag.id}`}
              className="ml-auto font-data text-[0.64rem] text-ink-faint transition-colors hover:text-iris max-lg:inline-flex max-lg:h-11 max-lg:items-center max-lg:px-2 max-lg:text-[0.75rem]"
            >
              ask about this →
            </Link>
          </div>
          <ul className="grid gap-1.5 md:grid-cols-2">
            {items.map((thought) => (
              <ThoughtCard
                key={thought.id}
                thought={thought}
                tags={tags}
                {...actions}
              />
            ))}
          </ul>
        </section>
      ))}

      {groups.untagged.length > 0 && (
        <section>
          <GroupHeader label="No tag" note={String(groups.untagged.length)} />
          <ul className="grid gap-1.5 md:grid-cols-2">
            {groups.untagged.map((thought) => (
              <ThoughtCard
                key={thought.id}
                thought={thought}
                tags={tags}
                {...actions}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
