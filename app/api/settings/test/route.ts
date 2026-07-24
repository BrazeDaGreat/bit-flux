import { NextResponse } from "next/server";

import { currentUser, pbServer } from "@/lib/pb-server";
import { loadSettings } from "@/lib/settings-server";
import { decryptSecret } from "@/lib/crypto";
import { chat, PROVIDERS, ProviderError, type ProviderId } from "@/lib/ai/provider";

/** One tiny completion, so the user finds out here rather than on their first
 *  real brain dump. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json()) as {
    provider?: ProviderId;
    base_url?: string;
    api_key?: string;
    model?: string;
  };

  if (!body.provider || !PROVIDERS[body.provider]) {
    return NextResponse.json({ ok: false, error: "Pick a provider" }, { status: 400 });
  }
  if (!body.model) {
    return NextResponse.json({ ok: false, error: "Pick a model" }, { status: 400 });
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
    return NextResponse.json({ ok: false, error: "Add an API key first" }, { status: 400 });
  }

  try {
    const reply = await chat(
      {
        provider: body.provider,
        apiKey,
        baseUrl: body.base_url,
        model: body.model,
      },
      {
        system: "Reply with the single word: ready",
        user: "ping",
        maxTokens: 8,
        temperature: 0,
      }
    );
    return NextResponse.json({ ok: true, reply: reply.trim().slice(0, 40) });
  } catch (err) {
    const message =
      err instanceof ProviderError
        ? err.message
        : err instanceof Error
          ? err.message
          : "The provider didn't respond";
    return NextResponse.json({ ok: false, error: message });
  }
}
