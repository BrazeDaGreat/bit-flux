"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { Caret } from "@/components/Chips";
import Sheet from "@/components/Sheet";
import { useIsCompact } from "@/lib/breakpoint";
import {
  modelStore,
  PROVIDER_TONE,
  sameRef,
  type Selection,
} from "@/lib/model-store";
import type { ModelRef, ProviderCatalog } from "@/lib/types";

interface Row {
  key: string;
  ref: ModelRef;
  label: string;
  kind: Selection["kind"];
  section: string;
}

/**
 * Which model answers is a small, frequent decision, so it is a small,
 * frequent-looking control: a pill in the composer's own footer, reading
 * `connection · model` in the machine's typeface.
 *
 * Inside, favourites come first — the two or three models a person actually
 * alternates between — then each connection's own list. That list is the one
 * picked in Settings, not everything the endpoint sells, so this stays short
 * enough to read at a glance. The dot beside each id carries the provider's
 * colour, so which account is about to be billed is legible before the words
 * are read.
 */
export default function ModelPicker({
  initial,
  align = "left",
  placement = "up",
  label = "Model",
}: {
  initial: Selection | null;
  align?: "left" | "right";
  placement?: "up" | "down";
  label?: string;
}) {
  const state = useSyncExternalStore(
    modelStore.subscribe,
    modelStore.getSnapshot,
    modelStore.getServerSnapshot
  );

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const compact = useIsCompact();

  // Until the store has heard from the server, the pill shows what this screen
  // was rendered with — so the first paint matches the server's.
  const selection = state.resolved ? state.selection : (state.selection ?? initial);

  useEffect(() => {
    if (!open) return;
    void modelStore.load();
    // Taking focus opens the software keyboard, which would cover the list the
    // sheet just opened to show. On a pointer it saves a click.
    if (!compact) searchRef.current?.focus();

    if (compact) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, compact]);

  const needle = query.trim().toLowerCase();

  const { rows, sections } = useMemo(() => {
    const byId = new Map<string, ProviderCatalog>(
      state.catalogs.map((catalog) => [catalog.provider.id, catalog])
    );

    const rows: Row[] = [];
    const sections: {
      key: string;
      title: string;
      note?: string;
      tone?: string;
      providerId?: string;
      rows: Row[];
    }[] = [];

    const matches = (model: string) => !needle || model.toLowerCase().includes(needle);

    const favoriteRows: Row[] = [];
    for (const favorite of state.favorites) {
      const catalog = byId.get(favorite.provider);
      if (!catalog || !matches(favorite.model)) continue;
      favoriteRows.push({
        key: `fav:${favorite.provider}:${favorite.model}`,
        ref: favorite,
        label: catalog.provider.label,
        kind: catalog.provider.provider,
        section: "favorites",
      });
    }
    if (favoriteRows.length) {
      sections.push({
        key: "favorites",
        title: "Favourites",
        rows: favoriteRows,
      });
      rows.push(...favoriteRows);
    }

    for (const catalog of state.catalogs) {
      const providerRows: Row[] = catalog.models.filter(matches).map((model) => ({
        key: `${catalog.provider.id}:${model}`,
        ref: { provider: catalog.provider.id, model },
        label: catalog.provider.label,
        kind: catalog.provider.provider,
        section: catalog.provider.id,
      }));

      sections.push({
        key: catalog.provider.id,
        providerId: catalog.provider.id,
        title: catalog.provider.label,
        // A connection with nothing picked says so, and says where to fix it.
        note: catalog.models.length === 0 ? catalog.note : undefined,
        tone: PROVIDER_TONE[catalog.provider.provider],
        rows: providerRows,
      });
      rows.push(...providerRows);
    }

    return { rows, sections };
  }, [state.catalogs, state.favorites, needle]);

  useEffect(() => {
    setCursor(0);
  }, [needle]);

  function pick(row: Row) {
    void modelStore.choose({
      provider: row.ref.provider,
      model: row.ref.model,
      label: row.label,
      kind: row.kind,
    });
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (rows.length === 0) return;
      const next =
        event.key === "ArrowDown"
          ? (cursor + 1) % rows.length
          : (cursor - 1 + rows.length) % rows.length;
      setCursor(next);
      listRef.current
        ?.querySelector(`[data-row="${next}"]`)
        ?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[cursor];
      if (row) pick(row);
    }
  }

  const empty = state.status === "ready" && state.catalogs.length === 0;

  /**
   * One list, two containers. A 19rem panel pinned beside its trigger is most
   * of a phone's width and lands wherever the composer happens to sit, so
   * below the desktop breakpoint the same list arrives from the bottom
   * instead. The rows are the same rows; only the room differs.
   */
  function panel(inSheet: boolean) {
    let index = -1;
    return (
      <>
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter models…"
          aria-label="Filter models"
          className={
            inSheet
              ? "input mb-2 font-data"
              : "input h-8 py-0 font-data lg:text-[0.74rem]"
          }
        />

        <div
          ref={listRef}
          className={
            inSheet ? "flex flex-col" : "flux-scroll mt-1.5 max-h-[17rem] overflow-y-auto"
          }
        >
          {state.status === "loading" && (
            <p className="px-2 py-3 font-data text-[0.68rem] text-ink-faint">
              loading…
            </p>
          )}

          {state.status === "error" && (
            <p className="px-2 py-3 text-[0.76rem] text-blush">{state.error}</p>
          )}

          {empty && (
            <div className="px-2 py-3">
              <p className="text-[0.78rem] leading-relaxed text-ink-soft">
                No providers yet.
              </p>
              <Link
                href="/settings"
                className="mt-1 inline-block text-[0.78rem] text-iris underline underline-offset-2"
              >
                Add one in Settings
              </Link>
            </div>
          )}

          {sections.map((section) => (
            <section key={section.key} className="mb-1 last:mb-0">
              <div className="flex items-baseline gap-1.5 px-2 pb-0.5 pt-1.5">
                {section.tone && (
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: `var(--${section.tone})` }}
                  />
                )}
                <h3 className="font-data text-[0.62rem] uppercase tracking-[0.14em] text-ink-faint">
                  {section.title}
                </h3>
                {section.note && (
                  <span className="min-w-0 flex-1 truncate text-[0.66rem] text-ink-faint">
                    {section.note}
                  </span>
                )}
              </div>

              {section.rows.map((row) => {
                index += 1;
                const rowIndex = index;
                const chosen = sameRef(selection, row.ref);
                const favorite = state.favorites.some((f) => sameRef(f, row.ref));
                return (
                  <div
                    key={row.key}
                    data-row={rowIndex}
                    className={`group flex items-center gap-1 rounded-lg pr-1 ${
                      cursor === rowIndex && !inSheet ? "bg-surface-2" : ""
                    }`}
                  >
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={chosen}
                      onMouseEnter={() => setCursor(rowIndex)}
                      onClick={() => pick(row)}
                      className={`min-w-0 flex-1 truncate rounded-lg px-2 text-left font-data leading-[1.4] transition-colors hover:bg-surface-2 ${
                        inSheet ? "tap py-2 text-[0.9rem]" : "py-1.5 text-[0.75rem]"
                      } ${chosen ? "text-iris" : "text-ink"}`}
                    >
                      {row.ref.model}
                      {section.key === "favorites" && (
                        <span className="ml-1.5 font-ui text-[0.66rem] text-ink-faint">
                          {row.label}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void modelStore.toggleFavorite(row.ref)}
                      aria-pressed={favorite}
                      aria-label={
                        favorite
                          ? `Remove ${row.ref.model} from favourites`
                          : `Add ${row.ref.model} to favourites`
                      }
                      title={favorite ? "Remove from favourites" : "Favourite"}
                      /* There is no hover on a touch screen, so a control that
                         only appears on hover is a control that does not
                         exist. Below `lg` it is simply there. */
                      className={`tap shrink-0 rounded-md p-1 transition-colors max-lg:grid max-lg:place-items-center max-lg:opacity-100 ${
                        favorite
                          ? "text-amber"
                          : "text-ink-faint opacity-0 hover:text-amber focus-visible:opacity-100 group-hover:opacity-100"
                      } ${cursor === rowIndex && !inSheet ? "opacity-100" : ""}`}
                    >
                      <Star filled={favorite} />
                    </button>
                  </div>
                );
              })}

              {section.rows.length === 0 && section.providerId && (
                <Link
                  href="/settings"
                  className="block px-2 py-1 font-data text-[0.66rem] text-ink-faint transition-colors hover:text-iris"
                >
                  {needle ? "nothing matches here" : "pick its models in Settings →"}
                </Link>
              )}
            </section>
          ))}
        </div>

        {state.error && state.status === "ready" && (
          <p role="alert" className="px-2 pb-1 pt-1.5 text-[0.7rem] text-blush">
            {state.error}
          </p>
        )}
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
        aria-controls={open && !compact ? panelId : undefined}
        aria-label={label}
        title={
          selection ? `${selection.label} · ${selection.model}` : "Choose a model"
        }
        className={`group flex h-8 max-w-[16rem] items-center gap-1.5 rounded-full border px-2.5 leading-none transition-colors max-lg:h-11 max-lg:px-3.5 ${
          open
            ? "border-iris bg-iris-soft text-iris"
            : "border-line-strong text-ink-soft hover:border-iris hover:text-ink"
        }`}
      >
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{
            background: selection
              ? `var(--${PROVIDER_TONE[selection.kind]})`
              : "var(--ink-faint)",
          }}
        />
        {/* `truncate` clips to the line box, so the line box has to be tall
            enough to hold the font: with leading-none DM Mono's ascender and
            descender overflow it, which reads as text sitting low in the
            pill. A leading that contains the glyphs centres them honestly. */}
        <span className="min-w-0 flex-1 truncate font-data text-[0.68rem] leading-[1.4]">
          {selection ? selection.model : "Choose a model"}
        </span>
        <Caret open={open} className="opacity-60" />
      </button>

      {open && !compact && (
        <div
          id={panelId}
          role="menu"
          onKeyDown={onKeyDown}
          className={`absolute z-50 w-[19rem] rounded-2xl border border-line bg-surface p-1.5 ${
            align === "right" ? "right-0" : "left-0"
          } ${placement === "up" ? "bottom-full mb-1.5" : "top-full mt-1.5"}`}
          style={{ boxShadow: "0 18px 40px -18px rgb(0 0 0 / 0.45)" }}
        >
          {panel(false)}
        </div>
      )}

      <Sheet open={open && compact} onClose={() => setOpen(false)} title={label}>
        {panel(true)}
      </Sheet>
    </div>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    >
      <path d="M8 2.2 9.8 5.9l4 .6-2.9 2.8.7 4L8 11.4l-3.6 1.9.7-4L2.2 6.5l4-.6z" />
    </svg>
  );
}
