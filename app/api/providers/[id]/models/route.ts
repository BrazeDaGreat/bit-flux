import { NextResponse } from "next/server";

import { decryptSecret } from "@/lib/crypto";
import { currentUser, pbServer } from "@/lib/pb-server";
import { pickedModels } from "@/lib/providers-server";
import { FALLBACK_MODELS, listModels } from "@/lib/ai/provider";
import type { ProviderRecord } from "@/lib/types";

/**
 * Everything this endpoint offers — the long list, asked for only on the
 * Settings screen, where the point is to choose from it. The picker on Capture
 * never sees this; it sees what was chosen here.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const client = await pbServer();

  let record: ProviderRecord;
  try {
    record = await client.collection("flux_providers").getOne<ProviderRecord>(id);
    if (record.user !== user.id) throw new Error("not yours");
  } catch {
    return NextResponse.json(
      { error: "That provider doesn't exist" },
      { status: 404 }
    );
  }

  const picked = pickedModels(record);

  if (!record.api_key_enc) {
    return NextResponse.json({
      available: [],
      picked,
      note: "Add a key first.",
    });
  }

  let apiKey = "";
  try {
    apiKey = decryptSecret(record.api_key_enc);
  } catch {
    return NextResponse.json({
      available: [],
      picked,
      note: "That key can't be read — replace it.",
    });
  }

  const available = await listModels({
    provider: record.provider,
    apiKey,
    baseUrl: record.base_url || undefined,
    model: "",
  });

  const fellBack =
    available.length > 0 && available === FALLBACK_MODELS[record.provider];

  return NextResponse.json({
    available,
    picked,
    ...(available.length === 0
      ? { note: "This endpoint doesn't list its models. Add ids by hand below." }
      : fellBack
        ? { note: "Couldn't reach the list, so these are the usual ones." }
        : {}),
  });
}
