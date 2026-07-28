import { redirect } from "next/navigation";

import AppWindow from "@/components/AppWindow";
import AppContextMenu from "@/components/AppContextMenu";
import MobileBar from "@/components/MobileBar";
import MobileNav from "@/components/MobileNav";
import FreshData from "@/components/FreshData";
import Shortcuts from "@/components/Shortcuts";
import StickyHost from "@/components/StickyHost";
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
      <AppContextMenu />
      <Shortcuts />
      {/* Screens are served from the browser's own copy and brought up to date
          behind the paint. In the layout because it has to watch the route
          change, which is the moment a page component is being replaced. */}
      <FreshData />
      {/* Here rather than on Capture: the note window is rendered out of this
          tree, so whatever owns it has to outlive every page you can walk to
          while it is open. */}
      <StickyHost userId={user.id} />
      {children}
    </AppWindow>
  );
}
