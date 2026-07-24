"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const GO_TO: Record<string, string> = {
  d: "/",
  c: "/",
  t: "/thoughts",
  r: "/review",
  a: "/ask",
  g: "/tags",
  s: "/settings",
};

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

/**
 * Vim-style leader: `g` then a letter. Plus `c` to capture and `/` to search.
 * Nothing fires while the cursor is in a field — capture-first means typing
 * must always win.
 */
export default function Shortcuts() {
  const router = useRouter();
  const pending = useRef<number | null>(null);
  const leader = useRef(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;

      const key = event.key.toLowerCase();

      if (leader.current) {
        leader.current = false;
        if (pending.current) window.clearTimeout(pending.current);
        const href = GO_TO[key];
        if (href) {
          event.preventDefault();
          router.push(href);
        }
        return;
      }

      if (key === "g") {
        leader.current = true;
        pending.current = window.setTimeout(() => {
          leader.current = false;
        }, 1200);
        return;
      }

      if (key === "c") {
        event.preventDefault();
        router.push("/");
        return;
      }

      if (key === "/") {
        event.preventDefault();
        router.push("/thoughts");
        // The search box on that page autofocuses when asked to.
        window.setTimeout(() => {
          document
            .querySelector<HTMLInputElement>('input[placeholder^="Search"]')
            ?.focus();
        }, 350);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (pending.current) window.clearTimeout(pending.current);
    };
  }, [router]);

  return null;
}
