import type PocketBase from "pocketbase";

import type { CollectionRecord, TagRecord, ThoughtRecord } from "./types";
import { toDate } from "./time";

export interface DashboardData {
  overdue: ThoughtRecord[];
  today: ThoughtRecord[];
  upcoming: ThoughtRecord[];
  resurfacing: ThoughtRecord[];
  needsReview: number;
  activeTags: TagRecord[];
  activeProjects: CollectionRecord[];
  /** Thoughts mentioned a while ago, still open, still untouched. */
  stale: ThoughtRecord[];
}

const DAY = 86400000;

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/**
 * One pass over the open thoughts, sliced several ways. Cheaper and more
 * consistent than a query per card, and small enough to do in memory.
 */
export async function loadDashboard(client: PocketBase): Promise<DashboardData> {
  const [open, tags, projects] = await Promise.all([
    client
      .collection("flux_thoughts")
      .getFullList<ThoughtRecord>({ filter: 'status = "open"', sort: "-created" })
      .catch(() => []),
    client
      .collection("flux_tags")
      .getFullList<TagRecord>({
        filter: "approved = true && usage_count > 0",
        sort: "-usage_count",
      })
      .catch(() => []),
    client
      .collection("flux_collections")
      .getFullList<CollectionRecord>({
        filter: 'kind = "project" && archived != true',
        sort: "-created",
      })
      .catch(() => []),
  ]);

  const dayStart = startOfToday();
  const weekEnd = dayStart + 7 * DAY;
  const staleCutoff = Date.now() - 14 * DAY;

  const dated = (thought: ThoughtRecord) => {
    const value = thought.deadline || thought.action_date;
    return value ? toDate(value).getTime() : null;
  };

  const overdue: ThoughtRecord[] = [];
  const today: ThoughtRecord[] = [];
  const upcoming: ThoughtRecord[] = [];
  const resurfacing: ThoughtRecord[] = [];

  for (const thought of open) {
    const when = dated(thought);
    if (when !== null) {
      if (when < dayStart) overdue.push(thought);
      else if (when < dayStart + DAY) today.push(thought);
      else if (when < weekEnd) upcoming.push(thought);
    }
    if (thought.resurface_at && toDate(thought.resurface_at).getTime() <= Date.now()) {
      resurfacing.push(thought);
    }
  }

  const byDate = (a: ThoughtRecord, b: ThoughtRecord) =>
    (dated(a) ?? 0) - (dated(b) ?? 0);

  return {
    overdue: overdue.sort(byDate),
    today: today.sort(byDate),
    upcoming: upcoming.sort(byDate),
    resurfacing,
    needsReview: open.filter((t) => t.needs_review).length,
    activeTags: tags.slice(0, 12),
    activeProjects: projects.slice(0, 8),
    stale: open
      .filter(
        (t) =>
          toDate(t.created).getTime() < staleCutoff &&
          !t.edited_at &&
          !t.action_date
      )
      .slice(0, 4),
  };
}
