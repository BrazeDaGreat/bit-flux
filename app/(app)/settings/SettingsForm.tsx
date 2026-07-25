"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import Switch from "@/components/Switch";
import { DEFAULT_EMBED_MODEL, EMBED_MODELS } from "@/lib/ai/embeddings";
import { PROVIDERS, type ProviderId } from "@/lib/ai/provider";
import { modelStore, PROVIDER_TONE } from "@/lib/model-store";
import type { SafeProvider, SafeSettings } from "@/lib/types";

const ORDER: ProviderId[] = ["groq", "gemini", "openai", "openrouter", "custom"];

interface Draft {
  uid: string;
  provider: ProviderId | "";
  label: string;
  baseUrl: string;
  apiKey: string;
}

let counter = 0;
function newDraft(): Draft {
  counter += 1;
  return { uid: `draft-${counter}`, provider: "", label: "", baseUrl: "", apiKey: "" };
}

function complete(draft: Draft): boolean {
  if (!draft.provider || !draft.apiKey) return false;
  return draft.provider !== "custom" || Boolean(draft.baseUrl);
}

/**
 * Settings holds the two things that are true of the whole account: which
 * accounts exist, and how search is indexed. Which model runs is a per-capture
 * decision and lives on Capture, so this screen never asks for one.
 *
 * Connections are added in a batch. Someone arriving with three keys in a
 * password manager pastes all three and saves once, rather than reloading the
 * page between each.
 */
