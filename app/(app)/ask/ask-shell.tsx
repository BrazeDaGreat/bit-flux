"use client";

import Link from "next/link";

import type { FilterGroup } from "@/components/FilterMenu";
import type { Selection } from "@/lib/model-store";
import type { Citation, MessageRecord } from "@/lib/types";
import { stripReasoning } from "@/lib/text";

/** The pieces both Ask shells share: the transcript's own types, the two
 *  drawings, and the shape of what `AskRoom` hands down. */

export const EXAMPLES = [
  "What have I not finished?",
  "What did I decide this month?",
  "Which ideas keep coming back?",
];

export interface Turn {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  mode?: string;
  note?: string;
}

/** A stored message, ready to render. Old answers were saved before reasoning
 *  tags were filtered out, so history gets cleaned on the way in too. */
export function toTurn(message: MessageRecord): Turn {
  return {
    role: message.role,
    content:
      message.role === "assistant"
        ? stripReasoning(message.content)
        : message.content,
    citations: message.citations ?? [],
  };
}

/** `[2]` in the model's answer becomes a link to thought 2. Rendering them
 *  inline keeps each claim next to its evidence. */
export function Answer({
  text,
  citations,
}: {
  text: string;
  citations: Citation[];
}) {
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
            // The pill keeps its size at every width — it sits inside a line of
            // prose and the line's rhythm is the point. Below `lg` it grows an
            // invisible 44px hit area instead, which costs the layout nothing.
            className="relative mx-0.5 inline-flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-iris-soft px-1 align-[0.1em] font-data text-[0.66rem] text-iris no-underline hover:opacity-75 max-lg:before:absolute max-lg:before:-inset-[0.8rem] max-lg:before:content-['']"
          >
            {match![1]}
          </Link>
        );
      })}
    </div>
  );
}

/** Two panes, one filled — the panel this opens, drawn as what it does. */
export function PanelIcon({ className = "" }: { className?: string }) {
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

export interface AskShellProps {
  /** Callback refs: both shells mount, only the visible one is written to. */
  areaRef: (el: HTMLTextAreaElement | null) => void;
  endRef: (el: HTMLDivElement | null) => void;
  question: string;
  setQuestion: (value: string) => void;
  ask: (text: string) => void;
  turns: Turn[];
  busy: boolean;
  error: string | null;
  needsKey: boolean;
  loadingChat: boolean;
  openChatTitle?: string;
  newChat: () => void;
  toggleSidebar: () => void;
  sidebarOpen: boolean;
  scopeGroups: FilterGroup[];
  setScopeKey: (key: string, value: string | null) => void;
  clearScope: () => void;
  scopeCount: number;
  selection: Selection | null;
  onComposerFocus: () => void;
  onComposerBlur: () => void;
}
