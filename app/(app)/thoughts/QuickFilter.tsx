"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Caret } from "@/components/Chips";
import Sheet from "@/components/Sheet";
import { useIsCompact } from "@/lib/breakpoint";

export interface FilterOption {
  value: string;
  label: string;
  /** Palette token for the leading dot, when the option has a colour of its
   *  own — a tag, say. */
  tone?: string;
  count?: number;
}

/**
 * One popover per thing you might narrow by, holding as many answers as you
 * want at once. The old screen allowed a single tag and made you reload the
 * page to change it; picking three tags is now three clicks in one place, and
 * the list under it never navigates.
 *
 * Below the desktop breakpoint the same list arrives as a sheet instead: a
 * 208px panel pinned to one edge is most of a phone's width, badly placed, and
 * it clips off the side as soon as the trigger is anywhere but the left.
 */
export default function QuickFilter({
  label,
  options,
  selected,
  onToggle,
  onClear,
  single = false,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  single?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const compact = useIsCompact();

  // The sheet dismisses itself — pointer-outside belongs to the popover only.
  useEffect(() => {
    if (!open || compact) return;
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
  }, [open, compact]);

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? options.filter((option) => option.label.toLowerCase().includes(needle))
    : options;

  const active = selected.length > 0;

  /** One list, two containers. The options and what they do are identical —
   *  only the room they are given differs. */
  function list(inSheet: boolean) {
    return (
      <>
        {options.length > 8 && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find…"
            aria-label={`Find ${label}`}
            autoFocus={!inSheet}
            className={
              inSheet
                ? "input mb-2"
                : "input mb-1 h-7 py-0 lg:text-[0.76rem]"
            }
          />
        )}

        <div
          className={
            inSheet ? "flex flex-col" : "flux-scroll max-h-56 overflow-y-auto"
          }
        >
          {shown.map((option) => {
            const on = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemcheckbox"
                aria-checked={on}
                onClick={() => {
                  onToggle(option.value);
                  if (single) setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg text-left transition-colors hover:bg-surface-2 ${
                  inSheet
                    ? "tap px-2.5 text-[0.95rem]"
                    : "px-2 py-1.5 text-[0.8rem]"
                } ${on ? "text-iris" : "text-ink"}`}
              >
                {option.tone && (
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: `var(--${option.tone})` }}
                  />
                )}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {typeof option.count === "number" && (
                  <span className="font-data text-[0.64rem] text-ink-faint">
                    {option.count}
                  </span>
                )}
                {on && <span className="font-data text-[0.66rem]">✓</span>}
              </button>
            );
          })}
          {shown.length === 0 && (
            <p
              className={`text-ink-faint ${
                inSheet ? "px-2.5 py-3 text-[0.9rem]" : "px-2 py-2 text-[0.76rem]"
              }`}
            >
              Nothing matches.
            </p>
          )}
        </div>
      </>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup={compact ? "dialog" : "menu"}
        aria-controls={open && !compact ? menuId : undefined}
        disabled={options.length === 0}
        className={`flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[0.76rem] transition-colors disabled:opacity-35 max-lg:h-11 max-lg:px-4 max-lg:text-[0.85rem] ${
          active || open
            ? "border-iris bg-iris-soft text-iris"
            : "border-line-strong text-ink-soft hover:border-iris hover:text-ink"
        }`}
      >
        {label}
        {active && (
          <span className="font-data text-[0.66rem] leading-none max-lg:text-[0.78rem]">
            {selected.length}
          </span>
        )}
        <Caret open={open} className="opacity-60" />
      </button>

      {open && !compact && (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 z-50 mt-1.5 w-52 rounded-xl border border-line bg-surface p-1"
          style={{ boxShadow: "0 14px 34px -16px rgb(0 0 0 / 0.4)" }}
        >
          {list(false)}

          {active && (
            <button
              type="button"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="mt-1 w-full rounded-lg px-2 py-1 text-left font-data text-[0.66rem] text-ink-faint transition-colors hover:text-ink"
            >
              clear
            </button>
          )}
        </div>
      )}

      <Sheet
        open={open && compact}
        onClose={() => setOpen(false)}
        title={label}
        footer={
          active ? (
            <button
              type="button"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="tap w-full rounded-xl text-[0.9rem] text-ink-soft transition-colors hover:text-ink"
            >
              Clear {label.toLowerCase()}
            </button>
          ) : undefined
        }
      >
        {list(true)}
      </Sheet>
    </div>
  );
}
