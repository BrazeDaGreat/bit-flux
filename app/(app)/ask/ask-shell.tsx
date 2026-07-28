"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

/**
 * The model naturally uses Markdown for structure and emphasis. Keep that
 * vocabulary intact rather than showing its punctuation, while drawing
 * citations as the same small doors into Thoughts they have always been.
 *
 * `react-markdown` escapes raw HTML by default. That matters here: an answer
 * comes from a model, so Markdown is presentation and never permission to
 * inject markup into the app.
 */
export function Answer({
  text,
  citations,
}: {
  text: string;
  citations: Citation[];
}) {
  const citationByNumber = mapCitations(text, citations);

  return (
    <div className="font-hand text-[1rem] leading-[1.7] text-ink">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCitations]}
        components={{
          p: ({ children }) => (
            <p className="my-3 first:mt-0 last:mb-0">{children}</p>
          ),
          h1: ({ children }) => (
            <h1 className="mb-2 mt-5 text-[1.3rem] font-semibold leading-tight first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-5 text-[1.18rem] font-semibold leading-tight first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1.5 mt-4 text-[1.06rem] font-semibold leading-snug first:mt-0">
              {children}
            </h3>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-ink">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          del: ({ children }) => (
            <del className="text-ink-faint decoration-blush/70">{children}</del>
          ),
          ul: ({ children }) => (
            <ul className="my-3 list-disc space-y-1 pl-5 marker:text-ink-faint">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 list-decimal space-y-1 pl-5 marker:font-data marker:text-[0.78em] marker:text-ink-faint">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-iris/45 pl-3 italic text-ink-soft">
              {children}
            </blockquote>
          ),
          pre: ({ children }) => (
            <pre className="flux-scroll my-3 overflow-x-auto rounded-xl bg-surface-2 p-3 font-data text-[0.76rem] leading-relaxed text-ink [&>code]:bg-transparent [&>code]:p-0">
              {children}
            </pre>
          ),
          code: ({ children, className }) => (
            <code
              className={`rounded bg-surface-3 px-1 py-0.5 font-data text-[0.82em] ${className ?? ""}`}
            >
              {children}
            </code>
          ),
          a: ({ href, children }) => {
            const match = href?.match(/^\/ask-citation\/(\d+)$/);
            if (match) {
              const citation = citationByNumber.get(Number(match[1]));
              if (!citation) return <>[{children}]</>;
              return (
                <CitationLink number={match[1]} citation={citation} />
              );
            }

            const external = Boolean(href?.match(/^https?:\/\//));
            return (
              <a
                href={href}
                target={external ? "_blank" : undefined}
                rel={external ? "noreferrer" : undefined}
                className="rounded-[3px] text-iris underline decoration-iris/35 underline-offset-[0.18em] transition-colors hover:bg-iris-soft hover:decoration-iris"
              >
                {children}
              </a>
            );
          },
          hr: () => <hr className="my-5 border-line" />,
          table: ({ children }) => (
            <table className="my-4 w-full border-collapse font-ui text-[0.78rem] leading-relaxed">
              {children}
            </table>
          ),
          th: ({ children }) => (
            <th className="border-b border-line-strong px-2 py-1.5 text-left font-medium text-ink">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-line px-2 py-1.5 align-top text-ink-soft">
              {children}
            </td>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

/**
 * New answers carry their source marker explicitly. Old stored chats only
 * contain citations in ascending marker order, so pair those records with the
 * distinct markers still present in their answer. This makes history correct
 * without a migration and removes the old `citations[n - 1]` assumption.
 */
function mapCitations(
  text: string,
  citations: Citation[]
): Map<number, Citation> {
  const mapped = new Map<number, Citation>();
  const legacy: Citation[] = [];

  for (const citation of citations) {
    if (citation.number !== undefined) mapped.set(citation.number, citation);
    else legacy.push(citation);
  }

  const unmatchedNumbers = [
    ...new Set(
      [...text.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1]))
    ),
  ]
    .filter((number) => !mapped.has(number))
    .sort((a, b) => a - b);

  legacy.forEach((citation, index) => {
    const number = unmatchedNumbers[index];
    if (number !== undefined) mapped.set(number, citation);
  });

  return mapped;
}

function CitationLink({
  number,
  citation,
}: {
  number: string;
  citation: Citation;
}) {
  return (
    <Link
      href={`/thoughts/${citation.id}`}
      title={citation.title}
      // The pill keeps its size at every width — it sits inside a line of
      // prose and the line's rhythm is the point. Below `lg` it grows an
      // invisible 44px hit area instead, which costs the layout nothing.
      className="relative mx-0.5 inline-flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-iris-soft px-1 align-[0.1em] font-data text-[0.66rem] text-iris no-underline hover:opacity-75 max-lg:before:absolute max-lg:before:-inset-[0.8rem] max-lg:before:content-['']"
    >
      {number}
    </Link>
  );
}

interface MarkdownNode {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
}

/**
 * Citation markers are plain `[2]`, not Markdown links. Turn them into a
 * private link shape in the syntax tree so the anchor renderer above can keep
 * citations interactive without rewriting code spans or existing links.
 */
function remarkCitations() {
  return (tree: unknown) => rewriteCitations(tree as MarkdownNode);
}

function rewriteCitations(parent: MarkdownNode) {
  if (!parent.children || parent.type === "link") return;

  parent.children = parent.children.flatMap((child) => {
    if (child.type !== "text" || !child.value) {
      rewriteCitations(child);
      return child;
    }

    const parts: MarkdownNode[] = [];
    const pattern = /\[(\d+)\]/g;
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(child.value))) {
      if (match.index > cursor) {
        parts.push({
          type: "text",
          value: child.value.slice(cursor, match.index),
        });
      }
      parts.push({
        type: "link",
        url: `/ask-citation/${match[1]}`,
        children: [{ type: "text", value: match[1] }],
      });
      cursor = match.index + match[0].length;
    }

    if (cursor === 0) return child;
    if (cursor < child.value.length) {
      parts.push({ type: "text", value: child.value.slice(cursor) });
    }
    return parts;
  });
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
  areaRef: (el: HTMLElement | null) => void;
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
