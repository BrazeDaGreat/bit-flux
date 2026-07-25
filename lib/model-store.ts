"use client";

import type { ModelRef, ProviderCatalog, ProviderKind } from "./types";

/**
 * The chosen model is one decision the whole app shares: made on Capture,
 * reused by Ask. A module store rather than context, so both screens read the
 * same value without a provider threaded through the layout, and a change on
 * one is already true on the other.
 *
 * The catalog is fetched once per session, and only when a picker is opened —
 * listing models means a round trip to every connected provider.
 */

export interface Selection extends ModelRef {
  /** The connection's name, for showing what's chosen without the catalog. */
  label: string;
  kind: ProviderKind;
}

export interface ModelState {
  selection: Selection | null;
  catalogs: ProviderCatalog[];
  favorites: ModelRef[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  /** True once the store has heard from the server. Until then a screen shows
   *  the selection its own server render handed it. */
  resolved: boolean;
}

/** Each provider kind keeps one accent everywhere it appears, so the dot next
 *  to a model id says which account will answer. */
export const PROVIDER_TONE: Record<ProviderKind, string> = {
  openai: "mint",
  groq: "apricot",
  gemini: "sky",
  openrouter: "iris",
  custom: "sage",
};

export function sameRef(a: ModelRef | null, b: ModelRef | null): boolean {
  return Boolean(a && b && a.provider === b.provider && a.model === b.model);
}

type Listener = () => void;

const listeners = new Set<Listener>();

let state: ModelState = {
  selection: null,
  catalogs: [],
  favorites: [],
  status: "idle",
  error: null,
  resolved: false,
};

const SERVER_STATE = state;

function set(next: Partial<ModelState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

let inFlight: Promise<void> | null = null;

async function fetchCatalogs(): Promise<void> {
  set({ status: "loading", error: null });
  try {
    const res = await fetch("/api/models");
    const data = (await res.json()) as {
      catalogs?: ProviderCatalog[];
      active?: ModelRef | null;
      favorites?: ModelRef[];
      error?: string;
    };
    if (!res.ok) throw new Error(data.error ?? "Couldn't load your models");

    const catalogs = data.catalogs ?? [];
    // The server's answer wins over a seeded selection — a provider may have
    // been removed on another device.
    const active = data.active ?? null;
    const stillThere =
      active &&
      catalogs.find((catalog) => catalog.provider.id === active.provider);

    set({
      catalogs,
      favorites: data.favorites ?? [],
      status: "ready",
      resolved: true,
      selection: stillThere
        ? {
            ...active!,
            label: stillThere.provider.label,
            kind: stillThere.provider.provider,
          }
        : catalogs.length === 0
          ? null
          : state.selection,
    });
  } catch (err) {
    set({
      status: "error",
      error: err instanceof Error ? err.message : "Couldn't load your models",
    });
  } finally {
    inFlight = null;
  }
}

export const modelStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): ModelState {
    return state;
  },
  getServerSnapshot(): ModelState {
    return SERVER_STATE;
  },

  /**
   * What is actually selected right now: the store once it has heard from the
   * server, and until then whatever that screen was rendered with. Reading it
   * this way keeps the server and the first client paint identical.
   */
  effective(fallback: Selection | null): Selection | null {
    if (state.resolved) return state.selection;
    return state.selection ?? fallback;
  },

  load(force = false) {
    if (inFlight) return inFlight;
    if (state.status === "ready" && !force) return Promise.resolve();
    inFlight = fetchCatalogs();
    return inFlight;
  },

  /** Optimistic: the picker closes on the chosen model, and the write follows.
   *  A failed write is reported, not silently kept. */
  async choose(selection: Selection) {
    const previous = state.selection;
    set({ selection, error: null });
    try {
      const res = await fetch("/api/settings/model", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selection.provider,
          model: selection.model,
        }),
      });
      if (!res.ok) throw new Error("Couldn't keep that choice");
    } catch (err) {
      set({
        selection: previous,
        error: err instanceof Error ? err.message : "Couldn't keep that choice",
      });
    }
  },

  async toggleFavorite(ref: ModelRef) {
    const has = state.favorites.some((f) => sameRef(f, ref));
    const next = has
      ? state.favorites.filter((f) => !sameRef(f, ref))
      : [...state.favorites, { provider: ref.provider, model: ref.model }];

    const previous = state.favorites;
    set({ favorites: next });
    try {
      const res = await fetch("/api/settings/favorites", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorites: next }),
      });
      if (!res.ok) throw new Error("Couldn't save favourites");
    } catch (err) {
      set({
        favorites: previous,
        error: err instanceof Error ? err.message : "Couldn't save favourites",
      });
    }
  },

  /** Called after Settings adds or removes a connection. */
  invalidate() {
    set({ status: "idle", catalogs: [] });
  },
};
