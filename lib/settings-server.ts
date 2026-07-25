import type PocketBase from "pocketbase";

import { decryptSecret, maskKey } from "./crypto";
import type { EmbedConfig } from "./ai/embeddings";
import { DEFAULT_EMBED_MODEL } from "./ai/embeddings";
import {
  activeRef,
  liveFavorites,
  loadProviders,
  migrateLegacyProvider,
  toSafeProvider,
} from "./providers-server";
import type { ProviderRecord, SafeSettings, SettingsRecord } from "./types";

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

/**
 * Everything the settings screen and the model picker are allowed to know,
 * with the connections already migrated forward if this account still had the
 * old single-provider shape.
 */
export async function loadSafeSettings(
  client: PocketBase,
  userId: string
): Promise<{ safe: SafeSettings; record: SettingsRecord | null; providers: ProviderRecord[] }> {
  const record = await loadSettings(client, userId);
  let providers = await loadProviders(client, userId);

  if (providers.length === 0) {
    const migrated = await migrateLegacyProvider(client, userId, record);
    if (migrated) {
      providers = [migrated];
      return {
        safe: toSafeSettings(record, providers, {
          active: { provider: migrated.id, model: record?.model ?? "" },
        }),
        record,
        providers,
      };
    }
  }

  return { safe: toSafeSettings(record, providers), record, providers };
}

export function toSafeSettings(
  record: SettingsRecord | null,
  providers: ProviderRecord[] = [],
  overrides: { active?: SafeSettings["active"] } = {}
): SafeSettings {
  const active = overrides.active ?? activeRef(providers, record);
  return {
    providers: providers.map(toSafeProvider),
    active: active?.model ? active : null,
    favorites: liveFavorites(providers, record),
    embed_model: record?.embed_model ?? "",
    auto_reminders: Boolean(record?.auto_reminders),
    has_embed_key: Boolean(record?.embed_api_key_enc),
    embed_key_hint: hintFor(record?.embed_api_key_enc ?? ""),
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

/** Creates the row on first write — a user has no settings until they set
 *  something. */
export async function saveSettings(
  client: PocketBase,
  userId: string,
  existing: SettingsRecord | null,
  data: Record<string, unknown>
): Promise<SettingsRecord> {
  return existing
    ? await client
        .collection("flux_settings")
        .update<SettingsRecord>(existing.id, data)
    : await client
        .collection("flux_settings")
        .create<SettingsRecord>({ user: userId, ...data });
}
