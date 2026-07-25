import { NextResponse } from "next/server";

import { encryptSecret } from "@/lib/crypto";
import { currentUser, pbServer } from "@/lib/pb-server";
import { loadProviders, toSafeProvider } from "@/lib/providers-server";
import { loadSettings, saveSettings } from "@/lib/settings-server";
import type { ProviderRecord } from "@/lib/types";

async function own(
  client: Awaited<ReturnType<typeof pbServer>>,
  id: string,
  userId: string
): Promise<ProviderRecord | null> {
  try {
    const record = await client
      .collection("flux_providers")
      .getOne<ProviderRecord>(id);
    return record.user === userId ? record : null;
  } catch {
    return null;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json()) as {
    label?: string;
    base_url?: string;
    api_key?: string;
    models?: string[];
  };

  const client = await pbServer();
  const record = await own(client, id, user.id);
  if (!record) {
    return NextResponse.json({ error: "That provider doesn't exist" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.label === "string") data.label = body.label.trim();
  if (typeof body.base_url === "string") data.base_url = body.base_url;
  // An absent key leaves the stored one alone; an empty string removes it.
  if (typeof body.api_key === "string") {
    data.api_key_enc = body.api_key ? encryptSecret(body.api_key) : "";
  }
  // The whole list arrives each time — it is short, and a full list is simpler
  // to reason about than a stream of add/remove calls.
  if (Array.isArray(body.models)) {
    data.models = [
      ...new Set(
        body.models
          .filter((model): model is string => typeof model === "string")
          .map((model) => model.trim())
          .filter(Boolean)
      ),
    ].slice(0, 200);
  }

  try {
    const updated = await client
      .collection("flux_providers")
      .update<ProviderRecord>(id, data);
    return NextResponse.json(toSafeProvider(updated));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't save that" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const client = await pbServer();
  const record = await own(client, id, user.id);
  if (!record) {
    return NextResponse.json({ error: "That provider doesn't exist" }, { status: 404 });
  }

  await client.collection("flux_providers").delete(id);

  // Anything pointing at it goes with it, so the picker never offers a model
  // that can't be reached.
  const settings = await loadSettings(client, user.id);
  if (settings) {
    const favorites = (settings.favorites ?? []).filter((f) => f.provider !== id);
    const data: Record<string, unknown> = { favorites };
    if (settings.active_provider === id) {
      data.active_provider = "";
      data.model = "";
    }
    await saveSettings(client, user.id, settings, data).catch(() => null);
  }

  const providers = await loadProviders(client, user.id);
  return NextResponse.json({ providers: providers.map(toSafeProvider) });
}