export default function SettingsForm({ initial }: { initial: SafeSettings }) {
  const [providers, setProviders] = useState<SafeProvider[]>(initial.providers);
  const [drafts, setDrafts] = useState<Draft[]>(
    initial.providers.length === 0 ? [newDraft()] : []
  );

  const [embedKey, setEmbedKey] = useState("");
  const [embedModel, setEmbedModel] = useState(
    initial.embed_model || DEFAULT_EMBED_MODEL
  );
  const [autoReminders, setAutoReminders] = useState(initial.auto_reminders);
  const [hasEmbedKey, setHasEmbedKey] = useState(initial.has_embed_key);
  const [embedKeyHint, setEmbedKeyHint] = useState(initial.embed_key_hint);
  const [replacingEmbedKey, setReplacingEmbedKey] = useState(
    !initial.has_embed_key
  );
  const [showSearch, setShowSearch] = useState(false);
  const [indexing, setIndexing] = useState<string | null>(null);

  const [saved, setSaved] = useState({
    embedModel: initial.embed_model || DEFAULT_EMBED_MODEL,
    autoReminders: initial.auto_reminders,
  });

  const [status, setStatus] = useState<{
    kind: "idle" | "saving" | "ok" | "error";
    message?: string;
  }>({ kind: "idle" });

  function patchDraft(uid: string, data: Partial<Draft>) {
    setDrafts((prev) =>
      prev.map((draft) => (draft.uid === uid ? { ...draft, ...data } : draft))
    );
  }

  const ready = drafts.filter(complete);
  const dirty =
    ready.length > 0 ||
    embedKey !== "" ||
    embedModel !== saved.embedModel ||
    autoReminders !== saved.autoReminders;

  async function save() {
    setStatus({ kind: "saving" });

    if (ready.length > 0) {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providers: ready.map((draft) => ({
            provider: draft.provider,
            label: draft.label,
            base_url: draft.baseUrl,
            api_key: draft.apiKey,
          })),
        }),
      });
      const data = (await res.json()) as {
        providers?: SafeProvider[];
        error?: string;
      };
      if (!res.ok) {
        setStatus({ kind: "error", message: data.error ?? "Couldn't add that" });
        return;
      }
      setProviders(data.providers ?? providers);
      setDrafts((prev) => prev.filter((draft) => !complete(draft)));
      modelStore.invalidate();
    }

    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embed_model: embedModel,
        auto_reminders: autoReminders,
        ...(embedKey ? { embed_api_key: embedKey } : {}),
      }),
    });
    const data = (await res.json()) as SafeSettings & { error?: string };
    if (!res.ok) {
      setStatus({ kind: "error", message: data.error ?? "Couldn't save settings" });
      return;
    }

    setEmbedKey("");
    setHasEmbedKey(data.has_embed_key);
    setEmbedKeyHint(data.embed_key_hint);
    if (data.has_embed_key) setReplacingEmbedKey(false);
    setSaved({ embedModel, autoReminders });
    setStatus({
      kind: "ok",
      message:
        ready.length > 0
          ? `Added ${ready.length} provider${ready.length === 1 ? "" : "s"}`
          : "Saved",
    });
  }

  async function removeProvider(id: string) {
    const res = await fetch(`/api/providers/${id}`, { method: "DELETE" });
    const data = (await res.json()) as { providers?: SafeProvider[]; error?: string };
    if (!res.ok) {
      setStatus({ kind: "error", message: data.error ?? "Couldn't remove that" });
      return;
    }
    setProviders(data.providers ?? []);
    modelStore.invalidate();
    setStatus({ kind: "ok", message: "Removed" });
  }

  /** Indexes anything captured before the Gemini key was added. */
  async function backfill() {
    setIndexing("Indexing…");
    const res = await fetch("/api/embeddings/backfill", { method: "POST" });
    const data = (await res.json()) as {
      indexed?: number;
      remaining?: number;
      error?: string;
    };
    if (data.error) {
      setIndexing(data.error);
      return;
    }
    setIndexing(
      data.indexed
        ? `Indexed ${data.indexed}.${data.remaining ? ` ${data.remaining} left — run it again.` : " All caught up."}`
        : "Everything is already indexed."
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-baseline gap-2 px-4 pb-1 pt-3.5">
          <h2 className="text-[0.88rem] font-semibold text-ink">Providers</h2>
          <span className="font-data text-[0.66rem] text-ink-faint">
            {providers.length || "none yet"}
          </span>
        </div>
        <p className="px-4 pb-3 text-[0.76rem] leading-relaxed text-ink-soft">
          Add as many as you like, then pick which of their models you want
          offered. Which one runs is chosen on{" "}
          <Link href="/" className="text-iris underline underline-offset-2">
            Capture
          </Link>
          .
        </p>

        {providers.map((provider) => (
          <ProviderRow
            key={provider.id}
            provider={provider}
            onRemove={() => void removeProvider(provider.id)}
            onReplaced={(next) =>
              setProviders((prev) =>
                prev.map((p) => (p.id === next.id ? next : p))
              )
            }
          />
        ))}

        {drafts.map((draft, index) => (
          <DraftRow
            key={draft.uid}
            draft={draft}
            index={providers.length + index}
            onChange={(data) => patchDraft(draft.uid, data)}
            onDrop={() =>
              setDrafts((prev) => prev.filter((d) => d.uid !== draft.uid))
            }
          />
        ))}

        <div className="border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={() => setDrafts((prev) => [...prev, newDraft()])}
            className="rounded-full border border-line-strong px-3.5 py-1.5 text-[0.78rem] text-ink-soft transition-colors hover:border-iris hover:text-ink"
          >
            {providers.length === 0 && drafts.length === 0
              ? "Add a provider"
              : "Add another"}
          </button>
        </div>
      </Card>

      {/* Optional, and folded: its state is on the fold, so checking it costs
          nothing and the page stays one column of short rows. */}
      <Card>
        <button
          type="button"
          onClick={() => setShowSearch(!showSearch)}
          aria-expanded={showSearch}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[0.88rem] font-semibold text-ink">
              Search by meaning
            </span>
            <span className="mt-0.5 block text-[0.76rem] text-ink-soft">
              Finds related thoughts even when the words don&apos;t match.
            </span>
          </span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 font-data text-[0.62rem] uppercase tracking-[0.1em] ${
              hasEmbedKey ? "bg-mint-soft text-mint" : "bg-surface-3 text-ink-faint"
            }`}
          >
            {hasEmbedKey ? "On" : "Off"}
          </span>
          <span
            aria-hidden="true"
            className="shrink-0 font-data text-[0.7rem] text-ink-faint"
          >
            {showSearch ? "−" : "+"}
          </span>
        </button>

        {showSearch && (
          <div>
            <Row
              label="Gemini key"
              done={hasEmbedKey || Boolean(embedKey)}
              hint="Embeddings are Gemini-only, so this key is separate from your providers."
            >
              {hasEmbedKey && !replacingEmbedKey ? (
                <div className="flex items-center gap-2.5">
                  <span className="font-data text-[0.8rem] text-ink">
                    {embedKeyHint}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReplacingEmbedKey(true)}
                    className="text-[0.76rem] text-iris underline underline-offset-2"
                  >
                    Replace
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="password"
                    value={embedKey}
                    onChange={(e) => setEmbedKey(e.target.value)}
                    placeholder="AIza…"
                    autoComplete="off"
                    className="input font-data"
                  />
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-block text-[0.74rem] text-iris underline underline-offset-2"
                  >
                    Get a key from Google AI Studio
                  </a>
                </>
              )}
            </Row>

            {/* The one model choice that stays here: nobody picks an embedding
                model per capture, and changing it re-indexes everything. */}
            {(hasEmbedKey || embedKey) && (
              <Row label="Embedding model" done>
                <select
                  value={embedModel}
                  onChange={(e) => setEmbedModel(e.target.value)}
                  className="select font-data"
                >
                  {EMBED_MODELS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Row>
            )}

            {hasEmbedKey && (
              <div className="flex flex-wrap items-center gap-2.5 border-t border-line px-4 py-3">
                <button
                  type="button"
                  onClick={() => void backfill()}
                  className="rounded-full border border-line-strong px-3.5 py-1.5 text-[0.78rem] text-ink-soft transition-colors hover:border-iris hover:text-ink"
                >
                  Index older thoughts
                </button>
                {indexing && (
                  <span role="status" className="text-[0.76rem] text-ink-soft">
                    {indexing}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <div className="px-3 py-3">
          <Switch
            checked={autoReminders}
            onChange={setAutoReminders}
            label="Set reminders automatically when something has a deadline"
            hint="Off means you only get a reminder when you ask for one in the text."
          />
        </div>
      </Card>

      {/* Every result lands in the same place, whichever button produced it —
          nothing to hunt for after pressing something. */}
      <p role="status" aria-live="polite" className="min-h-[1.15rem] px-1 text-[0.78rem]">
        {status.message && (
          <span
            style={{
              color: status.kind === "error" ? "var(--blush)" : "var(--mint)",
            }}
          >
            {status.message}
          </span>
        )}
      </p>

      <p className="px-1 text-[0.78rem] text-ink-soft">
        Tags teach the AI how you think about your own work.{" "}
        <Link href="/tags" className="text-iris underline underline-offset-2">
          Manage tags
        </Link>
      </p>

      {/* Follows you down the page, and only exists when there's a change to
          keep — no permanently-lit Save to wonder about. */}
      {dirty && (
        <div className="sticky bottom-0 -mx-1 mt-1 flex items-center gap-3 rounded-2xl border border-line-strong bg-surface-2 px-3 py-2.5">
          <span className="min-w-0 flex-1 truncate text-[0.78rem] text-ink-soft">
            {ready.length > 0
              ? `${ready.length} provider${ready.length === 1 ? "" : "s"} ready to add`
              : "Unsaved changes"}
          </span>
          <button
            type="button"
            onClick={() => void save()}
            disabled={status.kind === "saving"}
            className="shrink-0 rounded-full bg-iris px-4 py-2 text-[0.82rem] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:text-[#1a1622]"
          >
            {status.kind === "saving" ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}

/** A connection that exists: what it is, which key it holds, and the two
 *  things you can do to it. */
function ProviderRow({
  provider,
  onRemove,
  onReplaced,
}: {
  provider: SafeProvider;
  onRemove: () => void;
  onReplaced: (next: SafeProvider) => void;
}) {
  const [replacing, setReplacing] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function test() {
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/providers/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: provider.id }),
    });
    const data = (await res.json()) as { ok?: boolean; models?: number; error?: string };
    setBusy(false);
    setNote(
      data.ok
        ? { ok: true, text: `Works — ${data.models ?? 0} models` }
        : { ok: false, text: data.error ?? "Connection failed" }
    );
  }

  async function replace() {
    setBusy(true);
    const res = await fetch(`/api/providers/${provider.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: key }),
    });
    const data = (await res.json()) as SafeProvider & { error?: string };
    setBusy(false);
    if (data.error) {
      setNote({ ok: false, text: data.error });
      return;
    }
    onReplaced(data);
    setKey("");
    setReplacing(false);
    setNote({ ok: true, text: "Key replaced" });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: `var(--${PROVIDER_TONE[provider.provider]})` }}
        />
        <span className="min-w-0 flex-1 truncate text-[0.84rem] text-ink">
          {provider.label}
        </span>
        <span className="shrink-0 font-data text-[0.72rem] text-ink-faint">
          {provider.key_hint || "no key"}
        </span>
      </div>

      {provider.base_url && (
        <p className="truncate font-data text-[0.68rem] text-ink-faint">
          {provider.base_url}
        </p>
      )}

      {/* Which models this connection offers is a decision made once, here,
          rather than a list scrolled past on every capture. */}
      <button
        type="button"
        onClick={() => setChoosing(!choosing)}
        aria-expanded={choosing}
        className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
          provider.models.length === 0
            ? "border-amber/50 bg-amber-soft/40"
            : "border-line-strong hover:border-iris"
        }`}
      >
        <span className="min-w-0 flex-1 text-[0.78rem] text-ink">
          {provider.models.length === 0
            ? "Pick available models"
            : `${provider.models.length} model${provider.models.length === 1 ? "" : "s"} available`}
        </span>
        <span className="min-w-0 max-w-[45%] truncate font-data text-[0.68rem] text-ink-faint">
          {provider.models.slice(0, 3).join(", ")}
          {provider.models.length > 3 ? "…" : ""}
        </span>
        <span aria-hidden="true" className="font-data text-[0.7rem] text-ink-faint">
          {choosing ? "−" : "+"}
        </span>
      </button>

      {choosing && (
        <ModelChooser
          provider={provider}
          onSaved={(models) => onReplaced({ ...provider, models })}
        />
      )}

      {replacing ? (
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={PROVIDERS[provider.provider].keyHint}
            autoComplete="off"
            autoFocus
            className="input font-data"
          />
          <button
            type="button"
            onClick={() => void replace()}
            disabled={!key || busy}
            className="shrink-0 rounded-full bg-iris px-3.5 py-1.5 text-[0.76rem] font-medium text-white disabled:opacity-40 dark:text-[#1a1622]"
          >
            Save key
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void test()}
            disabled={busy}
            className="text-[0.74rem] text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
          >
            {busy ? "Testing…" : "Test"}
          </button>
          <button
            type="button"
            onClick={() => setReplacing(true)}
            className="text-[0.74rem] text-ink-soft transition-colors hover:text-ink"
          >
            Replace key
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-[0.74rem] text-ink-faint transition-colors hover:text-blush"
          >
            Remove
          </button>
          {note && (
            <span
              role="status"
              className="text-[0.74rem]"
              style={{ color: note.ok ? "var(--mint)" : "var(--blush)" }}
            >
              {note.text}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The long list, shown in the one place it belongs. A provider can offer three
 * hundred models; two or three of them are ever wanted, and the picker on
 * Capture should show those and nothing else.
 *
 * Toggling saves itself a beat later — there is no Save button here because
 * there is nothing to lose by getting it wrong, and a half-picked list would
 * be a worse thing to leave behind than an unsaved one.
 */
function ModelChooser({
  provider,
  onSaved,
}: {
  provider: SafeProvider;
  onSaved: (models: string[]) => void;
}) {
  const [available, setAvailable] = useState<string[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>(provider.models);
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/providers/${provider.id}/models`)
      .then((res) => res.json())
      .then((data: { available?: string[]; note?: string; error?: string }) => {
        if (cancelled) return;
        setAvailable(data.available ?? []);
        setNote(data.note ?? data.error ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setAvailable([]);
          setNote("Couldn't reach that endpoint.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [provider.id]);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  function commit(next: string[]) {
    setPicked(next);
    setStatus("saving");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void fetch(`/api/providers/${provider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ models: next }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("save failed");
          setStatus("saved");
          onSaved(next);
          // The picker caches the catalog for the session; this changed it.
          modelStore.invalidate();
        })
        .catch(() => setStatus("error"));
    }, 500);
  }

  function toggle(model: string) {
    commit(
      picked.includes(model)
        ? picked.filter((m) => m !== model)
        : [...picked, model]
    );
  }

  function addManual() {
    const id = manual.trim();
    if (!id || picked.includes(id)) return;
    commit([...picked, id]);
    setManual("");
  }

  // Ids typed by hand belong in the list even when the endpoint doesn't
  // mention them.
  const all = [
    ...picked.filter((model) => !(available ?? []).includes(model)),
    ...(available ?? []),
  ];
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? all.filter((model) => model.toLowerCase().includes(needle))
    : all;

  return (
    <div className="rounded-xl border border-line bg-surface p-2">
      <div className="flex items-baseline gap-2 px-1 pb-1.5">
        <span className="font-data text-[0.62rem] uppercase tracking-[0.14em] text-ink-faint">
          {picked.length} of {all.length} picked
        </span>
        <span
          role="status"
          className="ml-auto font-data text-[0.62rem]"
          style={{
            color:
              status === "error"
                ? "var(--blush)"
                : status === "saved"
                  ? "var(--mint)"
                  : "var(--ink-faint)",
          }}
        >
          {status === "saving"
            ? "saving…"
            : status === "saved"
              ? "saved"
              : status === "error"
                ? "didn't save"
                : ""}
        </span>
      </div>

      {all.length > 10 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a model…"
          aria-label="Find a model"
          className="input mb-1.5 h-8 py-0 font-data text-[0.74rem]"
        />
      )}

      {available === null ? (
        <p className="px-1 py-2 font-data text-[0.68rem] text-ink-faint">
          asking the endpoint…
        </p>
      ) : (
        <div className="flux-scroll max-h-64 overflow-y-auto">
          {shown.map((model) => {
            const on = picked.includes(model);
            return (
              <button
                key={model}
                type="button"
                onClick={() => toggle(model)}
                aria-pressed={on}
                className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-surface-2"
              >
                <span
                  aria-hidden="true"
                  className="grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border transition-colors"
                  style={{
                    borderColor: on ? "var(--iris)" : "var(--line-strong)",
                    background: on ? "var(--iris-soft)" : "transparent",
                  }}
                >
                  {on && (
                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5">
                      <path
                        d="M2.5 6.2 4.8 8.5 9.5 3.8"
                        fill="none"
                        stroke="var(--iris)"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate font-data text-[0.74rem] leading-[1.4] ${
                    on ? "text-ink" : "text-ink-soft"
                  }`}
                >
                  {model}
                </span>
              </button>
            );
          })}
          {shown.length === 0 && (
            <p className="px-1.5 py-2 text-[0.76rem] text-ink-faint">
              {needle ? "Nothing matches." : "Nothing to show."}
            </p>
          )}
        </div>
      )}

      <div className="mt-1.5 flex items-center gap-2 border-t border-line pt-1.5">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addManual();
            }
          }}
          placeholder="Add a model id by hand"
          aria-label="Add a model id by hand"
          className="input h-8 py-0 font-data text-[0.74rem]"
        />
        <button
          type="button"
          onClick={addManual}
          disabled={!manual.trim()}
          className="shrink-0 rounded-full border border-line-strong px-3 py-1.5 text-[0.74rem] text-ink-soft transition-colors hover:border-iris hover:text-ink disabled:opacity-35"
        >
          Add
        </button>
      </div>

      {note && (
        <p className="mt-1.5 px-1 text-[0.72rem] leading-relaxed text-ink-faint">
          {note}
        </p>
      )}
    </div>
  );
}

