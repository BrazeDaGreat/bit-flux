"use client";

import { useState } from "react";

import Sheet, { SheetRow } from "@/components/Sheet";
import type { TagRecord } from "@/lib/types";
import { EMPTY_FILTERS, type Filters, type ViewMode, type WhenKey } from "./filters";
import { ViewIcon } from "./shared";
import { VIEWS, WHEN } from "./useThoughtsBrowser";

/**
 * Nine controls fit on a desktop toolbar. Three fit under a thumb.
 *
 * So on a phone the toolbar is search, Filter and View, and everything the
 * desktop spreads across the row lives inside the sheet one of those two
 * buttons opens: four decisions, one dismissal, and a count on the trigger so
 * what is hidden is never a surprise.
 */

const CHECK = (
  <span aria-hidden="true" className="font-data text-[0.8rem] text-iris">
    ✓
  </span>
);

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line py-1.5 first:border-t-0">
      <h3 className="px-2.5 py-1 font-data text-[0.7rem] uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </h3>
      {children}
    </section>
  );
}

export function FilterButton({
  filters,
  setFilters,
  tags,
  people,
  applied,
}: {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  tags: TagRecord[];
  people: string[];
  applied: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`tap flex shrink-0 items-center gap-1.5 rounded-full border px-4 text-[0.9rem] transition-colors ${
          applied > 0
            ? "border-iris bg-iris-soft text-iris"
            : "border-line-strong text-ink-soft"
        }`}
      >
        Filter
        {applied > 0 && (
          <span className="font-data text-[0.8rem] leading-none">{applied}</span>
        )}
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Filter"
        footer={
          applied > 0 ? (
            <button
              type="button"
              onClick={() => {
                setFilters((prev) => ({ ...EMPTY_FILTERS, query: prev.query }));
                setOpen(false);
              }}
              className="tap w-full rounded-xl text-[0.95rem] text-ink-soft"
            >
              Clear all filters
            </button>
          ) : undefined
        }
      >
        {tags.length > 0 && (
          <Section label="Tags">
            {tags.map((tag) => {
              const on = filters.tags.includes(tag.id);
              return (
                <SheetRow
                  key={tag.id}
                  selected={on}
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      tags: on
                        ? prev.tags.filter((id) => id !== tag.id)
                        : [...prev.tags, tag.id],
                    }))
                  }
                  leading={
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: `var(--${tag.color || "iris"})` }}
                    />
                  }
                  trailing={on ? CHECK : undefined}
                >
                  {tag.name}
                </SheetRow>
              );
            })}
          </Section>
        )}

        {people.length > 0 && (
          <Section label="People">
            {people.map((name) => {
              const on = filters.people.includes(name);
              return (
                <SheetRow
                  key={name}
                  selected={on}
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      people: on
                        ? prev.people.filter((value) => value !== name)
                        : [...prev.people, name],
                    }))
                  }
                  trailing={on ? CHECK : undefined}
                >
                  {name}
                </SheetRow>
              );
            })}
          </Section>
        )}

        <Section label="When">
          {WHEN.map((option) => {
            const on = filters.when === option.value;
            return (
              <SheetRow
                key={option.value}
                selected={on}
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    when: on ? null : (option.value as WhenKey),
                  }))
                }
                trailing={on ? CHECK : undefined}
              >
                {option.label}
              </SheetRow>
            );
          })}
        </Section>

        <Section label="Certainty">
          <SheetRow
            selected={filters.flagged}
            onClick={() =>
              setFilters((prev) => ({ ...prev, flagged: !prev.flagged }))
            }
            leading={
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full bg-amber"
              />
            }
            trailing={filters.flagged ? CHECK : undefined}
          >
            Only the ones the AI wasn&apos;t sure about
          </SheetRow>
        </Section>
      </Sheet>
    </>
  );
}

/** The desktop switch names its four shapes in a tooltip, which a thumb never
 *  sees. Here they are spelled out — four rows is cheap, a guessed icon is
 *  not. */
export function ViewButton({
  view,
  onPick,
}: {
  view: ViewMode;
  onPick: (view: ViewMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = VIEWS.find((option) => option.key === view);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`View: ${current?.label ?? "List"}`}
        className="tap grid shrink-0 place-items-center rounded-full border border-line-strong px-3 text-ink-soft"
      >
        <ViewIcon view={view} className="h-5 w-5" />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Show as">
        {VIEWS.map((option) => (
          <SheetRow
            key={option.key}
            selected={option.key === view}
            onClick={() => {
              onPick(option.key);
              setOpen(false);
            }}
            leading={<ViewIcon view={option.key} className="h-5 w-5 shrink-0" />}
            trailing={option.key === view ? CHECK : undefined}
          >
            {option.label}
          </SheetRow>
        ))}
      </Sheet>
    </>
  );
}
