"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { pb } from "@/lib/pb";
import { sortingStore } from "@/lib/sorting-store";
import type { DumpRecord } from "@/lib/types";
import { VERSION } from "@/lib/VERSION";

const DRAFT_KEY = "flux-draft";
const MAX_HEIGHT = 340;

export default function CaptureScreen({
  userId,
  hasKey,
  weekPanel,
}: {
  userId: string;
  hasKey: boolean;
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
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

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
  function sortInBackground(dumpId: string) {
    sortingStore.start(dumpId);
    fetch(`/api/dumps/${dumpId}/process`, { method: "POST" })
      .then(async (res) => {
        const data = (await res.json()) as { error?: string; needs_key?: boolean };
        if (!res.ok) {
          setNeedsKey(Boolean(data.needs_key));
          setError(data.error ?? "Sorting failed");
          return;
        }
        // The week panel is server-rendered from the thoughts just created.
        router.refresh();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Sorting failed");
      })
      .finally(() => sortingStore.finish(dumpId));
  }

  async function save() {
    const body = text.trim();
    if (!body || saving) return;

    const capturedAt = new Date().toISOString();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    setText("");
    setError(null);
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

      setFlash(hasKey ? "Saved — sorting it now" : "Saved");
      window.setTimeout(() => setFlash(null), 2600);
      if (hasKey) sortInBackground(saved.id);
    } catch (err) {
      setText((current) => current || body);
      setError(
        err instanceof Error ? `Couldn't save that. ${err.message}` : "Couldn't save that."
      );
    } finally {
      setSaving(false);
    }
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
            <div className="flex items-center justify-between gap-3 px-4 pb-2.5 pt-1">
              <span className="font-data text-[0.68rem] text-ink-faint">
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

            {!hasKey && !flash && (
              <p className="rounded-xl bg-amber-soft px-3.5 py-2.5 text-center text-[0.78rem] text-amber">
                Everything you write is saved.{" "}
                <Link href="/settings" className="underline underline-offset-2">
                  Add an API key
                </Link>{" "}
                to have it sorted.
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-blush-soft px-3.5 py-2.5 text-center text-[0.78rem] text-blush"
              >
                {error}
                {needsKey && (
                  <>
                    {" "}
                    <Link href="/settings" className="underline underline-offset-2">
                      Open settings
                    </Link>
                  </>
                )}
              </p>
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
