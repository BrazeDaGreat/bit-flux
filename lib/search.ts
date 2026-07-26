import type PocketBase from "pocketbase";

import { cosine, embedOne, type EmbedConfig } from "./ai/embeddings";
import type { AskScope, ThoughtRecord } from "./types";

export interface SearchHit {
  thought: ThoughtRecord;
  score: number;
  /** How this result was found — shown in the UI so "semantic off" is never
   *  a silent downgrade. `named` is not a find at all: the question pointed at
   *  this thought with `#`, so no ranking got a say. */
  via: "both" | "meaning" | "words" | "named";
}

export interface SearchResult {
  hits: SearchHit[];
  mode: "hybrid" | "keyword";
  /** Set when semantic search was wanted but couldn't run. */
  note?: string;
}

/** PocketBase filter strings need quotes escaped. */
function esc(value: string): string {
  return value.replace(/"/g, '\\"');
}

/**
 * Archiving is how a person takes something out of circulation, so it comes
 * out of retrieval too: nothing archived is ever a candidate, on either pass.
 * Every query built here starts from this clause.
 */
export const NOT_ARCHIVED = 'status != "archived"';

export function scopeFilter(scope: AskScope | undefined): string[] {
  if (!scope) return [];
  const parts: string[] = [];
  if (scope.tag) parts.push(`tags ~ "${esc(scope.tag)}"`);
  if (scope.person) parts.push(`people ~ "${esc(scope.person)}"`);
  if (scope.from) parts.push(`created >= "${esc(scope.from)}"`);
  if (scope.to) parts.push(`created <= "${esc(scope.to)}"`);
  return parts;
}

/**
 * Reciprocal rank fusion: each list contributes 1/(k + rank), so a result
 * that both methods like beats one that only a single method loves. Avoids
 * having to normalise two incomparable score scales.
 */
const RRF_K = 20;

export async function searchThoughts(
  client: PocketBase,
  query: string,
  options: {
    embed?: EmbedConfig | null;
    scope?: AskScope;
    limit?: number;
  } = {}
): Promise<SearchResult> {
  const limit = options.limit ?? 20;
  const trimmed = query.trim();
  if (!trimmed) return { hits: [], mode: "keyword" };

  const scopeParts = scopeFilter(options.scope);
  const scopeClause = scopeParts.length ? scopeParts.join(" && ") : "";

  // Keyword pass — always runs, so search works without any embedding key.
  const words = trimmed.split(/\s+/).filter((w) => w.length > 2).slice(0, 6);
  const wordClause = (words.length ? words : [trimmed])
    .map((word) => `(title ~ "${esc(word)}" || body ~ "${esc(word)}")`)
    .join(" || ");

  const keywordFilter = [NOT_ARCHIVED, scopeClause, `(${wordClause})`]
    .filter(Boolean)
    .join(" && ");

  const keywordHits = await client
    .collection("flux_thoughts")
    .getList<ThoughtRecord>(1, 60, { filter: keywordFilter, sort: "-created" })
    .then((page) => page.items)
    .catch(() => []);

  const ranks = new Map<string, { thought: ThoughtRecord; score: number; via: Set<string> }>();
  keywordHits.forEach((thought, index) => {
    ranks.set(thought.id, {
      thought,
      score: 1 / (RRF_K + index),
      via: new Set(["words"]),
    });
  });

  if (!options.embed) {
    return {
      hits: rank(ranks, limit),
      mode: "keyword",
    };
  }

  // Semantic pass — cosine over the user's own vectors. PocketBase has no
  // vector index, so this loads the candidate set and scores in memory.
  const vector = await embedOne(options.embed, trimmed);
  if (!vector) {
    return {
      hits: rank(ranks, limit),
      mode: "keyword",
      note: "Couldn't reach Gemini, so this searched words only.",
    };
  }

  const embeddedFilter = [NOT_ARCHIVED, scopeClause, 'embedding_model != ""']
    .filter(Boolean)
    .join(" && ");

  const candidates = await client
    .collection("flux_thoughts")
    .getFullList<ThoughtRecord>({ filter: embeddedFilter, sort: "-created" })
    .catch(() => []);

  if (candidates.length === 0) {
    return {
      hits: rank(ranks, limit),
      mode: "keyword",
      note: "No thoughts are indexed yet — searched words only.",
    };
  }

  const scored = candidates
    .map((thought) => ({
      thought,
      similarity: Array.isArray(thought.embedding)
        ? cosine(vector, thought.embedding)
        : 0,
    }))
    .filter((item) => item.similarity > 0.25)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 60);

  scored.forEach((item, index) => {
    const existing = ranks.get(item.thought.id);
    if (existing) {
      existing.score += 1 / (RRF_K + index);
      existing.via.add("meaning");
    } else {
      ranks.set(item.thought.id, {
        thought: item.thought,
        score: 1 / (RRF_K + index),
        via: new Set(["meaning"]),
      });
    }
  });

  return { hits: rank(ranks, limit), mode: "hybrid" };
}

function rank(
  ranks: Map<string, { thought: ThoughtRecord; score: number; via: Set<string> }>,
  limit: number
): SearchHit[] {
  return [...ranks.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => ({
      thought: entry.thought,
      score: entry.score,
      via:
        entry.via.size > 1
          ? "both"
          : entry.via.has("meaning")
            ? "meaning"
            : "words",
    }));
}
