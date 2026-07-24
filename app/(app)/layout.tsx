import { redirect } from "next/navigation";

import AppWindow from "@/components/AppWindow";
import Shortcuts from "@/components/Shortcuts";
import WindowRail from "@/components/WindowRail";
import { currentUser } from "@/lib/pb-server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <AppWindow rail={<WindowRail user={user} />}>
      <Shortcuts />
      {children}
    </AppWindow>
  );
}
