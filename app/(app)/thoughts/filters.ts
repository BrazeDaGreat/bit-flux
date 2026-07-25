import { toDate } from "@/lib/time";
import type { ThoughtRecord } from "@/lib/types";

/**
 * Filtering happens here, in the browser, over thoughts already on the page.
 * The old screen asked the server on every change, which made narrowing a list
 * feel like loading a new one. Nothing here touches the network, so a filter
 * lands in the same frame as the click.
 */

export type ViewMode = "tags" | "list" | "timeline" | "calendar";

/** Done and archived are different states of finished: done is a result you
 *  want to see, archived is something you chose to stop seeing. They never
 *  share a list. */
export type Bucket = "open" | "done" | "archived";

/** The fourth tab is not a status but a job: the thoughts the AI wasn't sure
 *  about, waiting on a decision. It sits apart from the three piles for that
 *  reason. */
export type Pane = Bucket | "review";

export type WhenKey = "overdue" | "today" | "week" | "none";

export interface Filters {
  query: string;
  tags: string[];
  people: string[];
  when: WhenKey | null;
  /** Only the ones the AI wasn't sure about. */
  flagged: boolean;
}

export const EMPTY_FILTERS: Filters = {
  query: "",
  tags: [],
  people: [],
  when: null,
  flagged: false,
};

export function activeCount(filters: Filters): number {
  return (
    filters.tags.length +
    filters.people.length +
    (filters.when ? 1 : 0) +
    (filters.flagged ? 1 : 0)
  );
}

export const DAY = 86400000;

export function startOfToday(now = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/** The date a thought is actually judged by: when it's due, else when it's to
 *  be done, else when it asked to be brought back. */
export function dueTime(thought: ThoughtRecord): number | null {
  const value = thought.deadline || thought.action_date || thought.reminder_at;
  return value ? toDate(value).getTime() : null;
}

export function dueValue(thought: ThoughtRecord): string {
  return thought.deadline || thought.action_date || thought.reminder_at || "";
}

export function whenOf(thought: ThoughtRecord, now = new Date()): WhenKey | "later" {
  const at = dueTime(thought);
  if (at === null) return "none";
  const dayStart = startOfToday(now);
  if (at < dayStart) return "overdue";
  if (at < dayStart + DAY) return "today";
  if (at < dayStart + 7 * DAY) return "week";
  return "later";
}

export function matchesWhen(thought: ThoughtRecord, when: WhenKey): boolean {
  const key = whenOf(thought);
  return when === "week" ? key === "today" || key === "week" : key === when;
}

export function applyFilters(
  thoughts: ThoughtRecord[],
  bucket: Bucket,
  filters: Filters
): ThoughtRecord[] {
  const needle = filters.query.trim().toLowerCase();

  return thoughts.filter((thought) => {
    if (thought.status !== bucket) return false;
    if (filters.flagged && !thought.needs_review) return false;
    if (filters.when && !matchesWhen(thought, filters.when)) return false;

    if (filters.tags.length > 0) {
      const on = thought.tags ?? [];
      if (!filters.tags.every((id) => on.includes(id))) return false;
    }

    if (filters.people.length > 0) {
      const names = (thought.people ?? []).map((p) => p.name);
      if (!filters.people.some((name) => names.includes(name))) return false;
    }

    if (needle) {
      const haystack = `${thought.title} ${thought.body}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    return true;
  });
}

/** Newest first, except when a date is what the view is about. */
export function byDate(a: ThoughtRecord, b: ThoughtRecord): number {
  return (dueTime(a) ?? Infinity) - (dueTime(b) ?? Infinity);
}
