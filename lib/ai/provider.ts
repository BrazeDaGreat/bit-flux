/**
 * One adapter for every provider we support: they all speak the OpenAI
 * chat-completions shape, including Gemini through its compatibility
 * endpoint. The only real difference is the base URL.
 *
 * Embeddings are not here — those are Gemini-only, in ./embeddings.ts.
 */

import { stripReasoning } from "../text";

export type ProviderId = "openai" | "groq" | "gemini" | "openrouter" | "custom";

export const PROVIDERS: Record<
  ProviderId,
  { label: string; baseUrl: string | null; keyHint: string }
> = {
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    keyHint: "sk-…",
  },
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    keyHint: "gsk_…",
  },
  gemini: {
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyHint: "AIza…",
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keyHint: "sk-or-…",
  },
  custom: {
    label: "Custom (OpenAI-compatible)",
    baseUrl: null,
    keyHint: "your key",
  },
};

/** Shown when the provider's own model list isn't reachable. */
export const FALLBACK_MODELS: Record<ProviderId, string[]> = {
  openai: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "o4-mini"],
  groq: [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "openai/gpt-oss-120b",
  ],
  gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
  openrouter: [
    "anthropic/claude-sonnet-4.5",
    "google/gemini-2.5-flash",
    "meta-llama/llama-3.3-70b-instruct",
  ],
  custom: [],
};

export interface ProviderConfig {
  provider: ProviderId;
  apiKey: string;
  baseUrl?: string;
  model: string;
}

export function resolveBaseUrl(config: {
  provider: ProviderId;
  baseUrl?: string;
}): string {
  const url = PROVIDERS[config.provider]?.baseUrl ?? config.baseUrl;
  if (!url) throw new Error("This provider needs a base URL");
  return url.replace(/\/+$/, "");
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function call(
  config: ProviderConfig,
  path: string,
  body: unknown
): Promise<Record<string, unknown>> {
  const res = await fetch(`${resolveBaseUrl(config)}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    if (!res.ok) throw new ProviderError(text.slice(0, 300), res.status);
    throw new ProviderError("The provider returned something unreadable", 502);
  }

  if (!res.ok) {
    // Surface the provider's own wording — rate limits and bad keys are much
    // easier to act on when the real message comes through.
    const err = parsed.error as { message?: string } | undefined;
    throw new ProviderError(
      err?.message ?? `Request failed (${res.status})`,
      res.status
    );
  }

  return parsed;
}

export interface ChatOptions {
  system: string;
  user: string;
  /** Ask for a JSON object back. Providers that ignore it still usually
   *  comply with the prompt, and the caller repairs what comes out. */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export async function chat(
  config: ProviderConfig,
  options: ChatOptions
): Promise<string> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: options.user },
    ],
    temperature: options.temperature ?? 0.2,
  };
  if (options.maxTokens) body.max_tokens = options.maxTokens;
  if (options.json) body.response_format = { type: "json_object" };

  let data: Record<string, unknown>;
  try {
    data = await call(config, "/chat/completions", body);
  } catch (err) {
    // Not every OpenAI-compatible endpoint accepts response_format.
    if (options.json && err instanceof ProviderError && err.status === 400) {
      delete body.response_format;
      data = await call(config, "/chat/completions", body);
    } else {
      throw err;
    }
  }

  const choices = data.choices as
    | { message?: { content?: string } }[]
    | undefined;
  const content = choices?.[0]?.message?.content;
  if (!content) throw new ProviderError("The model returned no content", 502);
  // Reasoning models talk to themselves first. That belongs to the model, not
  // to the person reading the answer — and it breaks JSON parsing downstream.
  return stripReasoning(content);
}

export async function listModels(config: ProviderConfig): Promise<string[]> {
  try {
    const res = await fetch(`${resolveBaseUrl(config)}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!res.ok) return FALLBACK_MODELS[config.provider] ?? [];
    const data = (await res.json()) as { data?: { id?: string }[] };
    const ids = (data.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => Boolean(id))
      // Embedding/audio/image models can't do the extraction job.
      .filter((id) => !/embed|whisper|tts|dall-e|image|moderation/i.test(id))
      .sort();
    return ids.length ? ids : (FALLBACK_MODELS[config.provider] ?? []);
  } catch {
    return FALLBACK_MODELS[config.provider] ?? [];
  }
}
