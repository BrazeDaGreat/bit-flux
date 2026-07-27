import type { Metadata } from "next";
import { redirect } from "next/navigation";

import StickyNote from "@/components/StickyNote";
import { currentUser } from "@/lib/pb-server";

export const metadata: Metadata = {
  title: "Sticky · BIT Flux",
};

/**
 * The note window's own route.
 *
 * Deliberately outside the `(app)` group: this window has no rail, no nav and
 * no room for either. It is one screen with one job, and the chrome that makes
 * sense in a 1440px window is exactly what makes a 360px one unusable.
 */
export default async function StickyPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return <StickyNote userId={user.id} />;
}
