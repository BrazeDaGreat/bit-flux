import Link from "next/link";
import { redirect } from "next/navigation";

import { currentUser, pbServer } from "@/lib/pb-server";
import { loadSettings } from "@/lib/settings-server";
import type {
  AskScope,
  ChatRecord,
  MessageRecord,
  TagRecord,
  ThoughtRecord,
} from "@/lib/types";
import AskRoom from "./AskRoom";

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{
    tag?: string;
    q?: string;
    chat?: string;
  }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const client = await pbServer();

  const [tags, thoughts, settings, chats, history] = await Promise.all([
    client
      .collection("flux_tags")
      .getFullList<TagRecord>({ filter: "approved = true", sort: "name" })
      .catch(() => []),
    client
      .collection("flux_thoughts")
      .getFullList<ThoughtRecord>({ fields: "people" })
      .catch(() => []),
    loadSettings(client, user.id),
    client
      .collection("flux_chats")
      .getFullList<ChatRecord>({ sort: "-created" })
      .catch(() => []),
    params.chat
      ? client
          .collection("flux_messages")
          .getFullList<MessageRecord>({
            filter: `chat = "${params.chat}"`,
            sort: "created",
          })
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  const people = [
    ...new Set(
      thoughts.flatMap((t) => (t.people ?? []).map((p) => p.name)).filter(Boolean)
    ),
  ].sort();

  const scope: AskScope = {};
  if (params.tag) scope.tag = params.tag;

  if (!settings?.api_key_enc || !settings.model) {
    return (
      <div className="mx-auto w-full max-w-xl px-5 py-10 sm:px-8">
        <h1 className="font-hand text-[1.6rem] leading-tight tracking-[-0.01em] text-ink">
          Ask your own notes
        </h1>
        <p className="mt-4 rounded-xl bg-amber-soft px-3.5 py-2.5 text-[0.82rem] text-amber">
          Ask needs a model.{" "}
          <Link href="/settings" className="underline underline-offset-2">
            Add an API key
          </Link>{" "}
          to turn it on.
        </p>
      </div>
    );
  }

  return (
    <AskRoom
      tags={tags}
      people={people}
      initialScope={Object.keys(scope).length ? scope : undefined}
      initialQuestion={params.q ?? ""}
      chats={chats.map((chat) => ({
        id: chat.id,
        title: chat.title,
        created: String(chat.created ?? ""),
      }))}
      openChatId={history.length ? (params.chat ?? null) : null}
      openChatMessages={history}
    />
  );
}
