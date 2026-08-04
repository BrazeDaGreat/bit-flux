import { NextResponse } from "next/server";

import { currentUser, pbServer } from "@/lib/pb-server";
import { loadSettings, toEmbedConfig } from "@/lib/settings-server";
import {
  MissingModelError,
  MissingProviderError,
  resolveChatConfig,
} from "@/lib/providers-server";
import { streamQuestion } from "@/lib/ai/ask";
import { ProviderError } from "@/lib/ai/provider";
import { mentionIds, numberMentions, plainMentions } from "@/lib/mentions";
import { searchThoughts, type SearchHit } from "@/lib/search";
import type {
  AskScope,
  ChatRecord,
  DumpRecord,
  ModelRef,
  ThoughtRecord,
} from "@/lib/types";

/** Enough context to answer well without burning the whole window. */
const RETRIEVE = 14;

/** A question can only point at so many thoughts before it is a report. */
const MAX_NAMED = 6;

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

  // `#[Title](id)` is a pointer, not a phrase. Search never sees the token —
  // it sees the words the person read on screen.
  const asked = plainMentions(question);
  const named = mentionIds(question).slice(0, MAX_NAMED);

  try {
    const search = await searchThoughts(client, asked, {
      embed: toEmbedConfig(settings),
      scope: body.scope,
      limit: RETRIEVE,
    });

    /**
     * A named thought is in the context whatever retrieval thought of it, and
     * it is in it first — including one that has since been archived, because
     * pointing at something is a stronger statement than any filter. Scope is
     * deliberately not applied either: the person named this one.
     */
    const pinned: SearchHit[] = [];
    if (named.length) {
      const filter = named.map((id) => `id = "${id}"`).join(" || ");
      const records = await client
        .collection("flux_thoughts")
        .getFullList<ThoughtRecord>({ filter })
        .catch(() => []);
      const byId = new Map(records.map((record) => [record.id, record]));
      for (const id of named) {
        const thought = byId.get(id);
        if (thought) pinned.push({ thought, score: Infinity, via: "named" });
      }
    }

    const seen = new Set(pinned.map((hit) => hit.thought.id));
    const hits = [
      ...pinned,
      ...search.hits.filter((hit) => !seen.has(hit.thought.id)),
    ].slice(0, RETRIEVE + pinned.length);

    // The numbers the model will cite are the numbers in this list, so a
    // mention in the question can carry its own: "similar to #A nice dream [1]".
    const numbers = new Map(hits.map((hit, index) => [hit.thought.id, index + 1]));
    const forModel = numberMentions(question, (id) => numbers.get(id));

    // Pull the source dumps too — the original wording is often the answer.
    const dumpIds = [...new Set(hits.map((hit) => hit.thought.dump))];
    const dumps = new Map<string, DumpRecord>();
    if (dumpIds.length) {
      const filter = dumpIds.map((id) => `id = "${id}"`).join(" || ");
      const records = await client
        .collection("flux_dumps")
        .getFullList<DumpRecord>({ filter })
        .catch(() => []);
      for (const dump of records) dumps.set(dump.id, dump);
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        function send(payload: unknown) {
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
          } catch {
            // The browser may leave the page while the provider is still
            // answering. Persistence can finish, but there is no client left
            // to notify in that case.
          }
        }

        try {
          const { answer, citations } = await streamQuestion(
            config,
            forModel,
            { hits, dumps, now: new Date() },
            (text) => send({ type: "delta", text })
          );

          // Persist the exchange so the conversation survives a reload.
          let chatId = body.chat_id ?? "";
          if (!chatId) {
            const chat = await client.collection("flux_chats").create<ChatRecord>({
              user: user.id,
              title: asked.slice(0, 80),
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

          send({
            type: "done",
            chat_id: chatId,
            message_id: saved.id,
            answer,
            citations,
            mode: search.mode,
            note: search.note,
            used: hits.length,
          });
        } catch (err) {
          const message =
            err instanceof ProviderError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Couldn't answer that";
          send({ type: "error", error: message });
        } finally {
          try {
            controller.close();
          } catch {
            // The client disconnected before the stream completed.
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "X-Accel-Buffering": "no",
      },
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
