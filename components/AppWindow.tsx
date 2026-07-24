import type { ReactNode } from "react";

import SortingIndicator from "./SortingIndicator";

/**
 * The whole app lives inside one rounded window floating on the page. The
 * frame owns its own scroll so the page itself never moves — the window is a
 * fixed object you look into, not a document you scroll.
 */
export default function AppWindow({
  rail,
  children,
}: {
  rail?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh w-full items-center justify-center p-2 sm:p-5 lg:p-7">
      {/* `relative` so page-level status indicators can pin to the window's
          own corners rather than the viewport's. */}
      <div
        className="relative flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-[var(--radius-window)] border border-line bg-surface"
        style={{ boxShadow: "var(--shadow-window)" }}
      >
        {rail}
        <main className="flux-scroll min-h-0 flex-1 overflow-y-auto">
          {children}
        </main>
        {/* Sibling of the scroller, so it stays put while content moves. */}
        <SortingIndicator />
      </div>
    </div>
  );
}
