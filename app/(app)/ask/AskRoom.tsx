"use client";

import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import FilterMenu, {
  FilterChips,
  type FilterGroup,
} from "@/components/FilterMenu";
import ModelPicker from "@/components/ModelPicker";
import { modelStore, type Selection } from "@/lib/model-store";
import { pb } from "@/lib/pb";
import { stripReasoning } from "@/lib/text";
import type {
  AskScope,
  Citation,
  MessageRecord,
  TagRecord,
} from "@/lib/types";
import ChatSidebar, { type ChatSummary } from "./ChatSidebar";

const EXAMPLES = [
  "What have I not finished?",
  "What did I decide this month?",
  "Which ideas keep coming back?",
];

interface Turn {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  mode?: string;
  note?: string;
}

/** `[2]` in the model's answer becomes a link to thought 2. Rendering them
 *  inline keeps each claim next to its evidence. */
function Answer({ text, citations }: { text: string; citations: Citation[] }) {
  return (
    <div className="whitespace-pre-wrap font-hand text-[1rem] leading-[1.7] text-ink">
      {text.split(/(\[\d+\])/g).map((part, index) => {
        const match = part.match(/^\[(\d+)\]$/);
        const citation = match ? citations[Number(match[1]) - 1] : undefined;
        if (!citation) return <span key={index}>{part}</span>;
        return (
          <Link
            key={index}
            href={`/thoughts/${citation.id}`}
            title={citation.title}
            className="mx-0.5 inline-flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-iris-soft px-1 align-[0.1em] font-data text-[0.66rem] text-iris no-underline hover:opacity-75"
          >
            {match![1]}
          </Link>
        );
      })}
    </div>
  );
}

/** A stored message, ready to render. Old answers were saved before reasoning
 *  tags were filtered out, so history gets cleaned on the way in too. */
function toTurn(message: MessageRecord): Turn {
  return {
    role: message.role,
    content:
      message.role === "assistant"
        ? stripReasoning(message.content)
        : message.content,
    citations: message.citations ?? [],
  };
}

/**
 * Whether the chat panel is open is a browser preference, not page state — it
 * outlives the session and follows the person across tabs. Reading it through
 * a store keeps the server render honest (always closed) while the browser
 * renders whatever was last chosen, with no flicker in between.
 */
const SIDEBAR_KEY = "flux.ask.chats-open";
const sidebarListeners = new Set<() => void>();

function readSidebar(): boolean {
  return localStorage.getItem(SIDEBAR_KEY) === "1";
}

function writeSidebar(open: boolean) {
  localStorage.setItem(SIDEBAR_KEY, open ? "1" : "0");
  for (const notify of sidebarListeners) notify();
}

