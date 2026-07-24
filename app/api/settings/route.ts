import { NextResponse } from "next/server";

import { encryptSecret } from "@/lib/crypto";
import { currentUser, pbServer } from "@/lib/pb-server";
import { loadSettings, toSafeSettings } from "@/lib/settings-server";
import { PROVIDERS, type ProviderId } from "@/lib/ai/provider";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const client = await pbServer();
  const record = await loadSettings(client, user.id);
  return NextResponse.json(toSafeSettings(record));
}

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json()) as {
    provider?: ProviderId;
    base_url?: string;
    api_key?: string;
    model?: string;
    embed_api_key?: string;
    embed_model?: string;
    auto_reminders?: boolean;
  };

  if (body.provider && !PROVIDERS[body.provider]) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  if (body.provider === "custom" && !body.base_url) {
    return NextResponse.json(
      { error: "A custom provider needs a base URL" },
      { status: 400 }
    );
  }

  const client = await pbServer();
  const existing = await loadSettings(client, user.id);

  const data: Record<string, unknown> = {
    user: user.id,
    provider: body.provider ?? existing?.provider ?? "",
    base_url: body.base_url ?? existing?.base_url ?? "",
    model: body.model ?? existing?.model ?? "",
    embed_model: body.embed_model ?? existing?.embed_model ?? "",
    auto_reminders: body.auto_reminders ?? existing?.auto_reminders ?? false,
  };

  // An absent key means "leave the stored one alone"; an empty string means
  // "remove it".
  if (typeof body.api_key === "string") {
    data.api_key_enc = body.api_key ? encryptSecret(body.api_key) : "";
  }
  if (typeof body.embed_api_key === "string") {
    data.embed_api_key_enc = body.embed_api_key
      ? encryptSecret(body.embed_api_key)
      : "";
  }

  try {
    const saved = existing
      ? await client.collection("flux_settings").update(existing.id, data)
      : await client.collection("flux_settings").create(data);
    return NextResponse.json(toSafeSettings(saved as never));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't save settings" },
      { status: 500 }
    );
  }
}
