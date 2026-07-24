"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface FilterOption {
  value: string;
  label: string;
  /** Palette token for the leading dot, when the option has a colour of its
   *  own (for example, a tag). */
  tone?: string;
}

export interface FilterGroup {
  key: string;
  label: string;
  options: FilterOption[];
  /** Currently applied value in this group, if any. */
  value?: string;
  /** Only one option can be chosen per group; picking the active one clears
   *  it. */
  single?: boolean;
}

export function SlidersIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" fill="none">
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M2 4.5h4M9.5 4.5H14M2 11.5h6.5M12 11.5H14" />
      </g>
      <circle cx="7.75" cy="4.5" r="1.75" fill="currentColor" />
      <circle cx="10.25" cy="11.5" r="1.75" fill="currentColor" />
    </svg>
  );
}

/**
 * A custom popover rather than a row of native selects: five dropdowns
 * sitting side by side is exactly the clutter this screen is trying to
 * avoid. One control, opened only when wanted, and what you picked lives as
 * chips underneath instead of hiding inside collapsed selects.
 */
export default function FilterMenu({
  groups,
  onPick,
  label = "Filter",
  align = "right",
}: {
  groups: FilterGroup[];
  onPick: (groupKey: string, value: string | null) => void;
  label?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setSection(null);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const applied = groups.filter((g) => g.value).length;
  const current = groups.find((g) => g.key === section);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setSection(null);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title={label}
        className={`flex h-9 items-center gap-1.5 rounded-full border px-3 transition-colors ${
          applied > 0 || open
            ? "border-iris bg-iris-soft text-iris"
            : "border-line-strong text-ink-soft hover:border-iris hover:text-ink"
        }`}
      >
        <SlidersIcon className="h-3.5 w-3.5" />
        {applied > 0 && (
          <span className="font-data text-[0.68rem] leading-none">{applied}</span>
        )}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className={`absolute z-50 mt-1.5 max-h-72 w-56 overflow-y-auto rounded-xl border border-line bg-surface p-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
          style={{ boxShadow: "0 10px 30px -12px rgb(0 0 0 / 0.35)" }}
        >
          {current ? (
            <>
              <button
                type="button"
                onClick={() => setSection(null)}
                className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left font-data text-[0.66rem] uppercase tracking-[0.12em] text-ink-faint hover:bg-surface-2"
              >
                ← {current.label}
              </button>
              {current.options.map((option) => {
                const active = current.value === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onPick(current.key, active ? null : option.value);
                      setOpen(false);
                      setSection(null);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[0.8rem] transition-colors hover:bg-surface-2 ${
                      active ? "text-iris" : "text-ink"
                    }`}
                  >
                    {option.tone && (
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: `var(--${option.tone})` }}
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {active && <span className="font-data text-[0.66rem]">✓</span>}
                  </button>
                );
              })}
            </>
          ) : (
            groups.map((group) => (
              <button
                key={group.key}
                type="button"
                role="menuitem"
                onClick={() => setSection(group.key)}
                disabled={group.options.length === 0}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[0.82rem] text-ink transition-colors hover:bg-surface-2 disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <span className="min-w-0 flex-1">{group.label}</span>
                <span className="font-data text-[0.66rem] text-ink-faint">
                  {group.value
                    ? (group.options.find((o) => o.value === group.value)?.label ??
                      "1")
                    : "›"}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** What's applied, shown as removable chips rather than hidden in controls. */
export function FilterChips({
  groups,
  onRemove,
  onClear,
}: {
  groups: FilterGroup[];
  onRemove: (groupKey: string) => void;
  onClear?: () => void;
}) {
  const applied = groups.filter((g) => g.value);
  if (applied.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {applied.map((group) => {
        const option = group.options.find((o) => o.value === group.value);
        return (
          <button
            key={group.key}
            type="button"
            onClick={() => onRemove(group.key)}
            className="group flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 py-1 pl-2.5 pr-2 text-[0.74rem] text-ink-soft transition-colors hover:border-blush hover:text-ink"
          >
            {option?.tone && (
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: `var(--${option.tone})` }}
              />
            )}
            <span className="font-data text-[0.62rem] uppercase tracking-wide text-ink-faint">
              {group.label}
            </span>
            <span>{option?.label ?? group.value}</span>
            <span
              aria-hidden="true"
              className="text-ink-faint transition-colors group-hover:text-blush"
            >
              ×
            </span>
            <span className="sr-only">Remove filter</span>
          </button>
        );
      })}
      {applied.length > 1 && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="px-1 text-[0.74rem] text-ink-faint hover:text-ink"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
