/**
 * Embeddings are Gemini-only, through AI Studio, with their own key. The chat
 * provider is whatever the user picked; semantic search is not, because Groq
 * and OpenRouter have no embedding endpoint at all and a half-working search
 * is worse than an honest keyword one.
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";

/** Native output is 3072 floats. Stored per thought as JSON, that is ~25 KB
 *  each; 768 keeps the row small and the quality close. */
export const EMBED_DIMENSIONS = 768;

export const EMBED_MODELS = [
  "gemini-embedding-001",
  "gemini-embedding-2",
  "gemini-embedding-2-preview",
] as const;

export const DEFAULT_EMBED_MODEL = "gemini-embedding-001";

export interface EmbedConfig {
  apiKey: string;
  model: string;
}

export async function embedTexts(
  config: EmbedConfig,
  inputs: string[]
): Promise<number[][]> {
  if (inputs.length === 0) return [];

  const res = await fetch(`${GEMINI_BASE}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || DEFAULT_EMBED_MODEL,
      input: inputs,
      dimensions: EMBED_DIMENSIONS,
    }),
  });

  const data = (await res.json()) as {
    data?: { embedding?: number[]; index?: number }[];
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Embedding request failed (${res.status})`);
  }

  const ordered = (data.data ?? [])
    .slice()
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return ordered.map((item) => item.embedding ?? []);
}

export async function embedOne(
  config: EmbedConfig,
  input: string
): Promise<number[] | null> {
  try {
    const [vector] = await embedTexts(config, [input]);
    return vector?.length ? vector : null;
  } catch {
    return null;
  }
}

/** Gemini returns normalised vectors, but the guard costs nothing and keeps
 *  this correct if that ever changes. */
export function cosine(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Text a thought is indexed by — title carries most of the signal, so it
 *  leads. */
export function thoughtEmbedText(thought: {
  title: string;
  body: string;
}): string {
  return `${thought.title}\n\n${thought.body}`.slice(0, 8000);
}
