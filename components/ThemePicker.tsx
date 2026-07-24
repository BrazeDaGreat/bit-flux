"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import {
  applyTheme,
  DEFAULT_MODE,
  DEFAULT_PALETTE,
  isMode,
  isPalette,
  PALETTES,
  type PaletteId,
  type ThemeMode,
} from "@/lib/theme";

/** The <html> attributes are the source of truth — the inline script in the
 *  root layout sets them before first paint, so we read from the DOM rather
 *  than keeping a second copy of the same state. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-palette", "data-theme-mode"],
  });
  return () => observer.disconnect();
}

/** One string, because useSyncExternalStore compares snapshots by identity and
 *  a fresh object every read would loop. */
function getSnapshot(): string {
  const root = document.documentElement;
  const mode = root.getAttribute("data-theme-mode");
  const palette = root.getAttribute("data-palette");
  const dark = root.classList.contains("dark") ? "dark" : "light";
  return `${isMode(mode) ? mode : DEFAULT_MODE}|${
    isPalette(palette) ? palette : DEFAULT_PALETTE
  }|${dark}`;
}

const SERVER_SNAPSHOT = `${DEFAULT_MODE}|${DEFAULT_PALETTE}|light`;

/**
 * A stock swatch rather than a switch. The palette only changes the paper — the
 * seven accent inks are fixed, so each chip shows exactly what varies: the
 * sheet and the ink laid on it, in the mode you'd actually see it in.
 */
function StockChip({
  palette,
  dark,
  className = "",
}: {
  palette: (typeof PALETTES)[number];
  dark: boolean;
  className?: string;
}) {
  const { paper, ink } = dark ? palette.swatch.dark : palette.swatch.light;
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-[5px] ${className}`}
      style={{ background: paper, boxShadow: `inset 0 0 0 1px ${ink}22` }}
    >
      <span
        className="h-[3px] w-[3px] rounded-full"
        style={{ background: ink }}
      />
    </span>
  );
}

/** Paper stock only. Light or dark is its own button in the rail. */
export default function ThemePicker({
  align = "right",
}: {
  align?: "left" | "right";
}) {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => SERVER_SNAPSHOT,
  );
  const [mode, palette, resolved] = snapshot.split("|") as [
    ThemeMode,
    PaletteId,
    "light" | "dark",
  ];
  const dark = resolved === "dark";

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const current = PALETTES.find((p) => p.id === palette) ?? PALETTES[0];

  // Dismissal, matching the filter popover: pointer outside or Escape.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-label={`Paper: ${current.label}`}
        title={`Paper: ${current.label}`}
        className={`flex h-7 shrink-0 items-center gap-1 rounded-full border pl-1 pr-1.5 transition-colors ${
          open
            ? "border-iris bg-iris-soft text-iris"
            : "border-line-strong bg-surface-3 text-ink-faint hover:border-iris hover:text-ink"
        }`}
      >
        <StockChip palette={current} dark={dark} className="h-5 w-5" />
        <svg viewBox="0 0 10 10" className="h-2 w-2" aria-hidden="true">
          <path
            d="M2 4l3 3 3-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Paper"
          className={`absolute z-50 mt-1.5 w-52 rounded-xl border border-line bg-surface p-1.5 ${
            align === "right" ? "right-0" : "left-0"
          }`}
          style={{ boxShadow: "0 10px 30px -12px rgb(0 0 0 / 0.35)" }}
        >
          {PALETTES.map((entry) => {
            const active = entry.id === palette;
            return (
              <button
                key={entry.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  applyTheme(mode, entry.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2 ${
                  active ? "bg-surface-2" : ""
                }`}
              >
                <StockChip
                  palette={entry}
                  dark={dark}
                  className="h-6 w-6 self-start"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-[0.8rem] ${
                      active ? "text-iris" : "text-ink"
                    }`}
                  >
                    {entry.label}
                  </span>
                  <span className="block truncate text-[0.68rem] text-ink-faint">
                    {entry.note}
                  </span>
                </span>
                {active && (
                  <span className="font-data text-[0.66rem] text-iris">✓</span>
                )}
              </button>
            );
          })}

          {/* The light/dark button sets an explicit mode, so this is the way
              back to following the OS. */}
          {mode !== "system" && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                applyTheme("system", palette);
                setOpen(false);
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-line px-2 pb-1 pt-2 text-left text-[0.74rem] text-ink-faint transition-colors hover:text-ink"
            >
              Match system light or dark
            </button>
          )}
        </div>
      )}
    </div>
  );
}
