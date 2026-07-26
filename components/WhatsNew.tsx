"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CHANGELOG, VERSION, type ChangelogEntry } from "@/lib/VERSION";

/**
 * The changelog, on the one screen someone opens without wanting anything from
 * it. Capture is where a session starts, so it is where "something changed" can
 * be said without interrupting.
 *
 * Drawn as a centred dialog rather than the phone's bottom sheet. A sheet is for
 * a decision — a list of options acted on and dismissed. This is a page of
 * prose to read, and reading wants the middle of the screen and the height to
 * scroll in, at every width.
 */

const SECTIONS: { key: keyof ChangelogEntry; label: string; tone: string }[] = [
  { key: "added", label: "Added", tone: "mint" },
  { key: "changed", label: "Changed", tone: "sky" },
  { key: "fixed", label: "Fixed", tone: "amber" },
  { key: "removed", label: "Removed", tone: "blush" },
];

/** `"v0.4.6-alpha (26.07.26)"` → the number and the day, drawn separately. */
function split(release: string): { version: string; date: string | null } {
  const match = release.match(/^(\S+)\s*\((.+)\)\s*$/);
  return match
    ? { version: match[1], date: match[2] }
    : { version: release, date: null };
}

export default function WhatsNew() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="shrink-0 font-data text-[0.68rem] text-ink-faint transition-colors hover:text-ink max-lg:py-1"
      >
        What&apos;s new
      </button>
      {open && <Panel onClose={() => setOpen(false)} />}
    </>
  );
}

function Panel({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const releases = Object.keys(CHANGELOG);
  const [current, ...earlier] = releases;

  useEffect(() => {
    returnTo.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      // Nothing behind the panel is reachable while it is up.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnTo.current?.focus();
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-ink/25 backdrop-blur-[2px] motion-safe:animate-[flux-fade_160ms_ease-out]"
      />

      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-[var(--shadow-window)] motion-safe:animate-[flux-unfold_160ms_ease-out]"
      >
        <header className="flex shrink-0 items-start justify-between gap-5 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <p className="font-data text-[0.65rem] uppercase tracking-[0.16em] text-iris">
              Changelog
            </p>
            <h2
              id={titleId}
              className="mt-1 font-hand text-[1.55rem] leading-none text-ink"
            >
              What&apos;s new
            </h2>
            <p className="mt-2 text-[0.8rem] leading-relaxed text-ink-soft">
              You are on{" "}
              <span className="font-data text-[0.76rem] text-ink">{VERSION}</span>.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-line-strong px-3 py-1.5 font-data text-[0.68rem] text-ink-soft transition-colors hover:border-iris hover:text-ink"
          >
            Esc <X className="inline h-3 w-3" aria-hidden="true" />
            <span className="sr-only">Close what&apos;s new</span>
          </button>
        </header>

        <div className="flux-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <Release release={current} entry={CHANGELOG[current]} latest />

          {earlier.length > 0 && (
            <>
              <p className="mb-4 mt-7 flex items-center gap-3 font-data text-[0.62rem] uppercase tracking-[0.14em] text-ink-faint">
                Earlier
                <span aria-hidden="true" className="h-px flex-1 bg-line" />
              </p>
              <div className="flex flex-col gap-7">
                {earlier.map((release) => (
                  <Release
                    key={release}
                    release={release}
                    entry={CHANGELOG[release]}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}

/** One release: what it is called, when it landed, and what it did. */
function Release({
  release,
  entry,
  latest = false,
}: {
  release: string;
  entry: ChangelogEntry;
  latest?: boolean;
}) {
  const { version, date } = split(release);

  return (
    <article>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h3
          className={`font-hand leading-none text-ink ${
            latest ? "text-[1.3rem]" : "text-[1.05rem]"
          }`}
        >
          {version}
        </h3>
        {latest && (
          <span className="rounded-md bg-iris-soft px-2 py-0.5 font-data text-[0.6rem] uppercase tracking-[0.1em] text-iris">
            current
          </span>
        )}
        {date && (
          <span className="font-data text-[0.64rem] text-ink-faint">{date}</span>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-3.5">
        {SECTIONS.map(({ key, label, tone }) => {
          const lines = entry[key];
          if (!lines?.length) return null;
          return (
            <section key={key}>
              <h4 className="flex items-center gap-1.5 font-data text-[0.6rem] uppercase tracking-[0.13em]">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: `var(--${tone})` }}
                />
                <span style={{ color: `var(--${tone})` }}>{label}</span>
              </h4>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {lines.map((line) => (
                  <li
                    key={line}
                    className="flex gap-2 text-[0.83rem] leading-relaxed text-ink-soft"
                  >
                    <span
                      aria-hidden="true"
                      className="select-none text-ink-faint"
                    >
                      ·
                    </span>
                    <span className="min-w-0 flex-1">
                      <Inline text={line} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </article>
  );
}

/**
 * The inline markdown a changelog line is allowed to use. Deliberately not a
 * markdown library: one line of prose needs code spans, bold and italic, and a
 * parser for the rest would be a dependency in exchange for syntax nobody
 * writing this file is meant to reach for.
 */
const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(INLINE).map((part, index) => {
        if (part.startsWith("`")) {
          return (
            <code
              key={index}
              className="rounded bg-surface-3 px-1 py-0.5 font-data text-[0.75rem] text-ink"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith("**")) {
          return (
            <strong key={index} className="font-semibold text-ink">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("*")) {
          return (
            <em key={index} className="italic">
              {part.slice(1, -1)}
            </em>
          );
        }
        return part;
      })}
    </>
  );
}
