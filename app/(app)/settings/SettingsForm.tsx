"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import Switch from "@/components/Switch";
import { DEFAULT_EMBED_MODEL, EMBED_MODELS } from "@/lib/ai/embeddings";
import { PROVIDERS, type ProviderId } from "@/lib/ai/provider";
import type { SafeSettings } from "@/lib/types";

const ORDER: ProviderId[] = ["groq", "gemini", "openai", "openrouter", "custom"];

/**
 * Settings is the one screen in bit-flux you visit while already annoyed at it,
 * so it shows as little as it can get away with:
 *
 *  - a row appears only once the row above it has an answer, so an unconfigured
 *    account sees one question rather than nine controls;
 *  - each row's hint disappears once that row is done, so the page gets quieter
 *    as you finish rather than staying equally loud;
 *  - the optional half (semantic search) stays folded until asked for, with its
 *    on/off state on the fold so you never have to open it to check;
 *  - Save only exists when there is something to save, and it follows you down
 *    the page instead of hiding at the bottom.
 */
export default function SettingsForm({ initial }: { initial: SafeSettings }) {
  const [provider, setProvider] = useState<ProviderId | "">(initial.provider);
  const [baseUrl, setBaseUrl] = useState(initial.base_url);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(initial.model);
  const [embedKey, setEmbedKey] = useState("");
  const [embedModel, setEmbedModel] = useState(
    initial.embed_model || DEFAULT_EMBED_MODEL
  );
  const [autoReminders, setAutoReminders] = useState(initial.auto_reminders);
  const [hasKey, setHasKey] = useState(initial.has_key);
  const [keyHint, setKeyHint] = useState(initial.key_hint);
  const [hasEmbedKey, setHasEmbedKey] = useState(initial.has_embed_key);
  const [embedKeyHint, setEmbedKeyHint] = useState(initial.embed_key_hint);
  const [indexing, setIndexing] = useState<string | null>(null);

  /** A stored key is shown as a value, not as an empty password box. Typing a
   *  replacement is a deliberate act. */
  const [replacingKey, setReplacingKey] = useState(!initial.has_key);
  const [replacingEmbedKey, setReplacingEmbedKey] = useState(
    !initial.has_embed_key
  );
  const [showSearch, setShowSearch] = useState(false);

  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState<{
    kind: "idle" | "saving" | "testing" | "ok" | "error";
    message?: string;
  }>({ kind: "idle" });

  /** What's on the server. Compared against the fields to know whether Save has
   *  anything to do — `initial` goes stale the moment we save. */
  const [saved, setSaved] = useState({
    provider: initial.provider as ProviderId | "",
    baseUrl: initial.base_url,
    model: initial.model,
    embedModel: initial.embed_model || DEFAULT_EMBED_MODEL,
    autoReminders: initial.auto_reminders,
  });

  // Refresh the model list whenever there's enough to ask with.
  useEffect(() => {
    if (!provider) return;
    if (provider === "custom" && !baseUrl) return;
    let cancelled = false;
    fetch("/api/settings/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, base_url: baseUrl, api_key: apiKey }),
    })
      .then((r) => r.json())
      .then((data: { models?: string[] }) => {
        if (!cancelled) setModels(data.models ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [provider, baseUrl, apiKey]);

  async function save() {
    setStatus({ kind: "saving" });
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        base_url: baseUrl,
        model,
        embed_model: embedModel,
        auto_reminders: autoReminders,
        // Only send a key when the user typed one — otherwise the stored key
        // stays untouched.
        ...(apiKey ? { api_key: apiKey } : {}),
        ...(embedKey ? { embed_api_key: embedKey } : {}),
      }),
    });
    const data = (await res.json()) as SafeSettings & { error?: string };
    if (!res.ok) {
      setStatus({ kind: "error", message: data.error ?? "Couldn't save settings" });
      return;
    }
    setApiKey("");
    setEmbedKey("");
    setHasKey(data.has_key);
    setKeyHint(data.key_hint);
    setHasEmbedKey(data.has_embed_key);
    setEmbedKeyHint(data.embed_key_hint);
    if (data.has_key) setReplacingKey(false);
    if (data.has_embed_key) setReplacingEmbedKey(false);
    setSaved({ provider, baseUrl, model, embedModel, autoReminders });
    setStatus({ kind: "ok", message: "Saved" });
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

  async function test() {
    setStatus({ kind: "testing" });
    const res = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, base_url: baseUrl, model, api_key: apiKey }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    setStatus(
      data.ok
        ? { kind: "ok", message: "Connection works" }
        : { kind: "error", message: data.error ?? "Connection failed" }
    );
  }

  const needsBaseUrl = provider === "custom";
  const baseUrlDone = !needsBaseUrl || Boolean(baseUrl);
  const keyDone = hasKey || Boolean(apiKey);
  const ready = Boolean(provider && model && keyDone);

  const dirty =
    provider !== saved.provider ||
    baseUrl !== saved.baseUrl ||
    model !== saved.model ||
    embedModel !== saved.embedModel ||
    autoReminders !== saved.autoReminders ||
    apiKey !== "" ||
    embedKey !== "";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="px-4 pb-1 pt-3.5">
          <h2 className="text-[0.88rem] font-semibold text-ink">Connection</h2>
        </div>

        <Row
          label="Provider"
          done={Boolean(provider)}
          hint="Any OpenAI-compatible endpoint works, including your own."
        >
          <div className="flex flex-wrap gap-1.5">
            {ORDER.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setProvider(id);
                  setBaseUrl(PROVIDERS[id].baseUrl ?? "");
                  setModel("");
                }}
                className={`rounded-full border px-3 py-1.5 text-[0.8rem] transition-colors ${
                  provider === id
                    ? "border-iris bg-iris-soft text-iris"
                    : "border-line-strong text-ink-soft hover:border-iris hover:text-ink"
                }`}
              >
                {PROVIDERS[id].label}
              </button>
            ))}
          </div>
        </Row>

        {needsBaseUrl && (
          <Row
            label="Base URL"
            done={Boolean(baseUrl)}
            hint="The endpoint root, ending before /chat/completions."
          >
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://my-host/v1"
              className="input"
            />
          </Row>
        )}

        {provider && baseUrlDone && (
          <Row
            label="API key"
            done={keyDone}
            hint="Encrypted before it's stored. It never reaches the browser again."
          >
            {hasKey && !replacingKey ? (
              <div className="flex items-center gap-2.5">
                <span className="font-data text-[0.8rem] text-ink">{keyHint}</span>
                <button
                  type="button"
                  onClick={() => setReplacingKey(true)}
                  className="text-[0.76rem] text-iris underline underline-offset-2"
                >
                  Replace
                </button>
              </div>
            ) : (
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={PROVIDERS[provider].keyHint}
                autoComplete="off"
                autoFocus={hasKey}
                className="input font-data"
              />
            )}
          </Row>
        )}

        {provider && baseUrlDone && (
          <Row
            label="Model"
            done={Boolean(model)}
            hint="The model that reads your dumps and splits them."
          >
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              list="flux-models"
              placeholder="Pick or type a model id"
              className="input font-data"
            />
            <datalist id="flux-models">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Row>
        )}

        {/* Test belongs next to what it tests, not in a row of page-wide
            buttons where it reads as a second way to save. */}
        {ready && (
          <div className="border-t border-line px-4 py-3">
            <button
              type="button"
              onClick={() => void test()}
              disabled={status.kind === "testing"}
              className="rounded-full border border-line-strong px-3.5 py-1.5 text-[0.78rem] text-ink-soft transition-colors hover:border-iris hover:text-ink disabled:opacity-40"
            >
              {status.kind === "testing" ? "Testing…" : "Test connection"}
            </button>
          </div>
        )}
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
              hasEmbedKey
                ? "bg-mint-soft text-mint"
                : "bg-surface-3 text-ink-faint"
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
              hint="Embeddings are Gemini-only. Without a key, search still works on words alone."
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
            Unsaved changes
          </span>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!provider || status.kind === "saving"}
            className="shrink-0 rounded-full bg-iris px-4 py-2 text-[0.82rem] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:text-[#1a1622]"
          >
            {status.kind === "saving" ? "Saving…" : "Save changes"}
          </button>
        </div>
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
