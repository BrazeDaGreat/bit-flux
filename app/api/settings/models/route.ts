import { NextResponse } from "next/server";

import { currentUser, pbServer } from "@/lib/pb-server";
import { loadSettings } from "@/lib/settings-server";
import { decryptSecret } from "@/lib/crypto";
import {
  FALLBACK_MODELS,
  listModels,
  PROVIDERS,
  type ProviderId,
} from "@/lib/ai/provider";

/**
 * Lists models for a provider. Accepts a key in the body so the picker works
 * while the user is still typing one in, before anything is saved.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json()) as {
    provider?: ProviderId;
    base_url?: string;
    api_key?: string;
  };

  const provider = body.provider;
  if (!provider || !PROVIDERS[provider]) {
    return NextResponse.json({ error: "Pick a provider first" }, { status: 400 });
  }

  let apiKey = body.api_key ?? "";
  if (!apiKey) {
    const client = await pbServer();
    const record = await loadSettings(client, user.id);
    if (record?.api_key_enc) {
      try {
        apiKey = decryptSecret(record.api_key_enc);
      } catch {
        apiKey = "";
      }
    }
  }

  if (!apiKey) {
    return NextResponse.json({ models: FALLBACK_MODELS[provider] ?? [] });
  }

  const models = await listModels({
    provider,
    apiKey,
    baseUrl: body.base_url,
    model: "",
  });
  return NextResponse.json({ models });
}
