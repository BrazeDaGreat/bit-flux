"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import {
  Check,
  ChevronDown,
  Cloud,
  Flower2,
  Heart,
  Leaf,
  Monitor,
  Snowflake,
  Sun,
  type LucideIcon,
} from "lucide-react";

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

const PALETTE_ICONS: Record<PaletteId, LucideIcon> = {
  lilac: Flower2,
  mist: Cloud,
  blossom: Heart,
  meadow: Leaf,
  sand: Sun,
  frost: Snowflake,
};

function PaletteIcon({
  palette,
  dark,
  className,
}: {
  palette: (typeof PALETTES)[number];
  dark: boolean;
  className: string;
}) {
  const Icon = PALETTE_ICONS[palette.id];
  // The palette's own hue, nudged toward the far end of the surface so it stays
  // legible: lifted on dark paper, deepened on light.
  const color = dark
    ? `color-mix(in srgb, ${palette.tint} 78%, white)`
    : `color-mix(in srgb, ${palette.tint} 82%, black)`;
  // Snowflake is all strokes with no interior, so filling it does nothing —
  // it needs the weight in the line instead.
  const hollow = Icon === Snowflake;
  return (
    <Icon
      className={className}
      style={{ color, fill: hollow ? "none" : color }}
      strokeWidth={hollow ? 2.25 : 1.5}
      aria-hidden="true"
    />
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
        <PaletteIcon palette={current} dark={dark} className="h-4 w-4" />
        <ChevronDown className="h-3 w-3" aria-hidden="true" />
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
                <PaletteIcon
                  palette={entry}
                  dark={dark}
                  className="mt-0.5 h-5 w-5 shrink-0"
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
                {active && <Check className="h-3.5 w-3.5 shrink-0 text-iris" aria-hidden="true" />}
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
              <Monitor className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Match system light or dark
            </button>
          )}
        </div>
      )}
    </div>
  );
}
