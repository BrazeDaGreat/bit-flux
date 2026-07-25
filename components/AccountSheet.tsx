"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Monitor, Moon, Settings, Sun } from "lucide-react";

import { clearAuth } from "@/lib/pb";
import { applyTheme, PALETTES, type ThemeMode } from "@/lib/theme";
import type { UserRecord } from "@/lib/types";
import { useTheme } from "@/lib/use-theme";
import Sheet, { SheetRow } from "./Sheet";
import { PaletteIcon } from "./ThemePicker";

const MODES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/**
 * Everything the rail keeps to the right of the navigation, on a screen with no
 * room for a right-hand side: which paper, which ink, settings, and the way
 * out. Four things that are all "about you rather than about your thoughts",
 * which is why they are one door instead of four controls in a row.
 *
 * The paper stocks get the room here that they never get in the rail — six
 * named swatches rather than a dropdown of a dropdown.
 */
export default function AccountSheet({
  user,
  open,
  onClose,
}: {
  user: UserRecord;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { mode, palette, dark } = useTheme();

  function signOut() {
    clearAuth();
    onClose();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Sheet open={open} onClose={onClose} title={user.name || user.email || "Account"}>
      <section className="mb-4">
        <h3 className="mb-1.5 px-1 font-data text-[0.66rem] uppercase tracking-[0.14em] text-ink-faint">
          Ink
        </h3>
        <div
          role="group"
          aria-label="Light or dark"
          className="flex gap-1 rounded-xl border border-line-strong p-1"
        >
          {MODES.map((option) => {
            const on = mode === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={on}
                onClick={() => applyTheme(option.value, palette)}
                className={`tap flex flex-1 items-center justify-center gap-1.5 rounded-lg text-[0.85rem] transition-colors ${
                  on ? "bg-iris-soft text-iris" : "text-ink-soft hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mb-4">
        <h3 className="mb-1.5 px-1 font-data text-[0.66rem] uppercase tracking-[0.14em] text-ink-faint">
          Paper
        </h3>
        <div role="group" aria-label="Paper stock" className="grid grid-cols-2 gap-1.5">
          {PALETTES.map((entry) => {
            const on = entry.id === palette;
            return (
              <button
                key={entry.id}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => applyTheme(mode, entry.id)}
                className={`tap flex items-center gap-2.5 rounded-xl border px-2.5 text-left transition-colors ${
                  on ? "border-iris bg-iris-soft" : "border-line hover:border-line-strong"
                }`}
              >
                <PaletteIcon palette={entry} dark={dark} className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-[0.88rem] ${
                      on ? "text-iris" : "text-ink"
                    }`}
                  >
                    {entry.label}
                  </span>
                  <span className="block truncate text-[0.72rem] text-ink-faint">
                    {entry.note}
                  </span>
                </span>
                {on && <Check className="h-3.5 w-3.5 shrink-0 text-iris" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="border-t border-line pt-2">
        <Link
          href="/settings"
          onClick={onClose}
          className="tap flex w-full items-center gap-2.5 rounded-xl px-2.5 text-[0.95rem] text-ink transition-colors hover:bg-surface-2"
        >
          <Settings className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
          Settings
        </Link>
        <SheetRow onClick={signOut}>
          <span className="text-ink-soft">Sign out</span>
        </SheetRow>
      </section>
    </Sheet>
  );
}
