import { redirect } from "next/navigation";

import WeekPanel from "@/components/WeekPanel";
import { loadDashboard } from "@/lib/dashboard";
import { currentUser, pbServer } from "@/lib/pb-server";
import { loadSettings } from "@/lib/settings-server";
import CaptureScreen from "./CaptureScreen";

export default async function CapturePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const client = await pbServer();
  const [settings, dashboard] = await Promise.all([
    loadSettings(client, user.id),
    loadDashboard(client),
  ]);

  return (
    <CaptureScreen
      userId={user.id}
      hasKey={Boolean(settings?.api_key_enc && settings.model)}
      weekPanel={<WeekPanel data={dashboard} />}
    />
  );
}
