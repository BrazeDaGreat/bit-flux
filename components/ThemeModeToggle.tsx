"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

import { applyTheme, DEFAULT_MODE, DEFAULT_PALETTE, isMode, isPalette } from "@/lib/theme";

/** The <html> attributes are the source of truth — the inline script in the
 *  root layout sets them before first paint. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-palette", "data-theme-mode"],
  });
  return () => observer.disconnect();
}

/** One string, because useSyncExternalStore compares snapshots by identity. */
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

/** Light or dark, one press. Which paper stock is a separate control — this
 *  button answers a question you ask far more often. */
export default function ThemeModeToggle() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => SERVER_SNAPSHOT,
  );
  const [mode, palette, resolved] = snapshot.split("|");
  const dark = resolved === "dark";

  // On "System" the OS can change under us, so follow it while it's chosen.
  useEffect(() => {
    if (mode !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    function onChange() {
      document.documentElement.classList.toggle("dark", query.matches);
    }
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [mode]);

  return (
    <button
      type="button"
      onClick={() =>
        applyTheme(dark ? "light" : "dark", isPalette(palette) ? palette : DEFAULT_PALETTE)
      }
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      className="group relative h-7 w-12 shrink-0 rounded-full border border-line-strong bg-surface-3 transition-colors hover:border-iris"
    >
      <span
        className="absolute top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-surface shadow-sm transition-[left] duration-300 ease-out"
        style={{ left: dark ? "calc(100% - 1.375rem)" : "0.125rem" }}
      >
        {dark ? (
          <Moon className="h-3 w-3 text-iris" aria-hidden="true" />
        ) : (
          <Sun className="h-3 w-3 text-amber" aria-hidden="true" />
        )}
      </span>
    </button>
  );
}
