import { redirect } from "next/navigation";

import { currentUser, pbServer } from "@/lib/pb-server";
import { loadSettings } from "@/lib/settings-server";
import type { ThoughtRecord } from "@/lib/types";
import ReviewQueue from "./ReviewQueue";

export default async function ReviewPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const client = await pbServer();
  let items: ThoughtRecord[] = [];
  try {
    items = await client.collection("flux_thoughts").getFullList<ThoughtRecord>({
      filter: "needs_review = true",
      sort: "confidence,-created",
    });
  } catch {
    items = [];
  }

  const settings = await loadSettings(client, user.id);

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-8 sm:px-8">
      <h1 className="font-hand text-[1.6rem] leading-tight tracking-[-0.01em] text-ink">
        Worth a second look
      </h1>
      <p className="mt-1 max-w-[46ch] text-[0.82rem] leading-relaxed text-ink-soft">
        The AI wasn&apos;t sure about these. What you decide here is what it
        learns from.
      </p>

      <ReviewQueue
        initialItems={items}
        settingsId={settings?.id ?? null}
        corrections={settings?.prefs?.corrections ?? []}
      />
    </div>
  );
}
