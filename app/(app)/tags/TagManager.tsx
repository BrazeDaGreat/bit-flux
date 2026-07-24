"use client";

import { useState } from "react";

import { pb } from "@/lib/pb";
import { TAG_COLORS, type TagRecord } from "@/lib/types";

/**
 * A tag is a name and an explanation of when to use it — so a row shows
 * exactly those two things and nothing else. Editing happens in place;
 * there is no separate form, no colour picker, no counters competing with
 * the words that actually teach the AI.
 */
export default function TagManager({
  userId,
  initialTags,
}: {
  userId: string;
  initialTags: TagRecord[];
}) {
  const [tags, setTags] = useState(initialTags);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const approved = tags.filter((t) => t.approved);
  const suggested = tags.filter((t) => !t.approved);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const record = await pb().collection("flux_tags").create<TagRecord>({
        user: userId,
        name: trimmed,
        description: description.trim(),
        color: TAG_COLORS[tags.length % TAG_COLORS.length],
        origin: "user",
        approved: true,
        usage_count: 0,
      });
      setTags((prev) => [...prev, record]);
      setName("");
      setDescription("");
      setAdding(false);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error && /unique/i.test(err.message)
          ? "You already have a tag with that name."
          : "Couldn't create that tag."
      );
    }
  }

  async function patch(id: string, data: Partial<TagRecord>) {
    const record = await pb().collection("flux_tags").update<TagRecord>(id, data);
    setTags((prev) => prev.map((t) => (t.id === id ? record : t)));
  }

  async function remove(id: string) {
    await pb().collection("flux_tags").delete(id);
    setTags((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      {suggested.length > 0 && (
        <section className="rounded-2xl border border-dashed border-line-strong bg-surface-2 p-3.5">
          <p className="mb-1.5 font-data text-[0.64rem] uppercase tracking-[0.14em] text-ink-faint">
            the ai noticed these
          </p>
          <ul className="flex flex-col gap-1">
            {suggested.map((tag) => (
              <li
                key={tag.id}
                className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 rounded-lg px-1.5 py-2"
              >
                <span className="text-[0.88rem] font-medium text-ink">{tag.name}</span>
                <span className="min-w-0 flex-1 text-[0.78rem] text-ink-soft">
                  {tag.description || "No description"}
                </span>
                <button
                  type="button"
                  onClick={() => void patch(tag.id, { approved: true })}
                  className="rounded-full bg-mint-soft px-2.5 py-1 text-[0.72rem] text-mint"
                >
                  Keep
                </button>
                <button
                  type="button"
                  onClick={() => void remove(tag.id)}
                  className="text-[0.72rem] text-ink-faint hover:text-blush"
                >
                  No
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        {suggested.length > 0 && approved.length > 0 && (
          <p className="mb-1.5 font-data text-[0.64rem] uppercase tracking-[0.14em] text-ink-faint">
            your tags
          </p>
        )}
        {approved.length === 0 && !adding ? (
          <p className="px-1.5 text-[0.84rem] leading-relaxed text-ink-soft">
            No tags yet. Add the ones you already think in — a project, a
            person, a theme you keep returning to.
          </p>
        ) : (
          <ul className="flex flex-col">
            {approved.map((tag) => (
              <li key={tag.id} className="border-b border-line/60 last:border-b-0">
                {editing === tag.id ? (
                  <div className="flex flex-col gap-2 px-1.5 py-3">
                    <input
                      defaultValue={tag.name}
                      onBlur={(e) =>
                        e.target.value.trim() &&
                        e.target.value !== tag.name &&
                        void patch(tag.id, { name: e.target.value.trim() })
                      }
                      className="input"
                    />
                    <textarea
                      defaultValue={tag.description}
                      onBlur={(e) => void patch(tag.id, { description: e.target.value })}
                      placeholder="When should this be used? Write it the way you'd explain it to someone."
                      className="input"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="rounded-full bg-iris px-3.5 py-1.5 text-[0.76rem] font-medium text-white dark:text-[#1a1622]"
                      >
                        Done
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(tag.id)}
                        className="text-[0.76rem] text-ink-faint hover:text-blush"
                      >
                        Delete tag
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing(tag.id)}
                    className="group flex w-full items-baseline gap-2.5 rounded-lg px-1.5 py-2.5 text-left transition-colors hover:bg-surface-2"
                  >
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full"
                      style={{ background: `var(--${tag.color || "iris"})` }}
                    />
                    <span className="shrink-0 text-[0.88rem] font-medium text-ink">
                      {tag.name}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[0.78rem] text-ink-soft">
                      {tag.description || "Add a description so the AI knows when to use it"}
                    </span>
                    <span className="shrink-0 font-data text-[0.62rem] text-ink-faint opacity-0 transition-opacity group-hover:opacity-100">
                      edit
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {adding ? (
        <section className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-2 p-3.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Aris"
            className="input"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Anything about my personal AI assistant — its tools, memory, integrations and development."
            className="input"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void create()}
              disabled={!name.trim()}
              className="rounded-full bg-iris px-4 py-1.5 text-[0.78rem] font-medium text-white disabled:opacity-40 dark:text-[#1a1622]"
            >
              Add tag
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              className="text-[0.78rem] text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
            {error && <span className="text-[0.76rem] text-blush">{error}</span>}
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="self-start rounded-full border border-line-strong px-4 py-1.5 text-[0.78rem] text-ink-soft transition-colors hover:border-iris hover:text-ink"
        >
          New tag
        </button>
      )}
    </div>
  );
}
