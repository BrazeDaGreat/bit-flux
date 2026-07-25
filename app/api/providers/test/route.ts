import { NextResponse } from "next/server";

import { decryptSecret } from "@/lib/crypto";
import { currentUser, pbServer } from "@/lib/pb-server";
import { PROVIDERS, resolveBaseUrl, type ProviderId } from "@/lib/ai/provider";
import type { ProviderRecord } from "@/lib/types";

/**
 * Asks the endpoint for its model list — the smallest request that proves a
 * key works, and the only one available before a model has been picked. The
 * user finds out here rather than on their first real brain dump.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json()) as {
    id?: string;
    provider?: ProviderId;
    base_url?: string;
    api_key?: string;
  };

  let provider = body.provider;
  let baseUrl = body.base_url;
  let apiKey = body.api_key ?? "";

  if (body.id) {
    const client = await pbServer();
    try {
      const record = await client
        .collection("flux_providers")
        .getOne<ProviderRecord>(body.id);
      if (record.user !== user.id) throw new Error("not yours");
      provider = record.provider;
      baseUrl = record.base_url;
      apiKey = decryptSecret(record.api_key_enc);
    } catch {
      return NextResponse.json(
        { ok: false, error: "That provider doesn't exist" },
        { status: 404 }
      );
    }
  }

  if (!provider || !PROVIDERS[provider]) {
    return NextResponse.json({ ok: false, error: "Pick a provider" }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "Add a key first" }, { status: 400 });
  }

  try {
    const res = await fetch(`${resolveBaseUrl({ provider, baseUrl })}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const text = await res.text();
      let message = `The provider refused the key (${res.status})`;
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string } };
        if (parsed.error?.message) message = parsed.error.message;
      } catch {
        // Not JSON — the status line is the clearest thing we have.
      }
      return NextResponse.json({ ok: false, error: message });
    }
    const data = (await res.json()) as { data?: unknown[] };
    return NextResponse.json({ ok: true, models: data.data?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't reach that endpoint",
    });
  }
}
