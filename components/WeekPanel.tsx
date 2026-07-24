import Link from "next/link";

import type { DashboardData } from "@/lib/dashboard";
import type { ThoughtRecord } from "@/lib/types";
import { toDate } from "@/lib/time";

/**
 * The only thing allowed to share the capture screen. Deliberately small and
 * in the corner: capture is the job here, this is peripheral vision.
 */
export default function WeekPanel({ data }: { data: DashboardData }) {
  const items = [...data.overdue, ...data.today, ...data.upcoming].slice(0, 5);
  const late = data.overdue.length;

  if (items.length === 0 && data.needsReview === 0) return null;

  return (
    <aside className="w-full rounded-2xl border border-line bg-surface-2 p-3.5 sm:w-60">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-data text-[0.64rem] uppercase tracking-[0.14em] text-ink-faint">
          this week
        </h2>
        {late > 0 && (
          <span className="font-data text-[0.64rem] text-blush">{late} late</span>
        )}
      </div>

      {items.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-2">
          {items.map((thought) => (
            <li key={thought.id}>
              <Link
                href={`/thoughts/${thought.id}`}
                className="group flex items-baseline gap-2"
              >
                <span
                  aria-hidden="true"
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: `var(--${tone(thought, data)})` }}
                />
                <span className="min-w-0 flex-1 text-[0.78rem] leading-snug text-ink-soft transition-colors group-hover:text-ink">
                  {thought.title}
                </span>
                <span
                  className="shrink-0 font-data text-[0.62rem] text-ink-faint"
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
          href="/review"
          className="mt-3 flex items-center gap-1.5 border-t border-line pt-2.5 font-data text-[0.66rem] text-amber hover:underline"
        >
          {data.needsReview} to check →
        </Link>
      )}
    </aside>
  );
}

function tone(thought: ThoughtRecord, data: DashboardData): string {
  if (data.overdue.some((t) => t.id === thought.id)) return "blush";
  if (data.today.some((t) => t.id === thought.id)) return "apricot";
  return "sky";
}

function when(thought: ThoughtRecord): string {
  const value = thought.deadline || thought.action_date;
  if (!value) return "";
  const vague =
    thought.date_precision === "week" ||
    thought.date_precision === "month" ||
    thought.date_precision === "vague";
  if (vague) return thought.date_precision === "week" ? "this wk" : "later";
  return toDate(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}
