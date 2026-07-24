import type PocketBase from "pocketbase";

import { decryptSecret, maskKey } from "./crypto";
import type { ProviderConfig } from "./ai/provider";
import type { EmbedConfig } from "./ai/embeddings";
import { DEFAULT_EMBED_MODEL } from "./ai/embeddings";
import type { SafeSettings, SettingsRecord } from "./types";

/** One settings row per user, or null before they've saved anything. */
export async function loadSettings(
  client: PocketBase,
  userId: string
): Promise<SettingsRecord | null> {
  try {
    return await client
      .collection("flux_settings")
      .getFirstListItem<SettingsRecord>(`user = "${userId}"`);
  } catch {
    return null;
  }
}

function hintFor(ciphertext: string): string {
  if (!ciphertext) return "";
  try {
    return maskKey(decryptSecret(ciphertext));
  } catch {
    // Encrypted under a different JOLTEON_SECRET.
    return "unreadable — save it again";
  }
}

export function toSafeSettings(record: SettingsRecord | null): SafeSettings {
  if (!record) {
    return {
      provider: "",
      base_url: "",
      model: "",
      embed_model: "",
      auto_reminders: false,
      has_key: false,
      key_hint: "",
      has_embed_key: false,
      embed_key_hint: "",
    };
  }

  return {
    provider: record.provider,
    base_url: record.base_url ?? "",
    model: record.model ?? "",
    embed_model: record.embed_model ?? "",
    auto_reminders: Boolean(record.auto_reminders),
    has_key: Boolean(record.api_key_enc),
    key_hint: hintFor(record.api_key_enc),
    has_embed_key: Boolean(record.embed_api_key_enc),
    embed_key_hint: hintFor(record.embed_api_key_enc),
  };
}

export class MissingKeyError extends Error {
  constructor() {
    super("Add an API key in Settings before sorting thoughts.");
  }
}

/** The decrypted config used to actually call a model. Server-only. */
export function toProviderConfig(record: SettingsRecord | null): ProviderConfig {
  if (!record?.api_key_enc || !record.provider || !record.model) {
    throw new MissingKeyError();
  }
  return {
    provider: record.provider,
    apiKey: decryptSecret(record.api_key_enc),
    baseUrl: record.base_url || undefined,
    model: record.model,
  };
}

/** Null when the user hasn't added a Gemini key — search falls back to
 *  keywords rather than failing. */
export function toEmbedConfig(record: SettingsRecord | null): EmbedConfig | null {
  if (!record?.embed_api_key_enc) return null;
  try {
    return {
      apiKey: decryptSecret(record.embed_api_key_enc),
      model: record.embed_model || DEFAULT_EMBED_MODEL,
    };
  } catch {
    return null;
  }
}
