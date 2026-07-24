import { redirect } from "next/navigation";

import { currentUser, pbServer } from "@/lib/pb-server";
import type { TagRecord } from "@/lib/types";
import TagManager from "./TagManager";

export default async function TagsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const client = await pbServer();
  let tags: TagRecord[] = [];
  try {
    tags = await client
      .collection("flux_tags")
      .getFullList<TagRecord>({ sort: "-usage_count,name" });
  } catch {
    tags = [];
  }

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-8 sm:px-8">
      <h1 className="font-hand text-[1.6rem] leading-tight tracking-[-0.01em] text-ink">
        Tags
      </h1>
      <p className="mt-1 max-w-[46ch] text-[0.82rem] leading-relaxed text-ink-soft">
        Describe what a tag means to you and the AI files the next thought the
        way you would.
      </p>

      <div className="mt-6">
        <TagManager userId={user.id} initialTags={tags} />
      </div>
    </div>
  );
}
