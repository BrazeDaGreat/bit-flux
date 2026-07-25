import { NextResponse } from "next/server";

import { currentUser, pbServer } from "@/lib/pb-server";
import { loadProviders } from "@/lib/providers-server";
import { loadSettings, saveSettings } from "@/lib/settings-server";
import type { ModelRef } from "@/lib/types";

/**
 * The chat model, chosen on Capture and kept for next time. Ask reads the same
 * choice, so switching model is one decision made in one place.
 */
export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json()) as Partial<ModelRef>;
  if (!body.provider || !body.model) {
    return NextResponse.json({ error: "Pick a model" }, { status: 400 });
  }

  const client = await pbServer();
  const providers = await loadProviders(client, user.id);
  if (!providers.some((p) => p.id === body.provider)) {
    return NextResponse.json({ error: "That provider doesn't exist" }, { status: 404 });
  }

  const existing = await loadSettings(client, user.id);
  try {
    await saveSettings(client, user.id, existing, {
      active_provider: body.provider,
      model: body.model,
    });
    return NextResponse.json({ active: { provider: body.provider, model: body.model } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't save that choice" },
      { status: 500 }
    );
  }
}
