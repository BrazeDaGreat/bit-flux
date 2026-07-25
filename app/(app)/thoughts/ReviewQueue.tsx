"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import Sheet from "@/components/Sheet";
import { useIsCompact } from "@/lib/breakpoint";
import { pb } from "@/lib/pb";
import type { ThoughtRecord } from "@/lib/types";

/** Kept short — this is prompt context, not an audit log. */
const MAX_CORRECTIONS = 20;

/**
 * Same calm row as the Thoughts list: closed, it's just a title. The decisions
 * only appear once you've opened the one you're deciding about, so a queue of
 * twelve doesn't present sixty buttons at once.
 */
export default function ReviewQueue({
  initialItems,
  settingsId,
  corrections,
  onResolved,
  onLeave,
}: {
  initialItems: ThoughtRecord[];
  settingsId: string | null;
  corrections: string[];
  /** Lets the tab count drop the moment a decision is made. */
  onResolved: (id: string) => void;
  onLeave: () => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [learned, setLearned] = useState(corrections);
  const [open, setOpen] = useState<string | null>(initialItems[0]?.id ?? null);
  const [merging, setMerging] = useState<string[]>([]);
  const [splitting, setSplitting] = useState<ThoughtRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  function drop(id: string) {
    setItems((prev) => {
      const next = prev.filter((t) => t.id !== id);
      // Move straight to the next one — the queue is a task, not a list.
      setOpen((current) => (current === id ? (next[0]?.id ?? null) : current));
      return next;
    });
    setMerging((prev) => prev.filter((s) => s !== id));
    onResolved(id);
  }

  /**
   * A correction is worth more than the single fix: it goes into the prompt
   * for future dumps, so the same mistake stops recurring.
   */
  async function remember(note: string) {
    if (!settingsId) return;
    const next = [...learned.filter((c) => c !== note), note].slice(-MAX_CORRECTIONS);
    setLearned(next);
    try {
      // Only the prefs field is sent, so the stored API key is untouched.
      await pb()
        .collection("flux_settings")
        .update(settingsId, { prefs: { corrections: next } });
    } catch {
      // Learning is a bonus; never block the correction itself on it.
    }
  }

  async function snapshot(thought: ThoughtRecord, reason: string) {
    await pb().collection("flux_thought_versions").create({
      user: thought.user,
      thought: thought.id,
      snapshot: thought,
      reason,
    });
  }

  async function accept(thought: ThoughtRecord) {
    await pb().collection("flux_thoughts").update(thought.id, { needs_review: false });
    drop(thought.id);
    router.refresh();
  }

  async function merge() {
    if (merging.length !== 2) return;
    const [first, second] = merging.map((id) => items.find((t) => t.id === id)!);
    try {
      await snapshot(first, "merge");
      await pb()
        .collection("flux_thoughts")
        .update(first.id, {
          body: `${first.body}\n\n${second.body}`.trim(),
          tags: [...new Set([...(first.tags ?? []), ...(second.tags ?? [])])],
          needs_review: false,
          edited_at: new Date().toISOString(),
        });
      await pb().collection("flux_thoughts").delete(second.id);
      void remember(
        `Don't split thoughts like “${first.title.slice(0, 50)}” and “${second.title.slice(0, 50)}” apart — they belong together.`
      );
      drop(first.id);
      drop(second.id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't merge those");
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong px-5 py-10 text-center">
        <p className="font-hand text-[1.05rem] text-ink">Nothing to check.</p>
        <p className="mt-1 text-[0.8rem] text-ink-soft">
          Thoughts land here when the AI wasn&apos;t confident about the split,
          tags, or a date.
        </p>
        <button
          type="button"
          onClick={onLeave}
          className="mt-3 rounded-full border border-line-strong px-4 py-1.5 text-[0.8rem] text-ink-soft hover:border-iris hover:text-ink max-lg:h-11 max-lg:px-5 max-lg:text-[0.95rem]"
        >
          Back to open
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[52ch] text-[0.8rem] leading-relaxed text-ink-soft max-lg:text-[0.95rem]">
        The AI wasn&apos;t sure about these. What you decide here is what it
        learns from.
      </p>

      {merging.length === 2 && (
        <div className="flex items-center gap-3 rounded-xl bg-iris-soft px-3.5 py-2.5 max-lg:flex-col max-lg:items-stretch max-lg:gap-2">
          <span className="text-[0.8rem] text-iris max-lg:text-[0.95rem]">
            Two picked.
          </span>
          <button
            type="button"
            onClick={() => void merge()}
            className="rounded-full bg-iris px-3 py-1 text-[0.76rem] text-white dark:text-[#1a1622] max-lg:h-11 max-lg:text-[0.95rem]"
          >
            Make them one
          </button>
          <button
            type="button"
            onClick={() => setMerging([])}
            className="text-[0.76rem] text-iris hover:underline max-lg:h-11 max-lg:text-[0.95rem]"
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <p className="text-[0.78rem] text-blush max-lg:text-[0.95rem]">{error}</p>
      )}

      <ul>
        {items.map((thought) => (
          <ReviewRow
            key={thought.id}
            thought={thought}
            expanded={open === thought.id}
            picked={merging.includes(thought.id)}
            onToggle={() => setOpen(open === thought.id ? null : thought.id)}
            onPick={() =>
              setMerging((prev) =>
                prev.includes(thought.id)
                  ? prev.filter((id) => id !== thought.id)
                  : [...prev, thought.id].slice(-2)
              )
            }
            onAccept={() => void accept(thought)}
            onSplit={() => setSplitting(thought)}
          />
        ))}
      </ul>

      {splitting && (
        <SplitDialog
          thought={splitting}
          onClose={() => setSplitting(null)}
          onDone={(id) => {
            drop(id);
            setSplitting(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ReviewRow({
  thought,
  expanded,
  picked,
  onToggle,
  onPick,
  onAccept,
  onSplit,
}: {
  thought: ThoughtRecord;
  expanded: boolean;
  picked: boolean;
  onToggle: () => void;
  onPick: () => void;
  onAccept: () => void;
  onSplit: () => void;
}) {
  const sure = Math.round((thought.confidence ?? 0) * 100);

  if (!expanded) {
    return (
      <li className="border-b border-line/60 last:border-b-0">
        <button
          type="button"
          onClick={onToggle}
          className={`flex w-full items-center gap-3 rounded-lg px-1.5 py-2.5 text-left transition-colors hover:bg-surface-2 max-lg:min-h-[3.5rem] ${
            picked ? "bg-iris-soft" : ""
          }`}
        >
          <span className="min-w-0 flex-1 truncate text-[0.88rem] text-ink max-lg:text-[0.95rem]">
            {thought.title}
          </span>
          <span className="shrink-0 font-data text-[0.62rem] text-ink-faint max-lg:text-[0.75rem]">
            {sure}%
          </span>
        </button>
      </li>
    );
  }

  return (
    <li className="border-b border-line/60 last:border-b-0">
      <article
        className={`my-1 overflow-hidden rounded-xl border bg-surface-2 ${
          picked ? "border-iris" : "border-line"
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-start gap-2.5 px-3.5 pt-3 text-left"
        >
          <h3 className="min-w-0 flex-1 text-[1rem] font-semibold leading-snug tracking-[-0.01em] text-ink">
            {thought.title}
          </h3>
        </button>

        <div className="px-3.5 pb-3">
          <p className="mt-1.5 font-hand text-[0.95rem] leading-[1.6] text-ink">
            {thought.body}
          </p>

          <p className="mt-2 font-data text-[0.64rem] text-ink-soft max-lg:text-[0.75rem]">
            {sure}% sure
            {thought.date_source_text
              ? ` · read “${thought.date_source_text}” as a date`
              : ""}
          </p>

          <div className="mt-3 border-t border-ink/10 pt-2.5">
            <p className="font-data text-[0.62rem] uppercase tracking-[0.1em] text-ink-soft max-lg:text-[0.75rem]">
              is this right?
            </p>
            {/* Four answers to one question. On a pointer they wrap along a
                line; under a thumb they are a fixed two-by-two, so the same
                answer is always in the same corner. */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 max-lg:grid max-lg:grid-cols-2 max-lg:gap-2">
              <button
                type="button"
                onClick={onAccept}
                className="rounded-full bg-surface px-3 py-1.5 text-[0.76rem] font-medium text-ink transition-opacity hover:opacity-80 max-lg:h-11 max-lg:bg-iris max-lg:text-[0.9rem] max-lg:text-white dark:max-lg:text-[#1a1622]"
              >
                Yes, keep it
              </button>
              <Link
                href={`/thoughts/${thought.id}`}
                className="rounded-full px-2.5 py-1.5 text-[0.76rem] text-ink-soft hover:text-ink max-lg:grid max-lg:h-11 max-lg:place-items-center max-lg:border max-lg:border-line-strong max-lg:text-[0.9rem]"
              >
                Edit fully
              </Link>
              <button
                type="button"
                onClick={onSplit}
                className="rounded-full px-2.5 py-1.5 text-[0.76rem] text-ink-soft hover:text-ink max-lg:h-11 max-lg:border max-lg:border-line-strong max-lg:text-[0.9rem]"
              >
                Split in two
              </button>
              <button
                type="button"
                onClick={onPick}
                className={`rounded-full px-2.5 py-1.5 text-[0.76rem] max-lg:h-11 max-lg:border max-lg:text-[0.9rem] ${
                  picked
                    ? "text-iris max-lg:border-iris max-lg:bg-iris-soft"
                    : "text-ink-soft hover:text-ink max-lg:border-line-strong"
                }`}
              >
                {picked ? "Picked to merge" : "Merge with another"}
              </button>
            </div>
          </div>
        </div>
      </article>
    </li>
  );
}

function SplitDialog({
  thought,
  onClose,
  onDone,
}: {
  thought: ThoughtRecord;
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const [first, setFirst] = useState(thought.body);
  const [second, setSecond] = useState("");
  const [busy, setBusy] = useState(false);
  const compact = useIsCompact();

  async function split() {
    if (!second.trim()) return;
    setBusy(true);
    // The new thought keeps the same source dump, so both halves still trace
    // back to what was actually written.
    await pb().collection("flux_thoughts").create({
      user: thought.user,
      dump: thought.dump,
      dump_index: thought.dump_index + 1,
      title: second.trim().slice(0, 60),
      body: second.trim(),
      status: "open",
      tags: thought.tags ?? [],
      confidence: 1,
      needs_review: false,
      edited_at: new Date().toISOString(),
    });
    await pb().collection("flux_thoughts").update(thought.id, {
      body: first.trim(),
      needs_review: false,
      edited_at: new Date().toISOString(),
    });
    onDone(thought.id);
  }

  const fields = (
    <>
      <p className="mt-1 text-[0.78rem] text-ink-soft max-lg:mt-0 max-lg:text-[0.95rem] max-lg:leading-snug">
        Move the second idea into the lower box. Both halves keep the same
        original message.
      </p>
      <textarea
        value={first}
        onChange={(e) => setFirst(e.target.value)}
        rows={3}
        aria-label="The first thought"
        className="input mt-3 font-hand"
      />
      <textarea
        value={second}
        onChange={(e) => setSecond(e.target.value)}
        rows={3}
        placeholder="The second thought…"
        aria-label="The second thought"
        className="input mt-2 font-hand"
      />
    </>
  );

  // With a keyboard up, a centred `fixed inset-0` card puts its buttons below
  // the fold of a screen that is now half the height it was — the two controls
  // that finish the job are simply gone. In a sheet they are pinned to a footer
  // the keyboard cannot cover.
  if (compact) {
    return (
      <Sheet
        open
        onClose={onClose}
        title="Split this in two"
        footer={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void split()}
              disabled={!second.trim() || busy}
              className="tap flex-1 rounded-full bg-iris text-[0.95rem] font-medium text-white disabled:opacity-40 dark:text-[#1a1622]"
            >
              {busy ? "Splitting…" : "Split"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="tap rounded-full px-4 text-[0.95rem] text-ink-soft"
            >
              Cancel
            </button>
          </div>
        }
      >
        {fields}
      </Sheet>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-window)]">
        <h2 className="text-[0.95rem] font-semibold text-ink">Split this in two</h2>
        {fields}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void split()}
            disabled={!second.trim() || busy}
            className="rounded-full bg-iris px-4 py-1.5 text-[0.8rem] font-medium text-white disabled:opacity-40 dark:text-[#1a1622]"
          >
            {busy ? "Splitting…" : "Split"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-[0.8rem] text-ink-soft hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