function subscribeSidebar(notify: () => void) {
  sidebarListeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    sidebarListeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

export default function AskRoom({
  tags,
  people,
  selection,
  initialScope,
  initialQuestion = "",
  chats: initialChats,
  openChatId = null,
  openChatMessages = [],
}: {
  tags: TagRecord[];
  people: string[];
  /** The same choice Capture made — Ask doesn't have its own. */
  selection: Selection | null;
  initialScope?: AskScope;
  initialQuestion?: string;
  chats: ChatSummary[];
  openChatId?: string | null;
  openChatMessages?: MessageRecord[];
}) {
  const [question, setQuestion] = useState(initialQuestion);
  const [turns, setTurns] = useState<Turn[]>(() =>
    openChatMessages.map(toTurn)
  );
  const [scope, setScope] = useState<AskScope>(initialScope ?? {});
  const [chatId, setChatId] = useState<string | null>(openChatId);
  const [chats, setChats] = useState<ChatSummary[]>(initialChats);
  const sidebar = useSyncExternalStore(subscribeSidebar, readSidebar, () => false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);

  const areaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  function toggleSidebar() {
    writeSidebar(!sidebar);
  }

  /** The URL follows the open chat without re-running the server render, so
   *  reloading or sharing the link lands in the same conversation. */
  function syncUrl(id: string | null) {
    window.history.replaceState(null, "", id ? `/ask?chat=${id}` : "/ask");
  }

  async function openChat(id: string) {
    if (id === chatId) return;
    setLoadingChat(true);
    setError(null);
    try {
      const messages = await pb()
        .collection("flux_messages")
        .getFullList<MessageRecord>({ filter: `chat = "${id}"`, sort: "created" });
      setTurns(messages.map(toTurn));
      setChatId(id);
      syncUrl(id);
    } catch {
      setError("Couldn't open that chat");
    } finally {
      setLoadingChat(false);
    }
  }

  function newChat() {
    setTurns([]);
    setChatId(null);
    setError(null);
    syncUrl(null);
    areaRef.current?.focus();
  }

  async function deleteChat(id: string) {
    setChats((prev) => prev.filter((chat) => chat.id !== id));
    if (id === chatId) newChat();
    try {
      await pb().collection("flux_chats").delete(id);
    } catch {
      setError("Couldn't delete that chat");
    }
  }

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [question]);

  useEffect(() => {
    if (turns.length) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  const scopeCount = Object.keys(scope).length;

  /** The same control the Thoughts screen uses, so "narrow this down" looks
   *  and behaves identically wherever it appears. */
  const scopeGroups: FilterGroup[] = [
    {
      key: "tag",
      label: "Tag",
      options: tags.map((t) => ({
        value: t.id,
        label: t.name,
        tone: t.color || "iris",
      })),
      value: scope.tag,
    },
    {
      key: "person",
      label: "Person",
      options: people.map((p) => ({ value: p, label: p })),
      value: scope.person,
    },
  ];

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;

    setQuestion("");
    setError(null);
    setBusy(true);
    setTurns((prev) => [...prev, { role: "user", content: q }]);

    const picked = modelStore.effective(selection);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          chat_id: chatId,
          scope: scopeCount ? scope : undefined,
          model: picked
            ? { provider: picked.provider, model: picked.model }
            : undefined,
        }),
      });
      const data = (await res.json()) as {
        answer?: string;
        citations?: Citation[];
        chat_id?: string;
        mode?: string;
        note?: string;
        error?: string;
        needs_key?: boolean;
        needs_model?: boolean;
      };

      if (!res.ok || !data.answer) {
        setNeedsKey(Boolean(data.needs_key));
        setError(data.error ?? "Couldn't answer that");
        return;
      }

      if (data.chat_id && data.chat_id !== chatId) {
        setChatId(data.chat_id);
        syncUrl(data.chat_id);
        // The question is the chat's title, same as the server names it.
        setChats((prev) => [
          { id: data.chat_id!, title: q.slice(0, 80), created: new Date().toISOString() },
          ...prev,
        ]);
      }
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer!,
          citations: data.citations ?? [],
          mode: data.mode,
          note: data.note,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't answer that");
    } finally {
      setBusy(false);
    }
  }

  function setScopeKey(key: string, value: string | null) {
    setScope((prev) => {
      const next = { ...prev };
      if (value) next[key as keyof AskScope] = value as never;
      else delete next[key as keyof AskScope];
      return next;
    });
  }

  const openChatTitle = chats.find((chat) => chat.id === chatId)?.title;

  return (
    <div className="relative flex h-full overflow-hidden">
      {sidebar && (
        <ChatSidebar
          chats={chats}
          activeId={chatId}
          onOpen={(id) => {
            void openChat(id);
            if (window.innerWidth < 640) toggleSidebar();
          }}
          onDelete={(id) => void deleteChat(id)}
          onClose={toggleSidebar}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-line px-3 sm:px-5">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-expanded={sidebar}
            aria-label={sidebar ? "Hide chats" : "Show chats"}
            title={sidebar ? "Hide chats" : "Show chats"}
            className={`rounded-lg p-1.5 transition-colors hover:bg-surface-2 ${
              sidebar ? "text-ink" : "text-ink-faint hover:text-ink"
            }`}
          >
            <PanelIcon className="h-4 w-4" />
          </button>
          <span
            className="min-w-0 flex-1 truncate font-data text-[0.68rem] text-ink-faint"
            title={openChatTitle}
          >
            {loadingChat ? "opening…" : (openChatTitle ?? "New chat")}
          </span>
          {turns.length > 0 && (
            <button
              type="button"
              onClick={newChat}
              className="shrink-0 font-data text-[0.68rem] text-ink-soft transition-colors hover:text-ink"
            >
              + new chat
            </button>
          )}
        </div>

        <div className="flux-scroll min-h-0 flex-1 overflow-y-auto px-5 sm:px-8">
          <div className="mx-auto w-full max-w-2xl py-8">
            {turns.length === 0 ? (
              <div className="flex min-h-[45vh] flex-col items-center justify-center text-center">
                <h1 className="font-hand text-[1.7rem] leading-tight tracking-[-0.01em] text-ink">
                  Ask your own notes
                </h1>
                <p className="mt-1.5 max-w-[38ch] text-[0.84rem] leading-relaxed text-ink-soft">
                  Answers come only from what you wrote, and every one links back
                  to where it came from.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-1.5">
                  {EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => void ask(example)}
                      className="rounded-full border border-line-strong px-3.5 py-1.5 text-[0.8rem] text-ink-soft transition-colors hover:border-iris hover:text-ink"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-7">
                {turns.map((turn, index) =>
                  turn.role === "user" ? (
                    <p
                      key={index}
                      className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-surface-3 px-4 py-2.5 text-[0.9rem] leading-relaxed text-ink"
                    >
                      {turn.content}
                    </p>
                  ) : (
                    <div key={index} className="flex flex-col gap-3">
                      <Answer text={turn.content} citations={turn.citations ?? []} />

                      {(turn.citations?.length ?? 0) > 0 && (
                        <details className="group">
                          <summary className="cursor-pointer list-none font-data text-[0.66rem] text-ink-faint hover:text-ink-soft">
                            {turn.citations!.length} source
                            {turn.citations!.length === 1 ? "" : "s"}
                            <span className="ml-1 opacity-60 group-open:hidden">show</span>
                            <span className="ml-1 hidden opacity-60 group-open:inline">
                              hide
                            </span>
                          </summary>
                          <ul className="mt-2 flex flex-col gap-1.5 border-l border-line-strong pl-3">
                            {turn.citations!.map((citation, i) => (
                              <li key={citation.id} className="flex gap-2">
                                <span className="font-data text-[0.64rem] text-iris">
                                  {i + 1}
                                </span>
                                <Link
                                  href={`/thoughts/${citation.id}`}
                                  className="text-[0.8rem] text-ink-soft hover:text-iris"
                                >
                                  {citation.title}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}

                      {turn.note && (
                        <p className="font-data text-[0.64rem] text-ink-faint">
                          {turn.note}
                        </p>
                      )}
                    </div>
                  )
                )}

                {busy && (
                  <p className="font-data text-[0.7rem] text-ink-faint">
                    reading your thoughts…
                  </p>
                )}
                <div ref={endRef} />
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-blush-soft px-3.5 py-2.5 text-[0.8rem] text-blush"
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
        </div>

        <div className="border-t border-line bg-surface px-5 pb-4 pt-3 sm:px-8">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
            {scopeCount > 0 && (
              <FilterChips
                groups={scopeGroups}
                onRemove={(key) => setScopeKey(key, null)}
                onClear={() => setScope({})}
              />
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void ask(question);
              }}
              className="flex items-end gap-2 rounded-2xl border border-line-strong bg-surface-2 p-2 transition-colors focus-within:border-iris"
            >
              <FilterMenu
                groups={scopeGroups}
                onPick={setScopeKey}
                label="Narrow what gets searched"
                align="left"
                placement="up"
              />
              <div className="self-center">
                <ModelPicker
                  initial={selection}
                  align="left"
                  placement="up"
                  label="Model answering"
                />
              </div>
              <textarea
                ref={areaRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void ask(question);
                  }
                }}
                rows={1}
                placeholder="Ask about anything you've written…"
                className="bare-field flux-scroll min-h-9 flex-1 resize-none self-center bg-transparent px-1 py-2 font-hand text-[0.98rem] leading-[1.4] text-ink placeholder:text-ink-faint"
              />
              <button
                type="submit"
                disabled={!question.trim() || busy}
                className="h-9 shrink-0 rounded-full bg-iris px-4 text-[0.78rem] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-35 dark:text-[#1a1622]"
              >
                Ask
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Two panes, one filled — the panel this opens, drawn as what it does. */
function PanelIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" fill="none">
      <rect
        x="1.75"
        y="2.75"
        width="12.5"
        height="10.5"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M6.25 3v10" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3 3.5h2.5v9H3z" fill="currentColor" opacity="0.35" />
    </svg>
  );
}
