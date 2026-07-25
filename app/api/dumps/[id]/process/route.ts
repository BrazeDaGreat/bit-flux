import { NextResponse } from "next/server";

import { currentUser, pbServer } from "@/lib/pb-server";
import {
  loadSettings,
  MissingKeyError,
  toEmbedConfig,
  toProviderConfig,
} from "@/lib/settings-server";
import { ProviderError } from "@/lib/ai/provider";
import { embedOne, thoughtEmbedText } from "@/lib/ai/embeddings";
import { extractThoughts } from "@/lib/ai/extract";
import type { DumpRecord, TagRecord, ThoughtRecord } from "@/lib/types";
import { TAG_COLORS } from "@/lib/types";

/** Confidence under this lands in the review queue instead of being trusted. */
const REVIEW_THRESHOLD = 0.7;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const client = await pbServer();

  let dump: DumpRecord;
  try {
    dump = await client.collection("flux_dumps").getOne<DumpRecord>(id);
  } catch {
    return NextResponse.json({ error: "That dump doesn't exist" }, { status: 404 });
  }

  const settings = await loadSettings(client, user.id);

  let config;
  try {
    config = toProviderConfig(settings);
  } catch (err) {
    if (err instanceof MissingKeyError) {
      return NextResponse.json({ error: err.message, needs_key: true }, { status: 400 });
    }
    throw err;
  }

  // Optional — semantic search turns on only if a Gemini key is saved.
  const embedConfig = toEmbedConfig(settings);

  await client.collection("flux_dumps").update(dump.id, { status: "processing" });

  try {
    const tags = await client.collection("flux_tags").getFullList<TagRecord>({
      filter: "approved = true",
      sort: "-usage_count",
    });

    const result = await extractThoughts(config, dump.text, {
      tags: tags.map((t) => ({ name: t.name, description: t.description })),
      capturedAt: new Date((dump.captured_at || dump.created).replace(" ", "T")),
      timeZone: dump.capture_tz || "UTC",
      autoReminders: Boolean(settings?.auto_reminders),
      corrections: settings?.prefs?.corrections ?? [],
    });

    // Re-processing replaces the previous pass rather than duplicating it.
    const previous = await client
      .collection("flux_thoughts")
      .getFullList<ThoughtRecord>({ filter: `dump = "${dump.id}"` });
    await Promise.all(
      previous.map((t) => client.collection("flux_thoughts").delete(t.id))
    );

    const tagByName = new Map(tags.map((t) => [t.name.toLowerCase(), t]));
    const tagUsage = new Map<string, number>();
    const created: ThoughtRecord[] = [];

    for (const [index, thought] of result.thoughts.entries()) {
      const tagIds: string[] = [];
      for (const name of thought.tags) {
        const tag = tagByName.get(name.toLowerCase());
        if (!tag) continue;
        tagIds.push(tag.id);
        tagUsage.set(tag.id, (tagUsage.get(tag.id) ?? 0) + 1);
      }

      const vector = embedConfig
        ? await embedOne(embedConfig, thoughtEmbedText(thought))
        : null;

      const record = await client.collection("flux_thoughts").create<ThoughtRecord>({
        user: user.id,
        dump: dump.id,
        dump_index: index,
        title: thought.title,
        body: thought.body,
        status: "open",
        tags: tagIds,
        people: thought.people.map((name) => ({ name })),
        action_date: thought.action_date ?? "",
        deadline: thought.deadline ?? "",
        reminder_at: thought.reminder_at ?? "",
        resurface_at: thought.resurface_at ?? "",
        date_precision: thought.date_precision ?? "",
        date_source_text: thought.date_source_text ?? "",
        confidence: thought.confidence,
        needs_review: thought.confidence < REVIEW_THRESHOLD,
        embedding: vector,
        embedding_model: vector && embedConfig ? embedConfig.model : "",
      });
      created.push(record);

      await client.collection("flux_thought_versions").create({
        user: user.id,
        thought: record.id,
        snapshot: record,
        reason: "ai_initial",
      });
    }

    // Tags the model wanted but doesn't have. Stored unapproved — they never
    // apply themselves.
    const suggestions = new Map<string, string>();
    for (const thought of result.thoughts) {
      for (const tag of thought.suggested_tags) {
        if (!tagByName.has(tag.name.toLowerCase())) {
          suggestions.set(tag.name, tag.description);
        }
      }
    }
    for (const [name, description] of suggestions) {
      try {
        await client.collection("flux_tags").create({
          user: user.id,
          name,
          description,
          color: TAG_COLORS[suggestions.size % TAG_COLORS.length],
          origin: "ai_suggested",
          approved: false,
          usage_count: 0,
        });
      } catch {
        // Unique index rejects a name that already exists — nothing to do.
      }
    }

    await Promise.all(
      [...tagUsage].map(([tagId, count]) => {
        const tag = tags.find((t) => t.id === tagId);
        return client
          .collection("flux_tags")
          .update(tagId, { usage_count: (tag?.usage_count ?? 0) + count });
      })
    );

    await client.collection("flux_dumps").update(dump.id, {
      status: "processed",
      processed_at: new Date().toISOString(),
      model_used: result.model,
      process_error: "",
    });

    return NextResponse.json({ thoughts: created.length, model: result.model });
  } catch (err) {
    const message =
      err instanceof ProviderError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Sorting failed";

    await client.collection("flux_dumps").update(dump.id, {
      status: "failed",
      process_error: message.slice(0, 1900),
    });

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
