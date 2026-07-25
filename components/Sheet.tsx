"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * The one answer for every decision that needs more room than a thumb-sized
 * screen can spare beside the thing it belongs to.
 *
 * A popover is a good control on a desktop: it opens beside its trigger, so the
 * thing it is about stays in view. On a phone there is no beside — a 300px
 * panel is the whole screen, badly placed. So below the desktop breakpoint the
 * same options arrive from the bottom instead, where the hand already is, and
 * leave the same way. Same options, same handlers, different arrival.
 *
 * Drawn as the window's own bottom edge rising: the rail's border and inset
 * highlight, the window's radius on the two corners that show.
 */
export default function Sheet({
  open,
  onClose,
  title,
  onBack,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Names what the sheet is for. Also labels it for a screen reader. */
  title: string;
  /** Set when the sheet is one step inside something — draws a way back
   *  instead of a title, the way the filter menu drills into a group. */
  onBack?: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    // Where focus came from, so closing puts it back on the control that
    // opened this rather than at the top of the page.
    returnTo.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the panel itself rather than its first control: a sheet of options
    // should be read before it is operated, and the first Tab still lands on
    // the first option.
    panelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      // Nothing behind a sheet is reachable while it is up.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
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
  }, [open, onClose]);

  // A sheet is opened by a tap, which cannot happen before hydration — so the
  // document check is a guard against a caller mounting one open on the
  // server, not a state machine that needs a render to settle.
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label={`Close ${title}`}
        onClick={onClose}
        className="absolute inset-0 h-full w-full touch-none bg-ink/25 backdrop-blur-[2px] motion-safe:animate-[flux-fade_160ms_ease-out]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-[var(--sheet-radius)] border-t border-line bg-surface outline-none motion-safe:animate-[flux-rise_160ms_ease-out]"
        style={{
          boxShadow: "var(--shadow-window), inset 0 1px 0 var(--rail-highlight)",
          paddingBottom: "var(--safe-bottom)",
        }}
      >
        <span
          aria-hidden="true"
          className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line-strong"
        />

        <div className="flex shrink-0 items-center gap-1 px-3 py-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="tap flex items-center gap-1.5 rounded-lg px-2 font-data text-[0.7rem] uppercase tracking-[0.12em] text-ink-faint transition-colors hover:text-ink"
            >
              ← <span id={titleId}>{title}</span>
            </button>
          ) : (
            <h2
              id={titleId}
              className="flex-1 px-2 font-data text-[0.7rem] uppercase tracking-[0.14em] text-ink-faint"
            >
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="tap ml-auto grid shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flux-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-line px-3 py-2">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
}

/**
 * A row inside a sheet. Full width, thumb-sized, and the same shape whether it
 * is a link, a toggle or a choice — so a sheet reads as one list rather than as
 * whatever each caller happened to build.
 */
export function SheetRow({
  onClick,
  selected = false,
  leading,
  trailing,
  children,
}: {
  onClick?: () => void;
  selected?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={onClick ? selected : undefined}
      className={`tap flex w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-[0.95rem] transition-colors hover:bg-surface-2 ${
        selected ? "text-iris" : "text-ink"
      }`}
    >
      {leading}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </button>
  );
}
