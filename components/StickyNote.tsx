"use client";

import { useEffect, useRef, useState } from "react";

import { pb } from "@/lib/pb";
import type { DumpRecord } from "@/lib/types";

const DRAFT_KEY = "flux-sticky-draft";

/**
 * Capture, in a window small enough to leave open.
 *
 * This is the same act as the main screen and deliberately not the same object.
 * Capture is somewhere you go; this is something you leave on the edge of the
 * monitor and write into six times between two meetings. So it keeps only what
 * survives at 360×520 — a field, a count, a button — and drops everything that
 * assumes you came here on purpose: the heading, the model picker, the week,
 * the link to the archive.
 *
 * The band across the top is the gum strip of a real sticky note, and it is the
 * one decorative mark in here. It is also the whole reason the window is
 * recognisable at a glance in a stack of others, which is what a note pinned by
 * your screen has to be.
 *
 * Notes go into the same pile as everything else and are sorted by the same
 * model. A thought written here is not a lesser thought.
 */
export default function StickyNote({ userId }: { userId: string }) {
  const [text, setText] = useState(() =>
    typeof window === "undefined" ? "" : (localStorage.getItem(DRAFT_KEY) ?? "")
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewScrollTop, setPreviewScrollTop] = useState(0);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fieldRef.current?.focus();
  }, []);

  // Closing the window mid-sentence must not cost the sentence.
  useEffect(() => {
    if (text) localStorage.setItem(DRAFT_KEY, text);
    else localStorage.removeItem(DRAFT_KEY);
  }, [text]);

  async function save() {
    const body = text.trim();
    if (!body || saving) return;

    setSaving(true);
    setError(null);
    setText("");
    setPreviewScrollTop(0);
    fieldRef.current?.focus();
    fieldRef.current?.scrollTo({ top: 0 });

    try {
      const dump = await pb().collection("flux_dumps").create<DumpRecord>({
        user: userId,
        text: body,
        source: "web",
        captured_at: new Date().toISOString(),
        capture_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        status: "pending",
      });

      setSaved((count) => count + 1);
      setFlash("Saved — sorting it now");
      window.setTimeout(() => setFlash(null), 2400);

      // No model is sent: whatever the account is set to is the right answer
      // here, and there is no picker in this window to disagree with.
      void fetch(`/api/dumps/${dump.id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => {
        /* The note is saved either way; sorting can be retried on Capture. */
      });
    } catch {
      setText((current) => current || body);
      setError("Couldn't save that. It's still in the box.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sticky-window flex h-dvh flex-col bg-paper">
      {/* The gum strip. */}
      <div
        aria-hidden="true"
        className="h-2.5 w-full shrink-0"
        style={{
          background: "var(--apricot-soft)",
          boxShadow: "inset 0 -1px 0 var(--apricot)",
        }}
      />

      <div className="flex items-baseline gap-2 px-3.5 pb-1 pt-2.5">
        <h1 className="font-data text-[0.6rem] uppercase tracking-[0.16em] text-apricot">
          sticky
        </h1>
        <p
          role="status"
          className="ml-auto truncate font-data text-[0.6rem] text-ink-faint"
        >
          {error ? (
            <span className="text-blush">{error}</span>
          ) : flash ? (
            <span className="text-mint">{flash}</span>
          ) : saved > 0 ? (
            `${saved} saved`
          ) : (
            ""
          )}
        </p>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* Native textareas can defer contextual ligature shaping until a line
            is committed. This layer is the visible copy; the textarea remains
            on top for native input, caret, selection and clipboard behavior. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-3.5 py-1 font-sticky text-[1.02rem] leading-[1.55] text-ink"
          style={{ transform: `translateY(-${previewScrollTop}px)` }}
        >
          {text || <span className="text-ink-faint">jot it down…</span>}
        </div>
        <textarea
          ref={fieldRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onScroll={(event) => setPreviewScrollTop(event.currentTarget.scrollTop)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void save();
            }
          }}
          spellCheck={false}
          placeholder=""
          aria-label="Write a thought"
          className="flux-scroll relative z-10 h-full w-full resize-none bg-transparent px-3.5 py-1 font-sticky text-[1.02rem] leading-[1.55] text-transparent caret-ink outline-none placeholder:text-transparent"
        />
      </div>

      <div className="flex items-center gap-2 px-3 pb-3 pt-1.5">
        <span className="font-data text-[0.62rem] text-ink-faint">
          {text.trim() ? `${text.trim().length} characters` : "⌘↵ to save"}
        </span>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!text.trim() || saving}
          className="ml-auto rounded-full bg-apricot px-3.5 py-1.5 text-[0.78rem] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30 dark:text-[#1a1622]"
        >
          Save
        </button>
      </div>
    </div>
  );
}
