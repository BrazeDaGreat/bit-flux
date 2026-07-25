/**
 * Theme state lives on <html>: the `dark` class drives Tailwind's dark variant,
 * `data-palette` picks the paper stock, and `data-theme-mode` records which of
 * light/dark/system the user actually chose — the class alone can't say whether
 * dark was picked or inherited from the OS.
 *
 * No "use client" here: these are plain constants, so the root layout's inline
 * script and the client picker can share one definition.
 */

export type ThemeMode = "light" | "dark" | "system";
export type PaletteId = "lilac" | "mist" | "blossom" | "meadow" | "sand" | "frost";

/** Existing key, existing values — a stored "light"/"dark" keeps working, and
 *  "system" is what an absent key used to mean implicitly. */
export const MODE_KEY = "flux-theme";
export const PALETTE_KEY = "flux-palette";

export const DEFAULT_MODE: ThemeMode = "system";
export const DEFAULT_PALETTE: PaletteId = "lilac";

export interface Palette {
  id: PaletteId;
  label: string;
  /** One line on what the stock is for, shown under the name in the picker. */
  note: string;
  /** Paper and ink of each mode, mirroring globals.css. Duplicated on purpose:
   *  the picker draws its chips before the palette is applied, so it can't read
   *  the values off the document. Keep both sides in step. */
  swatch: {
    light: { paper: string; ink: string };
    dark: { paper: string; ink: string };
  };
  /** The palette's hue at usable saturation. The papers are near-white and
   *  near-black, so they carry too little chroma to colour an icon with; this
   *  is the same hue pushed to a mid-tone the picker can tint glyphs with. */
  tint: string;
}

export const PALETTES: readonly Palette[] = [
  {
    id: "lilac",
    label: "Lilac",
    note: "Violet stock, the original",
    swatch: {
      light: { paper: "#ece8f6", ink: "#26232e" },
      dark: { paper: "#14121a", ink: "#eeeaf6" },
    },
    tint: "#8b6fe0",
  },
  {
    id: "mist",
    label: "Mist",
    note: "Cool slate blue",
    swatch: {
      light: { paper: "#e5ebf7", ink: "#21262f" },
      dark: { paper: "#10131b", ink: "#e9edf6" },
    },
    tint: "#5b7fc4",
  },
  {
    id: "blossom",
    label: "Blossom",
    note: "Dusty rose",
    swatch: {
      light: { paper: "#f6e8ee", ink: "#2e2127" },
      dark: { paper: "#191115", ink: "#f7e9f0" },
    },
    tint: "#d16a92",
  },
  {
    id: "meadow",
    label: "Meadow",
    note: "Pale sage green",
    swatch: {
      light: { paper: "#e7f0e6", ink: "#222a22" },
      dark: { paper: "#101410", ink: "#eaf2e9" },
    },
    tint: "#5c9a5f",
  },
  {
    id: "sand",
    label: "Sand",
    note: "Warm clay",
    swatch: {
      light: { paper: "#f7e9dc", ink: "#2e2620" },
      dark: { paper: "#181310", ink: "#f6ece2" },
    },
    tint: "#c08144",
  },
  {
    id: "frost",
    label: "Frost",
    note: "Pale aqua",
    swatch: {
      light: { paper: "#e2f0f2", ink: "#1f2b2d" },
      dark: { paper: "#0e1416", ink: "#e6f2f4" },
    },
    tint: "#3fa3ad",
  },
] as const;

export function isPalette(value: string | null): value is PaletteId {
  return PALETTES.some((p) => p.id === value);
}

export function isMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

export function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveDark(mode: ThemeMode): boolean {
  return mode === "dark" || (mode === "system" && prefersDark());
}

/** Writes the chosen theme to <html> and to storage. */
export function applyTheme(mode: ThemeMode, palette: PaletteId) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolveDark(mode));
  root.setAttribute("data-theme-mode", mode);
  root.setAttribute("data-palette", palette);
  try {
    localStorage.setItem(MODE_KEY, mode);
    localStorage.setItem(PALETTE_KEY, palette);
  } catch {
    // Private-browsing storage refusal: the theme still applies for this visit.
  }
}

/** Runs synchronously during parse, so the window never paints in the wrong
 *  theme and then swaps. Inlined by the root layout; kept as a string literal
 *  rather than a stringified function so bundling can't rename anything. */
export const themeScript = `(function(){try{
var r=document.documentElement;
var m=localStorage.getItem("${MODE_KEY}");
if(m!=="light"&&m!=="dark"&&m!=="system")m="${DEFAULT_MODE}";
var p=localStorage.getItem("${PALETTE_KEY}");
if(${JSON.stringify(PALETTES.map((entry) => entry.id))}.indexOf(p)<0)p="${DEFAULT_PALETTE}";
r.classList.toggle("dark",m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches));
r.setAttribute("data-theme-mode",m);
r.setAttribute("data-palette",p);
}catch(e){}})();`;
