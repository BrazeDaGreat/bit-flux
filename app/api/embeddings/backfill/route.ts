import { NextResponse } from "next/server";

import { currentUser, pbServer } from "@/lib/pb-server";
import { loadSettings, toEmbedConfig } from "@/lib/settings-server";
import { embedTexts, thoughtEmbedText } from "@/lib/ai/embeddings";
import { NOT_ARCHIVED } from "@/lib/search";
import type { ThoughtRecord } from "@/lib/types";

/** Gemini takes batches; this keeps each request well inside its limits. */
const BATCH = 20;
/** One call indexes at most this many, so the request never hangs. Repeat
 *  calls finish the job. */
const PER_CALL = 100;

/**
 * Indexes thoughts that have no vector yet — everything captured before a
 * Gemini key was added, plus anything whose text was edited afterwards.
 * Archived thoughts are skipped: they are out of retrieval, so they get no
 * vector at all. Un-archiving one puts it back in this queue.
 */
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const client = await pbServer();
  const settings = await loadSettings(client, user.id);
  const embedConfig = toEmbedConfig(settings);

  if (!embedConfig) {
    return NextResponse.json(
      { error: "Add a Gemini key in Settings to index your thoughts." },
      { status: 400 }
    );
  }

  const pending = await client
    .collection("flux_thoughts")
    .getList<ThoughtRecord>(1, PER_CALL, {
      filter: `embedding_model = "" && ${NOT_ARCHIVED}`,
      sort: "-created",
    });

  if (pending.items.length === 0) {
    return NextResponse.json({ indexed: 0, remaining: 0 });
  }

  let indexed = 0;
  try {
    for (let i = 0; i < pending.items.length; i += BATCH) {
      const batch = pending.items.slice(i, i + BATCH);
      const vectors = await embedTexts(
        embedConfig,
        batch.map((thought) => thoughtEmbedText(thought))
      );

      await Promise.all(
        batch.map((thought, index) => {
          const vector = vectors[index];
          if (!vector?.length) return null;
          indexed += 1;
          return client.collection("flux_thoughts").update(thought.id, {
            embedding: vector,
            embedding_model: embedConfig.model,
          });
        })
      );
    }
  } catch (err) {
    return NextResponse.json(
      {
        indexed,
        error: err instanceof Error ? err.message : "Indexing failed",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    indexed,
    remaining: Math.max(pending.totalItems - indexed, 0),
  });
}
