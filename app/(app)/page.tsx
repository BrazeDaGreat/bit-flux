import { redirect } from "next/navigation";

import WeekPanel from "@/components/WeekPanel";
import { loadDashboard } from "@/lib/dashboard";
import { currentUser, pbServer } from "@/lib/pb-server";
import { currentSelection, loadProviders } from "@/lib/providers-server";
import { loadSettings } from "@/lib/settings-server";
import CaptureScreen from "./CaptureScreen";

export default async function CapturePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const client = await pbServer();
  const [settings, providers, dashboard] = await Promise.all([
    loadSettings(client, user.id),
    loadProviders(client, user.id),
    loadDashboard(client),
  ]);

  return (
    <CaptureScreen
      userId={user.id}
      hasProvider={providers.length > 0}
      selection={currentSelection(providers, settings)}
      weekPanel={<WeekPanel data={dashboard} />}
    />
  );
}
