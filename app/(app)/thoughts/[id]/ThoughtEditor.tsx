"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Caret, TagChip } from "@/components/Chips";
import { pb } from "@/lib/pb";
import { statusPatch } from "@/lib/thought-actions";
import { clockTime, relativeTime, toDate } from "@/lib/time";
import type {
  DumpRecord,
  TagRecord,
  ThoughtRecord,
  ThoughtVersionRecord,
} from "@/lib/types";

const STATUSES = [
  { value: "open", label: "Open", tone: "iris" },
  { value: "done", label: "Done", tone: "mint" },
  { value: "archived", label: "Archived", tone: "sage" },
] as const;

/** PocketBase wants "YYYY-MM-DD HH:mm"; the input gives "YYYY-MM-DDTHH:mm". */
function toInput(value: string): string {
  if (!value) return "";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * The page reads in two voices, so it is set in two columns. The left is the
 * thought as you wrote it — title, body, and the message it came from. The
 * right is what the app knows about it — status, dates, tags, history.
 * Nothing in the rail interrupts the reading, and nothing in the reading
 * column asks to be operated.
 */
export default function ThoughtEditor({
  thought: initial,
  dump,
  siblings,
  allTags,
  versions,
}: {
  thought: ThoughtRecord;
  dump: DumpRecord | null;
  siblings: ThoughtRecord[];
  allTags: TagRecord[];
  versions: ThoughtVersionRecord[];
}) {
  const router = useRouter();
  const [thought, setThought] = useState(initial);
  const [showRaw, setShowRaw] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Every user edit snapshots the previous state first, so nothing is lost. */
  async function patch(data: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      await pb().collection("flux_thought_versions").create({
        user: thought.user,
        thought: thought.id,
        snapshot: thought,
        reason: "user_edit",
      });
      const updated = await pb()
        .collection("flux_thoughts")
        .update<ThoughtRecord>(thought.id, {
          ...data,
          edited_at: new Date().toISOString(),
          // Editing it is the review.
          needs_review: false,
        });
      setThought(updated);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that change");
    } finally {
      setSaving(false);
    }
  }

  async function restore(version: ThoughtVersionRecord) {
    const snap = version.snapshot as Partial<ThoughtRecord>;
    await patch({
      title: snap.title,
      body: snap.body,
      tags: snap.tags,
      action_date: snap.action_date ?? "",
      deadline: snap.deadline ?? "",
      reminder_at: snap.reminder_at ?? "",
      resurface_at: snap.resurface_at ?? "",
    });
  }

  async function remove() {
    await pb().collection("flux_thoughts").delete(thought.id);
    router.push("/thoughts");
    router.refresh();
  }

  function toggleTag(tagId: string) {
    const current = thought.tags ?? [];
    void patch({
      tags: current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    });
  }

  const approved = allTags.filter((t) => t.approved);
  const onTags = approved.filter((t) => (thought.tags ?? []).includes(t.id));
  const offTags = approved.filter((t) => !(thought.tags ?? []).includes(t.id));

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-7 sm:px-8">
      <div className="flex items-center gap-4">
        {/* Below `lg` the way back is the arrow in the top bar, which is where
            a phone puts it on every other screen. */}
        <Link
          href="/thoughts"
          className="font-data text-[0.7rem] text-ink-faint hover:text-ink max-lg:hidden"
        >
          ← all thoughts
        </Link>
        <span
          className="min-w-0 flex-1 truncate text-center font-data text-[0.68rem]"
          role="status"
          aria-live="polite"
        >
          {error ? (
            <span className="text-blush">{error}</span>
          ) : saving ? (
            <span className="text-ink-faint">saving…</span>
          ) : null}
        </span>
        <Link
          href={{
            pathname: "/ask",
            query: {
              q: `What else do I have about ${thought.title}?`,
            },
          }}
          className="shrink-0 font-data text-[0.7rem] text-iris hover:underline max-lg:hidden"
        >
          ask about this →
        </Link>
      </div>

      {/* 768px holds a 15rem rail beside the reading column with ~450px left
          for the body, which is a comfortable measure — so the two voices
          separate at `md`, not only at `lg`. */}
      <div className="mt-5 grid gap-x-8 gap-y-7 md:grid-cols-[minmax(0,1fr)_15rem] lg:grid-cols-[minmax(0,1fr)_16rem]">
        {/* Your words. */}
        <div className="min-w-0">
          <div className="flex items-start">
            <input
              defaultValue={thought.title}
              aria-label="Title"
              onBlur={(e) =>
                e.target.value !== thought.title &&
                void patch({ title: e.target.value })
              }
              className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 font-hand text-[1.5rem] leading-tight tracking-[-0.01em] text-ink outline-none transition-colors hover:border-line focus:border-iris max-lg:border-line"
            />
          </div>

          {/* The most-used control on the page. On a phone it goes directly
              under the title rather than below however long the body turns out
              to be. */}
          <div className="mt-3 md:hidden">
            <StatusControl
              status={thought.status}
              onPick={(next) => void patch(statusPatch(next))}
            />
          </div>

          <textarea
            defaultValue={thought.body}
            aria-label="Body"
            placeholder="Add anything else worth keeping…"
            onBlur={(e) =>
              e.target.value !== thought.body && void patch({ body: e.target.value })
            }
            rows={6}
            className="mt-2 w-full resize-y rounded-lg border border-transparent bg-transparent px-1.5 py-1 font-hand text-[1rem] leading-[1.65] text-ink outline-none transition-colors placeholder:text-ink-faint hover:border-line focus:border-iris max-lg:border-line"
          />

          {/* A border that only exists on hover tells a thumb nothing, so below
              `lg` both fields keep a hairline and the instruction matches the
              gesture the reader has. */}
          <p className="px-1.5 font-data text-[0.66rem] leading-relaxed text-ink-faint max-lg:hidden">
            Click any line to edit. Changes save when you click away.
          </p>
          <p className="hidden px-1.5 font-data text-[0.75rem] leading-relaxed text-ink-faint max-lg:block">
            Tap any line to edit. Changes save when you tap away.
          </p>

          {dump && (
            <div className="mt-6 border-t border-line pt-3">
              <button
                type="button"
                onClick={() => setShowRaw(!showRaw)}
                aria-expanded={showRaw}
                aria-controls="original-message"
                className="group flex items-center gap-2 rounded-lg px-1.5 py-1 font-data text-[0.66rem] uppercase tracking-[0.12em] text-ink-faint transition-colors hover:text-ink"
              >
                <Caret open={showRaw} />
                the message this came from
              </button>

              {showRaw && (
                <div
                  id="original-message"
                  className="mt-2 rounded-xl bg-surface-2 p-3.5 motion-safe:animate-[flux-unfold_180ms_ease-out]"
                >
                  <p className="whitespace-pre-wrap font-hand text-[0.95rem] leading-[1.6] text-ink">
                    {dump.text}
                  </p>
                  <p className="mt-2 font-data text-[0.66rem] text-ink-faint">
                    captured {clockTime(dump.captured_at || dump.created)} ·{" "}
                    {relativeTime(dump.captured_at || dump.created)}
                    {dump.model_used ? ` · sorted by ${dump.model_used}` : ""}
                  </p>

                  {siblings.length > 0 && (
                    <div className="mt-3 border-t border-line pt-3">
                      <p className="font-data text-[0.66rem] uppercase tracking-[0.1em] text-ink-faint">
                        it also became
                      </p>
                      <ul className="mt-1.5 flex flex-col gap-1">
                        {siblings.map((sibling) => (
                          <li key={sibling.id}>
                            <Link
                              href={`/thoughts/${sibling.id}`}
                              className="text-[0.82rem] text-ink-soft hover:text-iris"
                            >
                              {sibling.dump_index + 1}. {sibling.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* What the app knows. */}
        <aside
          className="min-w-0 border-t pt-6 md:border-l md:border-t-0 md:pl-6 md:pt-0"
          style={{ borderColor: "var(--line-strong)" }}
        >
          {thought.needs_review && (
            <p className="mb-4 font-data text-[0.66rem] leading-relaxed text-amber">
              The AI wasn&apos;t sure about this one. Editing anything clears the
              flag.
            </p>
          )}

          {/* Drawn under the title instead below `md`, where there is no rail
              to put it in — same control, moved. */}
          <Field label="Status" className="max-md:hidden">
            <StatusControl
              status={thought.status}
              onPick={(next) => void patch(statusPatch(next))}
            />
          </Field>

          <Field label="Dates">
            <div className="flex flex-col">
              <DateRow
                label="Do"
                value={thought.action_date}
                onChange={(v) => void patch({ action_date: v })}
              />
              <DateRow
                label="Due"
                value={thought.deadline}
                onChange={(v) => void patch({ deadline: v })}
              />
              <DateRow
                label="Remind"
                value={thought.reminder_at}
                onChange={(v) => void patch({ reminder_at: v })}
              />
              <DateRow
                label="Bring back"
                value={thought.resurface_at}
                onChange={(v) => void patch({ resurface_at: v })}
              />
            </div>
            {thought.date_source_text && (
              <p className="mt-2 font-data text-[0.66rem] leading-relaxed text-ink-faint">
                you wrote “{thought.date_source_text}”
                {thought.date_precision && thought.date_precision !== "exact"
                  ? ` · read as a ${thought.date_precision}`
                  : ""}
              </p>
            )}
          </Field>

          <Field label="Tags">
            {approved.length === 0 ? (
              <p className="text-[0.76rem] leading-relaxed text-ink-soft">
                No tags yet.{" "}
                <Link href="/tags" className="text-iris underline underline-offset-2">
                  Create some
                </Link>{" "}
                and the AI will start using them.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-1.5 max-lg:gap-2">
                  {onTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      title={`Remove ${tag.name}`}
                      className="rounded-full transition-opacity hover:opacity-60 max-lg:inline-flex max-lg:h-11 max-lg:items-center max-lg:px-1"
                    >
                      <TagChip name={tag.name} color={tag.color || "iris"} />
                    </button>
                  ))}
                  {offTags.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAddingTag(!addingTag)}
                      aria-expanded={addingTag}
                      className="rounded-full border border-line-strong px-2 py-0.5 text-[0.7rem] text-ink-soft transition-colors hover:border-iris hover:text-ink max-lg:h-11 max-lg:px-4 max-lg:text-[0.9rem]"
                    >
                      {addingTag ? "done" : "+ tag"}
                    </button>
                  )}
                </div>
                {addingTag && (
                  <div className="mt-2 flex flex-wrap gap-1.5 motion-safe:animate-[flux-unfold_180ms_ease-out] max-lg:gap-2">
                    {offTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        title={`Add ${tag.name}`}
                        className="rounded-full opacity-55 transition-opacity hover:opacity-100 max-lg:inline-flex max-lg:h-11 max-lg:items-center max-lg:px-1 max-lg:opacity-100"
                      >
                        <TagChip name={tag.name} color={tag.color || "iris"} />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </Field>

          {(thought.people?.length ?? 0) > 0 && (
            <Field label="People">
              <div className="flex flex-wrap gap-1.5">
                {thought.people?.map((person) => (
                  <TagChip key={person.name} name={person.name} color="sky" />
                ))}
              </div>
            </Field>
          )}

          <Field label="History">
            <ul className="flex flex-col gap-1 font-data text-[0.66rem] text-ink-faint">
              <li suppressHydrationWarning>
                captured {relativeTime(dump?.captured_at || thought.created)}
              </li>
              {dump?.processed_at && (
                <li suppressHydrationWarning>sorted {relativeTime(dump.processed_at)}</li>
              )}
              {thought.edited_at && (
                <li suppressHydrationWarning>
                  you edited it {relativeTime(thought.edited_at)}
                </li>
              )}
              <li>the AI was {Math.round((thought.confidence ?? 0) * 100)}% sure</li>
            </ul>

            {versions.length > 1 && (
              <details className="mt-2">
                <summary className="cursor-pointer font-data text-[0.66rem] text-ink-soft">
                  earlier versions ({versions.length})
                </summary>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {versions.map((version) => (
                    <li key={version.id} className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate font-data text-[0.66rem] text-ink-faint">
                        {(version.snapshot as { title?: string }).title ?? "untitled"}
                      </span>
                      <button
                        type="button"
                        onClick={() => void restore(version)}
                        className="shrink-0 text-[0.7rem] text-iris hover:underline"
                      >
                        restore
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Field>

          {/* The desktop puts this at the top of the page, where a phone has a
              back arrow and a title and no third slot. It is a secondary
              action, so below `lg` it joins the other secondary actions at the
              end of the rail. */}
          <Link
            href={{
              pathname: "/ask",
              query: {
                q: `What else do I have about ${thought.title}?`,
              },
            }}
            className="mt-6 hidden h-11 items-center justify-center rounded-full border border-line-strong text-[0.95rem] text-iris max-lg:flex"
          >
            ask about this →
          </Link>

          <div className="mt-6 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => void remove()}
              className="text-[0.74rem] text-ink-faint transition-colors hover:text-blush max-lg:h-11 max-lg:text-[0.95rem]"
            >
              Delete this thought
            </button>
            <p className="mt-1 text-[0.68rem] leading-relaxed text-ink-faint max-lg:text-[0.8rem]">
              The original message stays — only this organised version goes.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** A labelled block in the rail. Spacing carries the grouping; only the first
 *  field needs no rule above it, so no dividers are drawn at all. */
function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`mb-5 last:mb-0 ${className}`}>
      <h2 className="mb-1.5 font-data text-[0.62rem] uppercase tracking-[0.14em] text-ink-faint max-lg:text-[0.75rem]">
        {label}
      </h2>
      {children}
    </section>
  );
}

/** Three states, one control, drawn the same wherever it lands — the rail on a
 *  desktop, directly under the title on a phone. */
function StatusControl({
  status,
  onPick,
}: {
  status: ThoughtRecord["status"];
  onPick: (status: (typeof STATUSES)[number]["value"]) => void;
}) {
  return (
    <div
      className="flex rounded-full border p-0.5"
      style={{ borderColor: "var(--line-strong)" }}
      role="group"
      aria-label="Status"
    >
      {STATUSES.map((option) => {
        const on = status === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onPick(option.value)}
            aria-pressed={on}
            className={`flex-1 rounded-full py-1 text-[0.72rem] transition-colors max-lg:h-11 max-lg:text-[0.9rem] ${
              on ? "" : "text-ink-soft hover:text-ink"
            }`}
            style={
              on
                ? {
                    background: `var(--${option.tone}-soft)`,
                    color: `var(--${option.tone})`,
                  }
                : undefined
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A date reads as a line of text until you click it. Four permanently open
 * datetime pickers is four times the chrome for something that is usually
 * already right.
 */
function DateRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <label className="flex flex-col gap-1 py-1 max-lg:py-2">
        <span className="font-data text-[0.66rem] text-ink-soft max-lg:text-[0.8rem]">
          {label}
        </span>
        <input
          type="datetime-local"
          autoFocus
          defaultValue={toInput(value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          onBlur={(e) => {
            const next = e.target.value
              ? new Date(e.target.value).toISOString()
              : "";
            setEditing(false);
            if (next !== value) onChange(next);
          }}
          className="input py-1.5 font-data lg:text-[0.72rem]"
        />
      </label>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group flex items-baseline justify-between gap-2 rounded-lg py-1 text-left max-lg:min-h-[var(--tap)] max-lg:items-center max-lg:border-b max-lg:border-line max-lg:px-1"
    >
      <span className="shrink-0 font-data text-[0.66rem] text-ink-soft max-lg:text-[0.8rem]">
        {label}
      </span>
      <span
        className={`min-w-0 text-right text-[0.74rem] transition-colors max-lg:text-[0.95rem] ${
          value
            ? "text-ink"
            : "text-ink-faint group-hover:text-ink-soft"
        }`}
        suppressHydrationWarning
      >
        {value ? shortDate(value) : "set a date"}
      </span>
    </button>
  );
}

/** Compact enough for the rail: "Sat 25 Jul, 12:00 AM". */
function shortDate(value: string): string {
  const date = toDate(value);
  return `${date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  })}, ${date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