/** A connection being added. Nothing is written until Save, so several of
 *  these can be filled in at once. */
function DraftRow({
  draft,
  index,
  onChange,
  onDrop,
}: {
  draft: Draft;
  index: number;
  onChange: (data: Partial<Draft>) => void;
  onDrop: () => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 border-t border-line bg-surface px-4 py-3.5">
      <div className="flex items-center gap-2">
        <span className="font-data text-[0.62rem] uppercase tracking-[0.14em] text-ink-faint">
          new connection
        </span>
        <button
          type="button"
          onClick={onDrop}
          className="ml-auto text-[0.74rem] text-ink-faint transition-colors hover:text-blush"
        >
          Discard
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ORDER.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() =>
              onChange({
                provider: id,
                baseUrl: PROVIDERS[id].baseUrl ?? "",
                label: draft.label || PROVIDERS[id].label,
              })
            }
            className={`rounded-full border px-3 py-1.5 text-[0.8rem] transition-colors ${
              draft.provider === id
                ? "border-iris bg-iris-soft text-iris"
                : "border-line-strong text-ink-soft hover:border-iris hover:text-ink"
            }`}
          >
            {PROVIDERS[id].label}
          </button>
        ))}
      </div>

      {draft.provider === "custom" && (
        <input
          value={draft.baseUrl}
          onChange={(e) => onChange({ baseUrl: e.target.value })}
          placeholder="https://my-host/v1"
          aria-label="Base URL"
          className="input"
        />
      )}

      {draft.provider && (
        <>
          <input
            type="password"
            value={draft.apiKey}
            onChange={(e) => onChange({ apiKey: e.target.value })}
            placeholder={PROVIDERS[draft.provider].keyHint}
            aria-label="API key"
            autoComplete="off"
            className="input font-data"
          />
          {/* Only worth naming when you'd otherwise have two of the same
              thing. */}
          {index > 0 && (
            <input
              value={draft.label}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder={`Name it — ${PROVIDERS[draft.provider].label}`}
              aria-label="Name"
              className="input"
            />
          )}
          <p className="text-[0.74rem] leading-relaxed text-ink-soft">
            Encrypted before it&apos;s stored. It never reaches the browser again.
          </p>
        </>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface-2">
      {children}
    </section>
  );
}

/**
 * One question per row, label left and control right, with the hint present
 * only until the row is answered — a finished setting is a fact, and a fact
 * doesn't need instructions under it.
 */
function Row({
  label,
  hint,
  done,
  children,
}: {
  label: string;
  hint?: string;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-line px-4 py-3.5 sm:flex-row sm:gap-4">
      <div className="sm:w-32 sm:shrink-0 sm:pt-2">
        <h2 className="text-[0.82rem] font-medium text-ink">{label}</h2>
      </div>
      <div className="min-w-0 flex-1">
        {children}
        {hint && !done && (
          <p className="mt-1.5 text-[0.74rem] leading-relaxed text-ink-soft">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
