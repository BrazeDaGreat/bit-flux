"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import Sheet from "@/components/Sheet";
import type { FilterGroup } from "@/components/FilterMenu";
import { useIsPhone } from "@/lib/breakpoint";
import { composerStore } from "@/lib/composer-store";
import { modelStore, type Selection } from "@/lib/model-store";
import { pb } from "@/lib/pb";
import type {
  AskScope,
  Citation,
  MessageRecord,
  TagRecord,
} from "@/lib/types";
import type { AskShellProps, Turn } from "./ask-shell";
import { toTurn } from "./ask-shell";
import AskRoomDesktop from "./AskRoom.desktop";
import AskRoomMobile from "./AskRoom.mobile";
import ChatSidebar, { ChatList, type ChatSummary } from "./ChatSidebar";

/**
 * Whether the chat panel is open is a browser preference, not page state — it
 * outlives the session and follows the person across tabs. Reading it through
 * a store keeps the server render honest (always closed) while the browser
 * renders whatever was last chosen, with no flicker in between.
 *
 * It is a preference about a *panel*, though, and a phone has nowhere to put
 * one — so below 768px the list is a sheet that always starts closed, and the
 * stored answer is left alone rather than overwritten.
 */
const SIDEBAR_KEY = "flux.ask.chats-open";
const sidebarListeners = new Set<() => void>();

type AskResponse = {
  answer?: string;
  citations?: Citation[];
  chat_id?: string;
  mode?: string;
  note?: string;
  error?: string;
  needs_key?: boolean;
  needs_model?: boolean;
};

