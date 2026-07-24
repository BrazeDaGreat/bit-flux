"use client";

import { useEffect, useState } from "react";

import { toDate } from "@/lib/time";

export interface ChatSummary {
  id: string;
  title: string;
  created: string;
}

/**
 * Chats are grouped by the day they started, not by the last reply, so a
 * conversation never moves out from under you when you add to it. Anything
 * older than a month falls into its own month, which is how people actually
 * remember when they asked something.
 */
function bucket(created: string, now: Date): string {
  const date = toDate(created);
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86400000);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  if (days < 30) return "This month";
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function group(chats: ChatSummary[]): { label: string; chats: ChatSummary[] }[] {
  const now = new Date();
  const groups: { label: string; chats: ChatSummary[] }[] = [];
  for (const chat of chats) {
    const label = bucket(chat.created, now);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.chats.push(chat);
    else groups.push({ label, chats: [chat] });
  }
  return groups;
}

function TrashIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 14" className={className} aria-hidden="true" fill="none">
      <path
        d="M2.5 3.75h9M5.75 3.75V2.5h2.5v1.25M3.5 3.75l.5 7a1 1 0 0 0 1 .95h4a1 1 0 0 0 1-.95l.5-7"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ChatSidebar({
  chats,
  activeId,
  onOpen,
  onDelete,
  onClose,
}: {
  chats: ChatSummary[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  /** Dismisses the panel where it overlays the room, on small screens. */
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    if (!confirming) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setConfirming(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming]);

  const groups = group(chats);

  return (
    <>
      {/* Only ever visible where the panel floats over the room. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close chats"
        className="absolute inset-0 z-20 bg-ink/20 sm:hidden"
      />

      <aside
        className="absolute inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-line bg-surface-2 motion-safe:animate-[flux-slide-in_160ms_ease-out] sm:relative sm:z-auto"
        aria-label="Past chats"
      >
        <div className="flex h-11 shrink-0 items-center gap-2 px-3.5">
          <h2 className="font-data text-[0.62rem] uppercase tracking-[0.14em] text-ink-faint">
            Chats
          </h2>
          {chats.length > 0 && (
            <span className="font-data text-[0.62rem] text-ink-faint opacity-70">
              {chats.length}
            </span>
          )}
        </div>

        <div className="flux-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {chats.length === 0 ? (
            <p className="px-1.5 py-2 text-[0.76rem] leading-relaxed text-ink-soft">
              Nothing asked yet. Your questions will collect here.
            </p>
          ) : (
            groups.map((section) => (
              <section key={section.label} className="mb-3 last:mb-0">
                <h3
                  className="mb-1 px-1.5 font-data text-[0.6rem] uppercase tracking-[0.12em] text-ink-faint"
                  suppressHydrationWarning
                >
                  {section.label}
                </h3>
                <ul className="flex flex-col">
                  {section.chats.map((chat) => {
                    const active = chat.id === activeId;
                    const asking = confirming === chat.id;
                    return (
                      <li
                        key={chat.id}
                        className={`group flex items-center gap-1 rounded-lg pr-1 transition-colors ${
                          active ? "bg-surface-3" : "hover:bg-surface-3/60"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onOpen(chat.id)}
                          className={`min-w-0 flex-1 truncate px-1.5 py-1.5 text-left text-[0.8rem] ${
                            active ? "text-ink" : "text-ink-soft"
                          }`}
                          title={chat.title}
                        >
                          {chat.title || "Untitled"}
                        </button>

                        {asking ? (
                          <span className="flex shrink-0 items-center gap-1.5 pl-1 font-data text-[0.62rem]">
                            <button
                              type="button"
                              onClick={() => {
                                setConfirming(null);
                                onDelete(chat.id);
                              }}
                              className="text-blush hover:underline"
                            >
                              delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirming(null)}
                              className="text-ink-faint hover:text-ink"
                            >
                              keep
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirming(chat.id)}
                            aria-label={`Delete “${chat.title || "Untitled"}”`}
                            className="shrink-0 rounded-md p-1 text-ink-faint opacity-0 transition-opacity hover:text-blush focus-visible:opacity-100 group-hover:opacity-100"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
