import { redirect } from "next/navigation";

import { currentUser, pbServer } from "@/lib/pb-server";
import { dayKey, dayLabel, toDate } from "@/lib/time";
import type { TagRecord, ThoughtRecord } from "@/lib/types";
import ThoughtsList from "./ThoughtsList";

type Params = {
  view?: string;
  tag?: string;
  person?: string;
  status?: string;
};

function buildFilter(params: Params): string {
  const parts: string[] = [];
  if (params.tag) parts.push(`tags ~ "${params.tag}"`);
  if (params.person) parts.push(`people ~ "${params.person.replace(/"/g, '\\"')}"`);
  if (params.status) parts.push(`status = "${params.status}"`);
  return parts.join(" && ");
}

/** Each view answers a different question, so each groups differently. */
function group(
  thoughts: ThoughtRecord[],
  view: string,
  tags: TagRecord[]
) {
  if (view === "tag") {
    const groups = tags
      .map((tag) => ({
        key: tag.id,
        label: tag.name,
        items: thoughts.filter((t) => (t.tags ?? []).includes(tag.id)),
      }))
      .filter((g) => g.items.length > 0);
    const untagged = thoughts.filter((t) => (t.tags ?? []).length === 0);
    if (untagged.length) groups.push({ key: "none", label: "No tag", items: untagged });
    return groups;
  }

  if (view === "scheduled") {
    const dated = thoughts
      .filter((t) => t.action_date || t.deadline || t.reminder_at)
      .sort(
        (a, b) =>
          toDate(a.action_date || a.deadline || a.reminder_at).getTime() -
          toDate(b.action_date || b.deadline || b.reminder_at).getTime()
      );
    const groups: { key: string; label: string; items: ThoughtRecord[] }[] = [];
    for (const thought of dated) {
      const value = thought.action_date || thought.deadline || thought.reminder_at;
      const key = dayKey(value);
      const last = groups.at(-1);
      if (last?.key === key) last.items.push(thought);
      else groups.push({ key, label: dayLabel(value), items: [thought] });
    }
    return groups;
  }

  const groups: { key: string; label: string; items: ThoughtRecord[] }[] = [];
  for (const thought of thoughts) {
    const key = dayKey(thought.created);
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(thought);
    else groups.push({ key, label: dayLabel(thought.created), items: [thought] });
  }
  return groups;
}

export default async function ThoughtsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const view = params.view ?? "list";
  const client = await pbServer();
  const filter = buildFilter(params);

  const [thoughtsPage, tags] = await Promise.all([
    client
      .collection("flux_thoughts")
      .getList<ThoughtRecord>(1, 200, {
        sort: "-created",
        ...(filter ? { filter } : {}),
      })
      .catch(() => ({ items: [] as ThoughtRecord[] })),
    client
      .collection("flux_tags")
      .getFullList<TagRecord>({ filter: "approved = true", sort: "name" })
      .catch(() => []),
  ]);

  const thoughts = thoughtsPage.items;
  const people = [
    ...new Set(
      thoughts.flatMap((t) => (t.people ?? []).map((p) => p.name)).filter(Boolean)
    ),
  ].sort();

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-8 sm:px-8">
      <h1 className="font-hand text-[1.6rem] leading-tight tracking-[-0.01em] text-ink">
        Your thoughts
      </h1>

      <div className="mt-5">
        <ThoughtsList
          groups={group(thoughts, view, tags)}
          tags={tags}
          people={people}
          total={thoughts.length}
        />
      </div>
    </div>
  );
}
