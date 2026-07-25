"use client";

import { useMemo, useState } from "react";

import { pb } from "@/lib/pb";
import { TAG_COLORS, type PersonRecord } from "@/lib/types";

/** One person as the screen sees them: a name, what they mean to you, and how
 *  often they've come up. A name the AI found while sorting has no record yet
 *  — writing a note is what creates one. */
interface Entry {
  key: string;
  name: string;
  note: string;
  /** null while the person exists only as a name on a thought. */
  id: string | null;
  mentions: number;
}

/** Colour is derived from the name so a person looks the same everywhere and
 *  nobody has to pick one. */
function toneOf(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/**
 * The people half of this screen. It reads as a roster: everyone the AI has
 * pulled out of what you wrote, plus anyone you add yourself, sorted by how
 * present they are. Notes are optional and exist for one reason — telling the
 * AI which Sam you mean.
 */
export default function PeopleManager({
  userId,
  initialPeople,
  mentions,
}: {
  userId: string;
  initialPeople: PersonRecord[];
  mentions: Record<string, number>;
}) {
  const [people, setPeople] = useState(initialPeople);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const entries = useMemo<Entry[]>(() => {
    const byKey = new Map<string, Entry>();

    for (const person of people) {
      const key = person.name.toLowerCase();
      byKey.set(key, {
        key,
        name: person.name,
        note: person.note ?? "",
        id: person.id,
        mentions: 0,
      });
    }

    for (const [mentioned, count] of Object.entries(mentions)) {
      const key = mentioned.toLowerCase();
      const found = byKey.get(key);
      if (found) found.mentions += count;
      else byKey.set(key, { key, name: mentioned, note: "", id: null, mentions: count });
    }

    return [...byKey.values()].sort(
      (a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name)
    );
  }, [people, mentions]);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const record = await pb().collection("flux_people").create<PersonRecord>({
        user: userId,
        name: trimmed,
        note: note.trim(),
        origin: "user",
      });
      setPeople((prev) => [...prev, record]);
      setName("");
      setNote("");
      setAdding(false);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error && /unique/i.test(err.message)
          ? "That person is already here."
          : "Couldn't add that person."
      );
    }
  }

  /** Saving a note on a name the AI found is what turns it into a record. */
  async function saveNote(entry: Entry, text: string) {
    if (text === entry.note) return;
    try {
      if (entry.id) {
        const record = await pb()
          .collection("flux_people")
          .update<PersonRecord>(entry.id, { note: text });
        setPeople((prev) => prev.map((p) => (p.id === entry.id ? record : p)));
      } else {
        const record = await pb().collection("flux_people").create<PersonRecord>({
          user: userId,
          name: entry.name,
          note: text,
          origin: "ai_seen",
        });
        setPeople((prev) => [...prev, record]);
      }
      setError(null);
    } catch {
      setError("That note didn't save.");
    }
  }

  async function rename(entry: Entry, next: string) {
    if (!entry.id || !next.trim() || next === entry.name) return;
    const record = await pb()
      .collection("flux_people")
      .update<PersonRecord>(entry.id, { name: next.trim() });
    setPeople((prev) => prev.map((p) => (p.id === entry.id ? record : p)));
  }

  async function remove(entry: Entry) {
    if (!entry.id) return;
    await pb().collection("flux_people").delete(entry.id);
    setPeople((prev) => prev.filter((p) => p.id !== entry.id));
    setOpen(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {entries.length === 0 && !adding ? (
        <p className="px-1.5 text-[0.84rem] leading-relaxed text-ink-soft max-lg:text-[0.95rem]">
          Nobody yet. Names appear here on their own as soon as you write about
          someone — or add the ones you already know you&apos;ll mention.
        </p>
      ) : (
        <ul className="flex flex-col">
          {entries.map((entry) => {
            const tone = toneOf(entry.name);
            return (
              <li key={entry.key} className="border-b border-line/60 last:border-b-0">
                {open === entry.key ? (
                  <div className="flex flex-col gap-2 px-1.5 py-3">
                    <div className="flex items-center gap-2.5">
                      <Monogram name={entry.name} tone={tone} />
                      {entry.id ? (
                        <input
                          defaultValue={entry.name}
                          onBlur={(e) => void rename(entry, e.target.value)}
                          aria-label="Name"
                          className="input"
                        />
                      ) : (
                        <span
                          className="min-w-0 truncate text-[0.88rem] font-medium text-ink max-lg:text-[0.95rem]"
                          title="This name comes from your thoughts, so it can't be renamed here"
                        >
                          {entry.name}
                        </span>
                      )}
                    </div>
                    <textarea
                      defaultValue={entry.note}
                      onBlur={(e) => void saveNote(entry, e.target.value.trim())}
                      placeholder="Who are they to you? One line is plenty — it's what tells the AI which one you mean."
                      className="input"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setOpen(null)}
                        className="rounded-full bg-iris px-3.5 py-1.5 text-[0.76rem] font-medium text-white dark:text-[#1a1622] max-lg:h-11 max-lg:px-5 max-lg:text-[0.95rem]"
                      >
                        Done
                      </button>
                      {entry.id && (
                        <button
                          type="button"
                          onClick={() => void remove(entry)}
                          className="text-[0.76rem] text-ink-faint hover:text-blush max-lg:h-11 max-lg:text-[0.95rem]"
                        >
                          {entry.mentions > 0 ? "Forget the note" : "Remove person"}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpen(entry.key)}
                    className="group flex w-full items-center gap-2.5 rounded-lg px-1.5 py-2 text-left transition-colors hover:bg-surface-2 max-lg:min-h-[3.25rem]"
                  >
                    <Monogram name={entry.name} tone={tone} />
                    {/* `contents` on a desktop, so the name and the note are
                        still the row's own flex children and nothing there
                        moves. A column below it, because a name that cannot
                        shrink beside a note that must is how a row grows wider
                        than the screen. */}
                    <span className="min-w-0 flex-1 max-lg:flex max-lg:flex-col lg:contents">
                      <span className="truncate text-[0.88rem] font-medium text-ink max-lg:text-[0.95rem] lg:shrink-0">
                        {entry.name}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[0.78rem] text-ink-soft max-lg:text-[0.875rem]">
                        {entry.note || "Add a note so the AI knows who this is"}
                      </span>
                    </span>
                    <span
                      className="shrink-0 font-data text-[0.62rem] text-ink-faint max-lg:text-[0.75rem]"
                      title={`Mentioned in ${entry.mentions} ${entry.mentions === 1 ? "thought" : "thoughts"}`}
                    >
                      {entry.mentions > 0 ? entry.mentions : "—"}
                    </span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p className="px-1.5 text-[0.76rem] text-blush max-lg:text-[0.875rem]">
          {error}
        </p>
      )}

      {adding ? (
        <section className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-2 p-3.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Priya"
            aria-label="Name"
            className="input"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="My manager at work — most standups, reviews and one-to-ones are about her."
            className="input"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void create()}
              disabled={!name.trim()}
              className="rounded-full bg-iris px-4 py-1.5 text-[0.78rem] font-medium text-white disabled:opacity-40 dark:text-[#1a1622] max-lg:h-11 max-lg:px-5 max-lg:text-[0.95rem]"
            >
              Add person
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              className="text-[0.78rem] text-ink-soft hover:text-ink max-lg:h-11 max-lg:text-[0.95rem]"
            >
              Cancel
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="self-start rounded-full border border-line-strong px-4 py-1.5 text-[0.78rem] text-ink-soft transition-colors hover:border-iris hover:text-ink max-lg:h-11 max-lg:px-5 max-lg:text-[0.95rem]"
        >
          New person
        </button>
      )}
    </div>
  );
}

function Monogram({ name, tone }: { name: string; tone: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-data text-[0.58rem] font-medium max-lg:h-7 max-lg:w-7 max-lg:text-[0.68rem]"
      style={{ background: `var(--${tone}-soft)`, color: `var(--${tone})` }}
    >
      {initials(name)}
    </span>
  );
}
