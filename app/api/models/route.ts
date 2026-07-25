import { NextResponse } from "next/server";

import { currentUser, pbServer } from "@/lib/pb-server";
import {
  activeRef,
  liveFavorites,
  loadProviders,
  migrateLegacyProvider,
  pickedModels,
  toSafeProvider,
} from "@/lib/providers-server";
import { loadSettings } from "@/lib/settings-server";
import type { ProviderCatalog, ProviderRecord } from "@/lib/types";

/**
 * Everything the model picker draws: each connection with the models the user
 * chose to keep, plus what's currently selected and what's been favourited.
 *
 * The endpoint's own list is never sent here. A provider can offer three
 * hundred models and only a handful are ever wanted; which handful is a
 * decision made once, in Settings, rather than scrolled past every time.
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const client = await pbServer();
  const settings = await loadSettings(client, user.id);

  let providers = await loadProviders(client, user.id);
  if (providers.length === 0) {
    const migrated = await migrateLegacyProvider(client, user.id, settings);
    if (migrated) providers = [migrated];
  }

  const catalogs: ProviderCatalog[] = providers.map((record: ProviderRecord) => {
    const safe = toSafeProvider(record);
    const models = pickedModels(record);
    return {
      provider: safe,
      models,
      ...(!record.api_key_enc
        ? { note: "No key saved" }
        : models.length === 0
          ? { note: "No models picked yet" }
          : {}),
    };
  });

  return NextResponse.json({
    catalogs,
    active: activeRef(providers, settings),
    favorites: liveFavorites(providers, settings),
  });
}
