import { redirect } from "next/navigation";

import { currentUser, pbServer } from "@/lib/pb-server";
import type { PersonRecord, TagRecord, ThoughtRecord } from "@/lib/types";
import PeopleManager from "./PeopleManager";
import TagManager from "./TagManager";

export default async function TagsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const client = await pbServer();

  const [tags, people, thoughts] = await Promise.all([
    client
      .collection("flux_tags")
      .getFullList<TagRecord>({ sort: "-usage_count,name" })
      .catch(() => [] as TagRecord[]),
    client
      .collection("flux_people")
      .getFullList<PersonRecord>({ sort: "name" })
      .catch(() => [] as PersonRecord[]),
    // Only the names — people are stored on the thought itself, so this is how
    // the roster knows who is actually being written about.
    client
      .collection("flux_thoughts")
      .getFullList<ThoughtRecord>({ fields: "people" })
      .catch(() => [] as ThoughtRecord[]),
  ]);

  const mentions: Record<string, number> = {};
  for (const thought of thoughts) {
    for (const person of thought.people ?? []) {
      if (person.name) mentions[person.name] = (mentions[person.name] ?? 0) + 1;
    }
  }

  const tagCount = tags.filter((tag) => tag.approved).length;
  const peopleCount = new Set([
    ...people.map((person) => person.name.toLowerCase()),
    ...Object.keys(mentions).map((name) => name.toLowerCase()),
  ]).size;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <h1 className="font-hand text-[1.6rem] leading-tight tracking-[-0.01em] text-ink">
        Tags &amp; people
      </h1>
      <p className="mt-1 max-w-[52ch] text-[0.82rem] leading-relaxed text-ink-soft">
        Two things the AI files by: what a thought is about, and who it
        involves. Describe them here and the next thought lands where you&apos;d
        put it yourself.
      </p>

      <div className="mt-7 grid gap-x-10 gap-y-9 lg:grid-cols-2">
        <section>
          <ColumnHead label="tags" count={tagCount} />
          <TagManager userId={user.id} initialTags={tags} />
        </section>

        <section className="lg:border-l lg:border-line lg:pl-10">
          <ColumnHead label="people" count={peopleCount} />
          <PeopleManager
            userId={user.id}
            initialPeople={people}
            mentions={mentions}
          />
        </section>
      </div>
    </div>
  );
}

/** Both halves are lists of the same kind of thing, so they get the same
 *  heading: a quiet label and the number in it. */
function ColumnHead({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-3.5 flex items-baseline justify-between border-b border-line pb-1.5">
      <h2 className="font-data text-[0.64rem] uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </h2>
      <span className="font-data text-[0.64rem] text-ink-faint">{count}</span>
    </div>
  );
}
