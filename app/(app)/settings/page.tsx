import { redirect } from "next/navigation";

import { currentUser, pbServer } from "@/lib/pb-server";
import { loadSafeSettings } from "@/lib/settings-server";
import SettingsForm from "./SettingsForm";

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const client = await pbServer();
  const { safe } = await loadSafeSettings(client, user.id);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-8 sm:py-10">
      <h1 className="font-hand text-[1.7rem] leading-tight tracking-[-0.01em] text-ink">
        Settings
      </h1>
      <p className="mt-1 max-w-[48ch] text-[0.82rem] leading-relaxed text-ink-soft max-lg:text-[0.95rem]">
        Your keys, your bill. Keys are encrypted on the server and never sent
        back to the browser.
      </p>

      <div className="mt-6">
        <SettingsForm initial={safe} />
      </div>
    </div>
  );
}
