import { redirect } from "next/navigation";

import { currentUser, pbServer } from "@/lib/pb-server";
import { loadSettings } from "@/lib/settings-server";
import type { TagRecord, ThoughtRecord } from "@/lib/types";
import type { Pane } from "./filters";
import ThoughtsBrowser from "./ThoughtsBrowser";

/** Everything the screen draws with — and nothing else. Leaving `embedding`
 *  out matters: each vector is ~15 KB of JSON, so asking for it would send
 *  megabytes to render a list of titles. `dump` and `dump_index` are here for
 *  the review tab, which splits a thought back into two. */
const FIELDS = [
  "id",
  "user",
  "dump",
  "dump_index",
  "title",
  "body",
  "status",
  "tags",
  "people",
  "action_date",
  "deadline",
  "reminder_at",
  "resurface_at",
  "date_precision",
  "date_source_text",
  "needs_review",
  "confidence",
  "created",
  "edited_at",
].join(",");

export default async function ThoughtsPage({
  searchParams,
}: {
  searchParams: Promise<{ pane?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const client = await pbServer();

  // One fetch, sliced in the browser. Filtering used to mean a round trip per
  // change; now the page is the data and narrowing it costs nothing.
  const [page, tags, settings, params] = await Promise.all([
    client
      .collection("flux_thoughts")
      .getList<ThoughtRecord>(1, 500, { sort: "-created", fields: FIELDS })
      .catch(() => ({ items: [] as ThoughtRecord[] })),
    client
      .collection("flux_tags")
      .getFullList<TagRecord>({ filter: "approved = true", sort: "name" })
      .catch(() => []),
    // The review tab writes what you correct back into the extraction prompt.
    loadSettings(client, user.id).catch(() => null),
    searchParams,
  ]);

  const thoughts = page.items;
  const people = [
    ...new Set(
      thoughts.flatMap((t) => (t.people ?? []).map((p) => p.name)).filter(Boolean)
    ),
  ].sort();

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <h1 className="font-hand text-[1.6rem] leading-tight tracking-[-0.01em] text-ink">
        Your thoughts
      </h1>

      <div className="mt-5">
        <ThoughtsBrowser
          thoughts={thoughts}
          tags={tags}
          people={people}
          settingsId={settings?.id ?? null}
          corrections={settings?.prefs?.corrections ?? []}
          initialPane={params.pane === "review" ? ("review" as Pane) : undefined}
        />
      </div>
    </div>
  );
}
