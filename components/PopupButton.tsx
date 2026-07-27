"use client";

import { StickyNote } from "lucide-react";

import { stickyStore } from "@/lib/sticky-store";

/**
 * Asks for the note window. `StickyHost`, up in the app layout, is what
 * actually opens and holds it — see the note there for why the two are apart.
 *
 * The request goes out inside the click and nothing is awaited on the way,
 * because a floating window can only be asked for while the browser still
 * counts a gesture as happening.
 */
export default function PopupButton() {
  return (
    <button
      type="button"
      onClick={() => stickyStore.request()}
      title="A small window that floats above everything"
      className="flex shrink-0 items-center gap-1.5 font-data text-[0.68rem] text-ink-faint transition-colors hover:text-apricot"
    >
      <StickyNote aria-hidden="true" className="h-3 w-3" />
      Popup
    </button>
  );
}
