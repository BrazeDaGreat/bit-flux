"use client";

import { useEffect, useSyncExternalStore } from "react";

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
        <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
          {dark ? (
            <path
              d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z"
              fill="var(--iris)"
            />
          ) : (
            <>
              <circle cx="8" cy="8" r="3" fill="var(--amber)" />
              <g stroke="var(--amber)" strokeWidth="1.4" strokeLinecap="round">
                <path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2" />
              </g>
            </>
          )}
        </svg>
      </span>
    </button>
  );
}
