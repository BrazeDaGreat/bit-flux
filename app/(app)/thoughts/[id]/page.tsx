import { notFound, redirect } from "next/navigation";

import { currentUser, pbServer } from "@/lib/pb-server";
import type {
  DumpRecord,
  TagRecord,
  ThoughtRecord,
  ThoughtVersionRecord,
} from "@/lib/types";
import ThoughtEditor from "./ThoughtEditor";

export default async function ThoughtPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect("/login");

  const client = await pbServer();

  let thought: ThoughtRecord;
  try {
    thought = await client.collection("flux_thoughts").getOne<ThoughtRecord>(id);
  } catch {
    notFound();
  }

  const [dump, siblings, allTags, versions] = await Promise.all([
    client
      .collection("flux_dumps")
      .getOne<DumpRecord>(thought.dump)
      .catch(() => null),
    client
      .collection("flux_thoughts")
      .getFullList<ThoughtRecord>({
        filter: `dump = "${thought.dump}" && id != "${thought.id}"`,
        sort: "dump_index",
      })
      .catch(() => []),
    client
      .collection("flux_tags")
      .getFullList<TagRecord>({ sort: "name" })
      .catch(() => []),
    client
      .collection("flux_thought_versions")
      .getFullList<ThoughtVersionRecord>({
        filter: `thought = "${thought.id}"`,
        sort: "-created",
      })
      .catch(() => []),
  ]);

  return (
    <ThoughtEditor
      thought={thought}
      dump={dump}
      siblings={siblings}
      allTags={allTags}
      versions={versions}
    />
  );
}
