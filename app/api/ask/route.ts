import { NextResponse } from "next/server";

import { currentUser, pbServer } from "@/lib/pb-server";
import { loadSettings, toEmbedConfig } from "@/lib/settings-server";
import {
  MissingModelError,
  MissingProviderError,
  resolveChatConfig,
} from "@/lib/providers-server";
import { askQuestion } from "@/lib/ai/ask";
import { ProviderError } from "@/lib/ai/provider";
import { searchThoughts } from "@/lib/search";
import type { AskScope, ChatRecord, DumpRecord, ModelRef } from "@/lib/types";

/** Enough context to answer well without burning the whole window. */
const RETRIEVE = 14;

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json()) as {
    question?: string;
    chat_id?: string;
    scope?: AskScope;
    /** What the picker had selected when Ask was pressed. Falls back to the
     *  stored choice. */
    model?: ModelRef;
  };

  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json({ error: "Ask something first" }, { status: 400 });
  }

  const client = await pbServer();
  const settings = await loadSettings(client, user.id);

  let config;
  try {
    config = await resolveChatConfig(client, user.id, settings, body.model);
  } catch (err) {
    if (err instanceof MissingProviderError) {
      return NextResponse.json(
        { error: "Add a provider in Settings to use Ask.", needs_key: true },
        { status: 400 }
      );
    }
    if (err instanceof MissingModelError) {
      return NextResponse.json(
        { error: "Pick a model first.", needs_model: true },
        { status: 400 }
      );
    }
    throw err;
  }

  try {
    const search = await searchThoughts(client, question, {
      embed: toEmbedConfig(settings),
      scope: body.scope,
      limit: RETRIEVE,
    });

    // Pull the source dumps too — the original wording is often the answer.
    const dumpIds = [...new Set(search.hits.map((hit) => hit.thought.dump))];
    const dumps = new Map<string, DumpRecord>();
    if (dumpIds.length) {
      const filter = dumpIds.map((id) => `id = "${id}"`).join(" || ");
      const records = await client
        .collection("flux_dumps")
        .getFullList<DumpRecord>({ filter })
        .catch(() => []);
      for (const dump of records) dumps.set(dump.id, dump);
    }

    const { answer, citations } = await askQuestion(config, question, {
      hits: search.hits,
      dumps,
      now: new Date(),
    });

    // Persist the exchange so the conversation survives a reload.
    let chatId = body.chat_id ?? "";
    if (!chatId) {
      const chat = await client.collection("flux_chats").create<ChatRecord>({
        user: user.id,
        title: question.slice(0, 80),
        scope: body.scope ?? null,
      });
      chatId = chat.id;
    }

    await client.collection("flux_messages").create({
      user: user.id,
      chat: chatId,
      role: "user",
      content: question,
    });
    const saved = await client.collection("flux_messages").create({
      user: user.id,
      chat: chatId,
      role: "assistant",
      content: answer,
      citations,
      model_used: config.model,
    });

    return NextResponse.json({
      chat_id: chatId,
      message_id: saved.id,
      answer,
      citations,
      mode: search.mode,
      note: search.note,
      used: search.hits.length,
    });
  } catch (err) {
    const message =
      err instanceof ProviderError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Couldn't answer that";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
