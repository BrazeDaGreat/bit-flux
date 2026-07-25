import type { ReactNode } from "react";

import SortingIndicator from "./SortingIndicator";

/**
 * The whole app lives inside one rounded window floating on the page. The
 * frame owns its own scroll so the page itself never moves — the window is a
 * fixed object you look into, not a document you scroll.
 *
 * On a phone there is nothing for it to float in, so it stops floating: the
 * window becomes the screen, and the frame is carried by its two lit edges —
 * the bar at the top and the sill at the bottom — instead of by an outline.
 * A tablet is wide enough to hold the object again, so the window comes back
 * there at a smaller radius and inset.
 *
 * Every `lg:` value below is the desktop app as it was, unchanged.
 */
export default function AppWindow({
  rail,
  nav,
  children,
}: {
  rail?: ReactNode;
  /** The sill. Phone only — a tablet gets the rail instead. */
  nav?: ReactNode;
  children: ReactNode;
}) {
  return (
    // In landscape a phone's notch eats the side of the screen, and the window
    // is full-bleed there — so the frame carries the inset, and the tablet and
    // desktop paddings overwrite it whole.
    <div className="flex h-dvh w-full items-center justify-center pl-[var(--safe-left)] pr-[var(--safe-right)] md:p-4 lg:p-7">
      {/* `relative` so page-level status indicators can pin to the window's
          own corners rather than the viewport's. */}
      <div
        className="relative flex h-full w-full max-w-none flex-col overflow-hidden rounded-none border-0 border-line bg-surface md:max-w-3xl md:rounded-[20px] md:border lg:max-w-5xl lg:rounded-[var(--radius-window)]"
        style={{ boxShadow: "var(--shadow-window)" }}
      >
        {rail}
        <main className="flux-scroll min-h-0 flex-1 overflow-y-auto">
          {children}
        </main>
        {/* Sibling of the scroller, so it stays put while content moves. */}
        <SortingIndicator />
        {nav}
      </div>
    </div>
  );
}
