import { NextResponse } from "next/server";

import { encryptSecret } from "@/lib/crypto";
import { currentUser, pbServer } from "@/lib/pb-server";
import { loadProviders } from "@/lib/providers-server";
import {
  loadSafeSettings,
  loadSettings,
  saveSettings,
  toSafeSettings,
} from "@/lib/settings-server";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const client = await pbServer();
  const { safe } = await loadSafeSettings(client, user.id);
  return NextResponse.json(safe);
}

/**
 * Settings owns the two things that aren't a chat model: the embedding key
 * and model (nobody picks an embedding model per capture), and the reminder
 * preference. The chat model is chosen on Capture.
 */
export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json()) as {
    embed_api_key?: string;
    embed_model?: string;
    auto_reminders?: boolean;
  };

  const client = await pbServer();
  const existing = await loadSettings(client, user.id);

  const data: Record<string, unknown> = {
    embed_model: body.embed_model ?? existing?.embed_model ?? "",
    auto_reminders: body.auto_reminders ?? existing?.auto_reminders ?? false,
  };

  // An absent key means "leave the stored one alone"; an empty string means
  // "remove it".
  if (typeof body.embed_api_key === "string") {
    data.embed_api_key_enc = body.embed_api_key
      ? encryptSecret(body.embed_api_key)
      : "";
  }

  try {
    const saved = await saveSettings(client, user.id, existing, data);
    const providers = await loadProviders(client, user.id);
    return NextResponse.json(toSafeSettings(saved, providers));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't save settings" },
      { status: 500 }
    );
  }
}
