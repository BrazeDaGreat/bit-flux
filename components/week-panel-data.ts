import type { DashboardData } from "@/lib/dashboard";
import type { ThoughtRecord } from "@/lib/types";
import { toDate } from "@/lib/time";

/** The week's items in the order the panel reads them: late, then today, then
 *  what's coming. Both panels show the same five. */
export function weekItems(data: DashboardData): ThoughtRecord[] {
  return [...data.overdue, ...data.today, ...data.upcoming].slice(0, 5);
}

export function tone(thought: ThoughtRecord, data: DashboardData): string {
  if (data.overdue.some((t) => t.id === thought.id)) return "blush";
  if (data.today.some((t) => t.id === thought.id)) return "apricot";
  return "sky";
}

export function when(thought: ThoughtRecord): string {
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
