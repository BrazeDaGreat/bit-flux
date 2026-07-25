import { redirect } from "next/navigation";

import AppWindow from "@/components/AppWindow";
import MobileBar from "@/components/MobileBar";
import MobileNav from "@/components/MobileNav";
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

  // Which chrome shows is a layout question, so CSS answers it — both are
  // rendered and the stylesheet picks. A hook here would render the wrong one
  // on the server and correct it after paint, which is a flicker in the frame
  // the whole app sits in.
  return (
    <AppWindow
      rail={
        <>
          <MobileBar user={user} />
          <WindowRail user={user} />
        </>
      }
      nav={<MobileNav />}
    >
      <Shortcuts />
      {children}
    </AppWindow>
  );
}
