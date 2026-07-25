"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import ModelPicker from "@/components/ModelPicker";
import { modelStore, type Selection } from "@/lib/model-store";
import { pb } from "@/lib/pb";
import { sortingStore } from "@/lib/sorting-store";
import type { DumpRecord } from "@/lib/types";
import { VERSION } from "@/lib/VERSION";

const DRAFT_KEY = "flux-draft";
const MAX_HEIGHT = 340;

type FailedRequest =
  | { kind: "save"; text: string }
  | { kind: "sort"; dumpId: string; text: string };

export default function CaptureScreen({
  userId,
  hasProvider,
  selection,
  weekPanel,
}: {
  userId: string;
  hasProvider: boolean;
  /** What the model picker starts on — the choice made last time. */
  selection: Selection | null;
  /** Server-rendered — the only other thing on this screen. */
  weekPanel: React.ReactNode;
}) {
  // Read the draft during the first client render rather than in an effect,
  // so the box is never briefly empty.
  const [text, setText] = useState(() =>
    typeof window === "undefined" ? "" : (localStorage.getItem(DRAFT_KEY) ?? "")
  );
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [failedRequest, setFailedRequest] = useState<FailedRequest | null>(null);
  const [retrying, setRetrying] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const models = useSyncExternalStore(
    modelStore.subscribe,
    modelStore.getSnapshot,
    modelStore.getServerSnapshot
  );
  const chosen = models.resolved
    ? models.selection
    : (models.selection ?? selection);
  /** Sorting needs both halves of the decision: an account, and a model on it. */
  const canSort = hasProvider && Boolean(chosen);

  useEffect(() => {
    areaRef.current?.focus();
  }, []);

  // A refresh should never cost the user what they were typing.
  useEffect(() => {
    if (text) localStorage.setItem(DRAFT_KEY, text);
    else localStorage.removeItem(DRAFT_KEY);
  }, [text]);

  /**
   * Grow with the content. This runs before paint — in an effect it lands a
   * render late, which shows up as the box refusing to grow until the *next*
   * keystroke.
   */
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, MAX_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [text]);

  /** Runs in the background — capture must never wait on a model. */
  function sortInBackground(
    dumpId: string,
    capturedText: string,
    isRetry = false
  ) {
    if (isRetry) setRetrying(true);
    sortingStore.start(dumpId);
    // Send the model that was on screen when Save was pressed, so a change
    // made a second ago is the one that runs.
    const picked = modelStore.effective(selection);
    fetch(`/api/dumps/${dumpId}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: picked
          ? { provider: picked.provider, model: picked.model }
          : undefined,
      }),
    })
      .then(async (res) => {
        const data = (await res.json()) as { error?: string; needs_key?: boolean };
        if (!res.ok) {
          setNeedsKey(Boolean(data.needs_key));
          setError(data.error ?? "Sorting failed");
          setText((current) => current || capturedText);
          setFailedRequest({ kind: "sort", dumpId, text: capturedText });
          areaRef.current?.focus();
          return;
        }
        if (isRetry) {
          setText((current) => (current === capturedText ? "" : current));
          setError(null);
          setNeedsKey(false);
          setFailedRequest(null);
        }
        // The week panel is server-rendered from the thoughts just created.
        router.refresh();
      })
      .catch((err: unknown) => {
        setNeedsKey(false);
        setError(err instanceof Error ? err.message : "Sorting failed");
        setText((current) => current || capturedText);
        setFailedRequest({ kind: "sort", dumpId, text: capturedText });
        areaRef.current?.focus();
      })
      .finally(() => {
        sortingStore.finish(dumpId);
        if (isRetry) setRetrying(false);
      });
  }

  async function save() {
    const body = text.trim();
    if (!body || saving) return;

    const capturedAt = new Date().toISOString();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    setText("");
    setError(null);
    setNeedsKey(false);
    setFailedRequest(null);
    setSaving(true);
    areaRef.current?.focus();

    try {
      const saved = await pb().collection("flux_dumps").create<DumpRecord>({
        user: userId,
        text: body,
        source: "web",
        captured_at: capturedAt,
        capture_tz: timeZone,
        status: "pending",
      });

      setFlash(canSort ? "Saved — sorting it now" : "Saved");
      window.setTimeout(() => setFlash(null), 2600);
      if (canSort) sortInBackground(saved.id, body);
    } catch (err) {
      setText((current) => current || body);
      setFailedRequest({ kind: "save", text: body });
      setError(
        err instanceof Error ? `Couldn't save that. ${err.message}` : "Couldn't save that."
      );
    } finally {
      setSaving(false);
    }
  }

  function retryFailedRequest() {
    if (!failedRequest || saving || retrying) return;
    if (failedRequest.kind === "sort") {
      sortInBackground(failedRequest.dumpId, failedRequest.text, true);
      return;
    }
    void save();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void save();
    }
  }

  return (
    <div className="relative flex min-h-full flex-col px-5 py-6 sm:px-8">
      {/* Peripheral, not part of the main column. */}
      <div className="flex justify-end">{weekPanel}</div>

      <div className="flex flex-1 items-center justify-center py-8">
        <div className="w-full max-w-xl">
          <h1 className="text-center font-hand text-[1.8rem] leading-tight tracking-[-0.01em] text-ink">
            What&apos;s on your mind?
          </h1>
          <p className="mt-1 text-center text-[0.82rem] text-ink-soft">
            Write it however it comes out. Sorting happens after.
          </p>

          <div className="mt-5 rounded-2xl border border-line-strong bg-surface-2 p-1 transition-colors focus-within:border-iris">
            <textarea
              ref={areaRef}
              suppressHydrationWarning
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="call the dentist back, maybe voice notes for capture, ship Aris memory by friday…"
              className="bare-field flux-scroll block w-full resize-none bg-transparent px-4 py-3.5 font-hand text-[1.05rem] leading-[1.6] text-ink placeholder:text-ink-faint"
              style={{ minHeight: "7rem" }}
            />
            {/* Which model sorts this sits with the box it will sort, not on
                another screen — and it stays put for next time. */}
            <div className="flex items-center gap-2 px-2.5 pb-2.5 pt-1">
              {hasProvider && (
                <ModelPicker initial={selection} align="left" placement="up" />
              )}
              <span className="ml-auto shrink-0 font-data text-[0.68rem] text-ink-faint">
                {text.trim() ? `${text.trim().length} characters` : "⌘↵ to save"}
              </span>
              <button
                type="button"
                onClick={() => void save()}
                disabled={!text.trim() || saving}
                className="rounded-full bg-iris px-4 py-1.5 text-[0.8rem] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35 dark:text-[#1a1622]"
              >
                Save
              </button>
            </div>
          </div>

          <div className="mt-3 min-h-[2.5rem]">
            {flash && (
              <p
                role="status"
                className="text-center font-data text-[0.7rem] text-mint"
              >
                {flash}
              </p>
            )}

            {!canSort && !flash && (
              <p className="rounded-xl bg-amber-soft px-3.5 py-2.5 text-center text-[0.78rem] text-amber">
                Everything you write is saved.{" "}
                {hasProvider ? (
                  "Pick a model below to have it sorted."
                ) : (
                  <>
                    <Link href="/settings" className="underline underline-offset-2">
                      Add a provider
                    </Link>{" "}
                    to have it sorted.
                  </>
                )}
              </p>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-center justify-between gap-3 rounded-xl bg-blush-soft px-3.5 py-2.5 text-[0.78rem] text-blush"
              >
                <span>
                  {error}
                  {needsKey && (
                    <>
                      {" "}
                      <Link href="/settings" className="underline underline-offset-2">
                        Open settings
                      </Link>
                    </>
                  )}
                </span>
                {failedRequest && (
                  <button
                    type="button"
                    onClick={retryFailedRequest}
                    disabled={saving || retrying}
                    className="shrink-0 rounded-full border border-current px-3 py-1 font-medium transition-opacity hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving || retrying ? "Retrying…" : "Retry"}
                  </button>
                )}
              </div>
            )}
          </div>

          <p className="mt-2 text-center font-data text-[0.66rem] text-ink-faint">
            <Link href="/thoughts" className="hover:text-ink">
              everything you&apos;ve written →
            </Link>
            <span className="mt-1 block">{VERSION}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
