"use client";

import { useSyncExternalStore } from "react";

import {
  DEFAULT_MODE,
  DEFAULT_PALETTE,
  isMode,
  isPalette,
  type PaletteId,
  type ThemeMode,
} from "@/lib/theme";

/**
 * What the document currently says the theme is.
 *
 * The <html> attributes are the source of truth — the inline script in the root
 * layout sets them before first paint — so this observes them rather than
 * keeping a second copy that could disagree.
 *
 * The two controls in the rail each grew their own copy of this before there
 * was anywhere shared to put it. They are pointer-first components inside the
 * desktop freeze, so they keep theirs until they are next touched; anything new
 * uses this.
 */
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

export interface ThemeState {
  mode: ThemeMode;
  palette: PaletteId;
  dark: boolean;
}

export function useTheme(): ThemeState {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
  const [mode, palette, resolved] = snapshot.split("|") as [
    ThemeMode,
    PaletteId,
    "light" | "dark",
  ];
  return { mode, palette, dark: resolved === "dark" };
}
