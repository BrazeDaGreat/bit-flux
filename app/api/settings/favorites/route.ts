import { NextResponse } from "next/server";

import { currentUser, pbServer } from "@/lib/pb-server";
import { liveFavorites, loadProviders } from "@/lib/providers-server";
import { loadSettings, saveSettings } from "@/lib/settings-server";
import type { ModelRef } from "@/lib/types";

/** The picker's Favourites list. Sent whole — it is short, and a full list is
 *  simpler to reason about than a stream of add/remove calls. */
export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json()) as { favorites?: ModelRef[] };
  const client = await pbServer();
  const providers = await loadProviders(client, user.id);
  const ids = new Set(providers.map((p) => p.id));

  const favorites = (body.favorites ?? [])
    .filter((f) => f?.provider && f.model && ids.has(f.provider))
    .slice(0, 30);

  const existing = await loadSettings(client, user.id);
  try {
    const saved = await saveSettings(client, user.id, existing, { favorites });
    return NextResponse.json({ favorites: liveFavorites(providers, saved) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't save favourites" },
      { status: 500 }
    );
  }
}
