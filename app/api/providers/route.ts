import { NextResponse } from "next/server";

import { encryptSecret } from "@/lib/crypto";
import { currentUser, pbServer } from "@/lib/pb-server";
import {
  defaultLabel,
  describeError,
  loadProviders,
  toSafeProvider,
} from "@/lib/providers-server";
import { loadSafeSettings } from "@/lib/settings-server";
import { PROVIDERS, type ProviderId } from "@/lib/ai/provider";
import type { ProviderRecord, SafeProvider } from "@/lib/types";

interface Draft {
  provider?: ProviderId;
  label?: string;
  base_url?: string;
  api_key?: string;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const client = await pbServer();
  const { safe } = await loadSafeSettings(client, user.id);
  return NextResponse.json(safe);
}

/**
 * Adds one or several connections in a single request — the settings screen
 * lets a person fill in every account they have before saving once, and a
 * partial save would be worse than no save.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json()) as { providers?: Draft[] };
  const drafts = body.providers ?? [];

  if (drafts.length === 0) {
    return NextResponse.json({ error: "Nothing to add" }, { status: 400 });
  }

  for (const draft of drafts) {
    if (!draft.provider || !PROVIDERS[draft.provider]) {
      return NextResponse.json({ error: "Pick a provider" }, { status: 400 });
    }
    if (draft.provider === "custom" && !draft.base_url) {
      return NextResponse.json(
        { error: "A custom endpoint needs a base URL" },
        { status: 400 }
      );
    }
    if (!draft.api_key) {
      return NextResponse.json(
        { error: `Add a key for ${draft.label || defaultLabel(draft.provider)}` },
        { status: 400 }
      );
    }
  }

  const client = await pbServer();
  const added: SafeProvider[] = [];

  try {
    for (const draft of drafts) {
      const record = await client
        .collection("flux_providers")
        .create<ProviderRecord>({
          user: user.id,
          provider: draft.provider,
          label: draft.label?.trim() || defaultLabel(draft.provider!),
          base_url: draft.base_url ?? "",
          api_key_enc: encryptSecret(draft.api_key!),
        });
      added.push(toSafeProvider(record));
    }
  } catch (err) {
    return NextResponse.json(
      { error: describeError(err, "Couldn't add that provider"), added },
      { status: 500 }
    );
  }

  const providers = await loadProviders(client, user.id);
  return NextResponse.json({
    added,
    providers: providers.map(toSafeProvider),
  });
}