type AskStreamEvent =
  | { type: "delta"; text: string }
  | {
      type: "done";
      answer: string;
      citations?: Citation[];
      chat_id: string;
      mode?: string;
      note?: string;
    }
  | { type: "error"; error: string };

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
  const panel = useSyncExternalStore(subscribeSidebar, readSidebar, () => false);
  const [chatSheet, setChatSheet] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);

  const phone = useIsPhone();
  const areas = useRef<HTMLElement[]>([]);
  const ends = useRef<HTMLDivElement[]>([]);

  /** A `display: none` element has no offset parent, which is exactly the
   *  question being asked: which of the two shells is on screen. */
  const liveArea = useCallback(
    () =>
      areas.current.find((el) => el.isConnected && el.offsetParent !== null) ??
      null,
    []
  );
  const liveEnd = useCallback(
    () =>
      ends.current.find((el) => el.isConnected && el.offsetParent !== null) ??
      null,
    []
  );

  const areaRef = useCallback((el: HTMLElement | null) => {
    areas.current = areas.current.filter((known) => known.isConnected);
    if (el && !areas.current.includes(el)) areas.current.push(el);
  }, []);
  const endRef = useCallback((el: HTMLDivElement | null) => {
    ends.current = ends.current.filter((known) => known.isConnected);
    if (el && !ends.current.includes(el)) ends.current.push(el);
  }, []);

  const sidebarOpen = phone ? chatSheet : panel;

  function toggleSidebar() {
    if (phone) setChatSheet((open) => !open);
    else writeSidebar(!panel);
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
    liveArea()?.focus();
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

  useEffect(() => {
    if (turns.length) liveEnd()?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy, liveEnd]);

  // The software keyboard shrinks the visual viewport out from under a nested
  // scroller, which leaves the latest answer somewhere above the fold with no
  // event that React would notice. So the transcript re-pins itself to the
  // bottom whenever the viewport moves while the composer has the caret.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    function repin() {
      if (!composerStore.getSnapshot()) return;
      liveEnd()?.scrollIntoView({ block: "end" });
    }
    viewport.addEventListener("resize", repin);
    viewport.addEventListener("scroll", repin);
    return () => {
      viewport.removeEventListener("resize", repin);
      viewport.removeEventListener("scroll", repin);
    };
  }, [liveEnd]);

  // Leaving the screen with the caret in the composer must not take the sill
  // with it.
  useEffect(() => () => composerStore.set(false), []);

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
    setNeedsKey(false);
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
      function acceptChat(id?: string) {
        if (!id || id === chatId) return;
        setChatId(id);
        syncUrl(id);
        // The question is the chat's title, same as the server names it.
        setChats((prev) => [
          { id, title: q.slice(0, 80), created: new Date().toISOString() },
          ...prev,
        ]);
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (!res.body || !contentType.includes("application/x-ndjson")) {
        const data = (await res.json().catch(() => ({}))) as AskResponse;
        if (!res.ok || !data.answer) {
          setNeedsKey(Boolean(data.needs_key));
          setError(data.error ?? "Couldn't answer that");
          return;
        }
        acceptChat(data.chat_id);
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
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamedAnswer = "";
      let streamError: string | null = null;
      let completed: Extract<AskStreamEvent, { type: "done" }> | null = null;

      // Put the answer in the transcript immediately; deltas replace this
      // placeholder as they arrive instead of waiting for the final event.
      setTurns((prev) => [...prev, { role: "assistant", content: "" }]);

      function handleLine(line: string) {
        if (!line.trim()) return;
        const event = JSON.parse(line) as AskStreamEvent;

        if (event.type === "delta") {
          streamedAnswer += event.text;
          setTurns((prev) => {
            const index = prev.length - 1;
            const last = prev[index];
            if (!last || last.role !== "assistant") return prev;
            const next = [...prev];
            next[index] = { ...last, content: streamedAnswer };
            return next;
          });
        } else if (event.type === "done") {
          completed = event;
        } else if (event.type === "error") {
          streamError = event.error;
        }
      }

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) handleLine(line);
        if (done) break;
      }
      if (buffer.trim()) handleLine(buffer);

      if (streamError) {
        // Keep a useful partial answer if one arrived, but remove an empty
        // placeholder so an interrupted request does not leave a blank turn.
        if (!streamedAnswer) {
          setTurns((prev) => {
            const last = prev[prev.length - 1];
            return last?.role === "assistant" && !last.content
              ? prev.slice(0, -1)
              : prev;
          });
        }
        setError(streamError);
        return;
      }
      // TypeScript cannot observe assignments made from the nested line
      // parser, so make the post-read narrowing explicit here.
      const finished = completed as Extract<AskStreamEvent, { type: "done" }> | null;
      if (!finished) throw new Error("The answer stream ended unexpectedly");

      acceptChat(finished.chat_id);
      setTurns((prev) => {
        const index = prev.length - 1;
        const last = prev[index];
        if (!last || last.role !== "assistant") return prev;
        const next = [...prev];
        next[index] = {
          ...last,
          content: finished.answer,
          citations: finished.citations ?? [],
          mode: finished.mode,
          note: finished.note,
        };
        return next;
      });
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

  const shell: AskShellProps = {
    areaRef,
    endRef,
    question,
    setQuestion,
    ask: (text: string) => void ask(text),
    turns,
    busy,
    error,
    needsKey,
    loadingChat,
    openChatTitle,
    newChat,
    toggleSidebar,
    sidebarOpen,
    scopeGroups,
    setScopeKey,
    clearScope: () => setScope({}),
    scopeCount,
    selection,
    onComposerFocus: () => composerStore.set(true),
    onComposerBlur: () => composerStore.set(false),
  };

  return (
    <div className="relative flex h-full overflow-hidden">
      {!phone && panel && (
        <ChatSidebar
          chats={chats}
          activeId={chatId}
          onOpen={(id) => void openChat(id)}
          onDelete={(id) => void deleteChat(id)}
          onClose={toggleSidebar}
        />
      )}

      <AskRoomDesktop {...shell} />
      <AskRoomMobile {...shell} />

      {/* A phone has no beside, so the chat list arrives the way every other
          list does below `lg`: from the bottom, focus-trapped, closing back to
          the button that opened it. */}
      <Sheet
        open={phone && chatSheet}
        onClose={() => setChatSheet(false)}
        title={`Chats · ${chats.length}`}
      >
        <ChatList
          chats={chats}
          activeId={chatId}
          onOpen={(id) => {
            void openChat(id);
            setChatSheet(false);
          }}
          onDelete={(id) => void deleteChat(id)}
        />
      </Sheet>
    </div>
  );
}
