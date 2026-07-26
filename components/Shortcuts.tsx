"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const GO_TO: Record<string, string> = {
  d: "/",
  c: "/",
  t: "/thoughts",
  r: "/thoughts?pane=review",
  a: "/ask",
  g: "/tags",
  s: "/settings",
};

/** Every distinct place a shortcut can land, `/` and `/thoughts` counted once. */
const PREFETCH = [...new Set(Object.values(GO_TO))];

/**
 * What `<Link>` prefetches with: the whole route when it is static, the shell
 * down to its `loading.tsx` when it is dynamic. `prefetch` requires the kind
 * but Next.js exports its enum only from an internal path, so the value is
 * spelled out and given that type through the router's own signature.
 */
const AUTO = "auto" as NonNullable<
  Parameters<ReturnType<typeof useRouter>["prefetch"]>[1]
>["kind"];

const DESTINATIONS = [
  { key: "d", label: "Dashboard" },
  { key: "c", label: "Capture" },
  { key: "t", label: "Thoughts" },
  { key: "r", label: "Review queue" },
  { key: "a", label: "Ask Flux" },
  { key: "g", label: "Tags & people" },
  { key: "s", label: "Settings" },
];

/**
 * `/` navigates and then focuses, and the box it focuses does not exist yet —
 * Thoughts streams its skeleton first and the real input lands with the data.
 * A single delay has to guess how long that takes, so this watches for it
 * instead and gives up after two seconds rather than focusing something the
 * user has since navigated away from.
 */
function focusSearch(): void {
  const deadline = Date.now() + 2000;
  const look = () => {
    const input = document.querySelector<HTMLInputElement>(
      'input[placeholder^="Search"]'
    );
    if (input) {
      input.focus();
      return;
    }
    if (Date.now() < deadline) window.requestAnimationFrame(look);
  };
  window.requestAnimationFrame(look);
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

/**
 * Vim-style leader: `g` then a letter. Plus `?` for this guide, `c` to
 * capture, and `/` to search. Nothing fires while the cursor is in a field —
 * capture-first means typing must always win.
 */
export default function Shortcuts() {
  const router = useRouter();
  const pending = useRef<number | null>(null);
  const leader = useRef(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // A shortcut has no link to hover and no viewport to enter, so nothing warms
  // these routes the way `<Link>` warms the rail's. Without this the keystroke
  // is where the request starts, and `g t` waits on a round trip that a click
  // on "Thoughts" had already made — which is exactly backwards. Every one of
  // these is a dynamic route, so what arrives is the shell down to its
  // `loading.tsx` and not the data behind it: seven cheap payloads, held for
  // the whole session and re-warmed when Next.js says they went stale.
  useEffect(() => {
    let cancelled = false;
    for (const href of PREFETCH) {
      const warm = () => {
        if (!cancelled) router.prefetch(href, { kind: AUTO, onInvalidate: warm });
      };
      warm();
    }
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;

      const key = event.key.toLowerCase();

      if (event.key === "?") {
        event.preventDefault();
        leader.current = false;
        if (pending.current) window.clearTimeout(pending.current);
        setShortcutsOpen((open) => !open);
        return;
      }

      if (event.key === "Escape" && shortcutsOpen) {
        event.preventDefault();
        setShortcutsOpen(false);
        return;
      }

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
        focusSearch();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (pending.current) window.clearTimeout(pending.current);
    };
  }, [router, shortcutsOpen]);

  useEffect(() => {
    if (shortcutsOpen) closeButtonRef.current?.focus();
  }, [shortcutsOpen]);

  return (
    shortcutsOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4 backdrop-blur-[2px]"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShortcutsOpen(false);
        }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcuts-title"
          className="w-full max-w-2xl overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-[var(--shadow-window)]"
          onKeyDown={(event) => {
            // The close control is the dialog's sole tab stop, so tabbing
            // cannot drift back into the app behind this modal.
            if (event.key === "Tab") {
              event.preventDefault();
              closeButtonRef.current?.focus();
            }
          }}
        >
          <header className="flex items-start justify-between gap-5 border-b border-line px-5 py-4 sm:px-6">
            <div>
              <p className="font-data text-[0.65rem] uppercase tracking-[0.16em] text-iris">
                Keyboard guide
              </p>
              <h2
                id="shortcuts-title"
                className="mt-1 font-hand text-[1.55rem] leading-none text-ink"
              >
                Keep your hands moving
              </h2>
              <p className="mt-2 max-w-[44ch] text-[0.8rem] leading-relaxed text-ink-soft">
                Shortcuts work whenever you are not writing in a field.
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setShortcutsOpen(false)}
              className="shrink-0 rounded-full border border-line-strong px-3 py-1.5 font-data text-[0.68rem] text-ink-soft transition-colors hover:border-iris hover:text-ink"
            >
              Esc <span aria-hidden="true">×</span>
              <span className="sr-only">Close shortcuts</span>
            </button>
          </header>

          <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <div className="px-5 py-5 sm:px-6">
              <p className="font-data text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">
                Quick actions
              </p>
              <dl className="mt-3 space-y-1">
                <ShortcutRow keys={["?"]} label="Show this guide" />
                <ShortcutRow keys={["c"]} label="Capture a thought" />
                <ShortcutRow keys={["/"]} label="Search thoughts" />
              </dl>
            </div>

            <div className="px-5 py-5 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <p className="font-data text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">
                  Go anywhere
                </p>
                <span className="rounded-md bg-iris-soft px-2 py-1 font-data text-[0.63rem] text-iris">
                  g then a key
                </span>
              </div>
              <dl className="mt-3 space-y-1">
                {DESTINATIONS.map((destination) => (
                  <ShortcutRow
                    key={destination.key}
                    keys={["g", destination.key]}
                    label={destination.label}
                  />
                ))}
              </dl>
            </div>
          </div>

          <footer className="border-t border-line bg-surface-2 px-5 py-3 text-[0.73rem] text-ink-soft sm:px-6">
            Press <KeyCap>?</KeyCap> again or <KeyCap>Esc</KeyCap> to close.
          </footer>
        </section>
      </div>
    )
  );
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-4 rounded-lg px-2 py-1 text-[0.82rem] transition-colors hover:bg-surface-2">
      <dt className="text-ink">{label}</dt>
      <dd className="flex shrink-0 items-center gap-1">
        {keys.map((key, index) => (
          <KeyCap key={`${key}-${index}`}>{key}</KeyCap>
        ))}
      </dd>
    </div>
  );
}

function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="min-w-6 rounded-md border border-line-strong bg-surface px-1.5 py-0.5 text-center font-data text-[0.66rem] text-ink-soft shadow-[0_1px_0_var(--line)]">
      {children}
    </kbd>
  );
}
