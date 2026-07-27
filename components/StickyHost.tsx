"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { stickyStore } from "@/lib/sticky-store";
import StickyNote from "./StickyNote";

/**
 * Owns the note window, wherever you are in the app.
 *
 * Chrome's document picture-in-picture gives what a popup cannot: a small
 * always-on-top frame with a single slim bar, which is the difference between a
 * note stuck to the monitor and one more window lost behind the browser. What
 * it gives back is a bare document — no stylesheet, no fonts, no theme — so
 * everything the page already has is carried across by hand, once, here.
 *
 * Anything without the API gets the popup at `/sticky` instead. That is a real
 * page rather than a degraded one; it simply doesn't float.
 */

interface PictureInPictureApi {
  requestWindow(options?: {
    width?: number;
    height?: number;
    disallowReturnToOpener?: boolean;
    preferInitialWindowPlacement?: boolean;
  }): Promise<Window>;
  window: Window | null;
}

declare global {
  interface Window {
    documentPictureInPicture?: PictureInPictureApi;
  }
}

const WIDTH = 340;
const HEIGHT = 440;

/** What the note needs from the page in order to look like the page: the type
 *  scale, the palette, the light-or-dark decision, and the fonts they are all
 *  written in. */
const THEME_ATTRIBUTES = ["class", "data-palette", "data-theme-mode", "style"];

export default function StickyHost({ userId }: { userId: string }) {
  const [pip, setPip] = useState<Window | null>(null);
  const opening = useRef(false);

  const open = useCallback(async () => {
    const api = window.documentPictureInPicture;

    if (!api) {
      openPopup();
      return;
    }

    // Already up: raise it rather than dealing a second note onto the pile.
    if (api.window && !api.window.closed) {
      api.window.focus();
      return;
    }
    if (opening.current) return;
    opening.current = true;

    try {
      const next = await api.requestWindow({
        width: WIDTH,
        height: HEIGHT,
        disallowReturnToOpener: true,
      });
      adopt(next);
      next.addEventListener("pagehide", () => setPip(null), { once: true });
      setPip(next);
    } catch {
      // Denied, or no gesture left to spend. The popup still works.
      openPopup();
    } finally {
      opening.current = false;
    }
  }, []);

  useEffect(() => stickyStore.subscribe(() => void open()), [open]);

  // Closing the tab that owns it should not leave a note floating over nothing.
  useEffect(() => {
    if (!pip) return;
    const close = () => pip.close();
    window.addEventListener("pagehide", close);
    return () => window.removeEventListener("pagehide", close);
  }, [pip]);

  // A theme changed in the main window is a theme changed in this one. The
  // attributes are the whole of the decision, so watching them is the whole of
  // the job.
  useEffect(() => {
    if (!pip) return;
    const source = document.documentElement;
    const target = pip.document.documentElement;
    const sync = () => copyThemeAttributes(source, target);
    const observer = new MutationObserver(sync);
    observer.observe(source, {
      attributes: true,
      attributeFilter: THEME_ATTRIBUTES,
    });
    return () => observer.disconnect();
  }, [pip]);

  if (!pip) return null;
  return createPortal(<StickyNote userId={userId} />, pip.document.body);
}

function openPopup() {
  const left = Math.max(0, window.screen.availWidth - 380 - 32);
  window
    .open(
      "/sticky",
      "flux-sticky",
      `popup=yes,width=380,height=540,left=${left},top=96`
    )
    ?.focus();
}

function copyThemeAttributes(source: Element, target: Element) {
  for (const name of THEME_ATTRIBUTES) {
    const value = source.getAttribute(name);
    if (value === null) target.removeAttribute(name);
    else target.setAttribute(name, value);
  }
}

/**
 * Moves the page's styling into the new document.
 *
 * Same-origin sheets can be read rule by rule and inlined, which is what dev
 * builds and anything injected at runtime need. A sheet that refuses to be read
 * is linked by URL instead, so the one case this cannot handle — a cross-origin
 * stylesheet with no href — is a case that does not exist here.
 */
function adopt(target: Window) {
  copyThemeAttributes(document.documentElement, target.document.documentElement);

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join("");
      const style = target.document.createElement("style");
      style.textContent = css;
      target.document.head.appendChild(style);
    } catch {
      if (!sheet.href) continue;
      const link = target.document.createElement("link");
      link.rel = "stylesheet";
      link.href = sheet.href;
      target.document.head.appendChild(link);
    }
  }

  // The page's own body rules are a background image and a font stack; at
  // 340px the washes are just noise, so the note keeps the paper and drops the
  // rest.
  target.document.body.style.margin = "0";
  target.document.body.style.background = "var(--paper)";
  target.document.body.style.fontFamily = "var(--font-ui)";
}
