import type PocketBase from "pocketbase";

import { decryptSecret, maskKey } from "./crypto";
import { PROVIDERS, type ProviderConfig, type ProviderId } from "./ai/provider";
import type {
  ModelRef,
  ProviderRecord,
  SafeProvider,
  SettingsRecord,
} from "./types";

/**
 * Connections live one per row in flux_providers so a person can hold several
 * at once. Which one is in use is a separate, tiny decision stored on the
 * settings row — made on Capture, reused by Ask.
 *
 * Server-only: every function here can see decrypted keys.
 */

export async function loadProviders(
  client: PocketBase,
  userId: string
): Promise<ProviderRecord[]> {
  return client
    .collection("flux_providers")
    .getFullList<ProviderRecord>({
      filter: `user = "${userId}"`,
      sort: "created",
    })
    .catch(() => []);
}

export function defaultLabel(provider: ProviderId): string {
  return PROVIDERS[provider]?.label ?? provider;
}

function hintFor(ciphertext: string): string {
  if (!ciphertext) return "";
  try {
    return maskKey(decryptSecret(ciphertext));
  } catch {
    // Encrypted under a different JOLTEON_SECRET.
    return "unreadable — add it again";
  }
}

/** Stored as JSON, so it can come back as anything. */
export function pickedModels(record: ProviderRecord): string[] {
  return Array.isArray(record.models)
    ? record.models.filter((model): model is string => typeof model === "string")
    : [];
}

export function toSafeProvider(record: ProviderRecord): SafeProvider {
  return {
    id: record.id,
    provider: record.provider,
    label: record.label || defaultLabel(record.provider),
    base_url: record.base_url ?? "",
    has_key: Boolean(record.api_key_enc),
    key_hint: hintFor(record.api_key_enc),
    models: pickedModels(record),
  };
}

/**
 * Carries a pre-multi-provider account forward: the single connection that
 * used to live on the settings row becomes the first flux_providers row, and
 * the model it was set to becomes the active choice. Runs at most once — the
 * legacy key is cleared as part of the move.
 */
export async function migrateLegacyProvider(
  client: PocketBase,
  userId: string,
  settings: SettingsRecord | null
): Promise<ProviderRecord | null> {
  if (!settings?.api_key_enc || !settings.provider) return null;

  try {
    const created = await client
      .collection("flux_providers")
      .create<ProviderRecord>({
        user: userId,
        provider: settings.provider,
        label: defaultLabel(settings.provider),
        base_url: settings.base_url ?? "",
        api_key_enc: settings.api_key_enc,
      });

    await client.collection("flux_settings").update(settings.id, {
      active_provider: created.id,
      model: settings.model ?? "",
      provider: "",
      base_url: "",
      api_key_enc: "",
    });

    return created;
  } catch {
    // A failed migration must not break the page it was triggered from; the
    // legacy row stays untouched and the next read tries again.
    return null;
  }
}

/**
 * PocketBase answers a request for a collection it doesn't have with "Missing
 * or invalid collection context", which reads as a bug in the app rather than
 * as a schema that hasn't been set up. Multi-provider added a collection, so
 * this is the first thing an out-of-date instance hits.
 */
export function describeError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : "";
  if (/collection context/i.test(message)) {
    return "The flux_providers collection doesn't exist yet. Run `pnpm pb:setup` against your PocketBase instance.";
  }
  return message || fallback;
}

export class MissingProviderError extends Error {
  constructor() {
    super("Add a provider in Settings before sorting thoughts.");
  }
}

export class MissingModelError extends Error {
  constructor() {
    super("Pick a model on the Capture screen first.");
  }
}

export function toProviderConfig(
  record: ProviderRecord,
  model: string
): ProviderConfig {
  if (!record.api_key_enc) throw new MissingProviderError();
  if (!model) throw new MissingModelError();
  return {
    provider: record.provider,
    apiKey: decryptSecret(record.api_key_enc),
    baseUrl: record.base_url || undefined,
    model,
  };
}

/**
 * The connection and model a request should run on: what it asked for, else
 * what was last chosen, else the only connection there is.
 */
export function pickProvider(
  providers: ProviderRecord[],
  settings: SettingsRecord | null,
  override?: ModelRef | null
): { record: ProviderRecord; model: string } {
  if (providers.length === 0) throw new MissingProviderError();

  const wantedId = override?.provider || settings?.active_provider || "";
  const record =
    providers.find((p) => p.id === wantedId) ??
    (providers.length === 1 ? providers[0] : undefined);

  if (!record) throw new MissingProviderError();

  const model =
    (override?.provider === record.id ? override.model : "") ||
    (record.id === settings?.active_provider ? (settings?.model ?? "") : "") ||
    (override?.model ?? "");

  return { record, model };
}

/** One call for the routes that just need something to talk to. */
export async function resolveChatConfig(
  client: PocketBase,
  userId: string,
  settings: SettingsRecord | null,
  override?: ModelRef | null
): Promise<ProviderConfig> {
  let providers = await loadProviders(client, userId);
  if (providers.length === 0) {
    const migrated = await migrateLegacyProvider(client, userId, settings);
    if (migrated) providers = [migrated];
  }
  const { record, model } = pickProvider(providers, settings, override);
  return toProviderConfig(record, model);
}

/** The active choice, as the browser is allowed to see it. */
export function activeRef(
  providers: ProviderRecord[],
  settings: SettingsRecord | null
): ModelRef | null {
  if (!settings?.active_provider || !settings.model) return null;
  if (!providers.some((p) => p.id === settings.active_provider)) return null;
  return { provider: settings.active_provider, model: settings.model };
}

/** The active choice with the connection's name attached — enough for the
 *  picker's trigger to render before it fetches anything. */
export function currentSelection(
  providers: ProviderRecord[],
  settings: SettingsRecord | null
): (ModelRef & { label: string; kind: ProviderId }) | null {
  const ref = activeRef(providers, settings);
  if (!ref) return null;
  const record = providers.find((p) => p.id === ref.provider);
  if (!record) return null;
  return {
    ...ref,
    label: record.label || defaultLabel(record.provider),
    kind: record.provider,
  };
}

/**
 * Favourites pointing at a connection that's gone — or at a model no longer
 * on that connection's list — are dropped rather than shown as dead entries.
 */
export function liveFavorites(
  providers: ProviderRecord[],
  settings: SettingsRecord | null
): ModelRef[] {
  const allowed = new Map(
    providers.map((provider) => [provider.id, new Set(pickedModels(provider))])
  );
  return (settings?.favorites ?? []).filter((favorite) =>
    Boolean(
      favorite?.provider &&
        favorite.model &&
        allowed.get(favorite.provider)?.has(favorite.model)
    )
  );
}
