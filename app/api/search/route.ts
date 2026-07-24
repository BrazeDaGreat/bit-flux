import { NextResponse } from "next/server";

import { currentUser, pbServer } from "@/lib/pb-server";
import { loadSettings, toEmbedConfig } from "@/lib/settings-server";
import { searchThoughts } from "@/lib/search";
import type { AskScope } from "@/lib/types";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json()) as { q?: string; scope?: AskScope };
  const query = body.q?.trim();
  if (!query) return NextResponse.json({ hits: [], mode: "keyword" });

  const client = await pbServer();
  const settings = await loadSettings(client, user.id);

  const result = await searchThoughts(client, query, {
    embed: toEmbedConfig(settings),
    scope: body.scope,
    limit: 25,
  });

  return NextResponse.json({
    mode: result.mode,
    note: result.note,
    hits: result.hits.map((hit) => ({
      id: hit.thought.id,
      title: hit.thought.title,
      body: hit.thought.body.slice(0, 200),
      via: hit.via,
    })),
  });
}
