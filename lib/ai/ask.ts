import { chat, type ProviderConfig } from "./provider";
import type { Citation, DumpRecord, ThoughtRecord } from "../types";
import type { SearchHit } from "../search";

export interface AskContext {
  hits: SearchHit[];
  dumps: Map<string, DumpRecord>;
  now: Date;
}

const SYSTEM = `You answer questions about one person's own captured thoughts.

Rules:
- Answer only from the numbered thoughts provided. They are the entire world.
- If the thoughts don't contain the answer, say so plainly and say what is there instead. Never fill a gap with a guess.
- Cite every claim with the thought's number in square brackets, like [2]. Cite as you go, not in a list at the end.
- Be direct and specific. Quote the person's own wording when it's the clearest answer.
- Dates: today's date is given below. "Overdue" means before today.
- No preamble, no "based on your thoughts". Just answer.`;

function label(thought: ThoughtRecord): string {
  const bits: string[] = [];
  if (thought.status !== "open") bits.push(thought.status);
  if (thought.action_date) bits.push(`do ${thought.action_date.slice(0, 10)}`);
  if (thought.deadline) bits.push(`due ${thought.deadline.slice(0, 10)}`);
  return bits.length ? bits.join(", ") : "open";
}

export function buildContext(context: AskContext): string {
  return context.hits
    .map((hit, index) => {
      const thought = hit.thought;
      const dump = context.dumps.get(thought.dump);
      return [
        `[${index + 1}] ${thought.title}`,
        `    status: ${label(thought)}`,
        `    captured: ${(thought.created ?? "").slice(0, 10)}`,
        `    ${thought.body.replace(/\n/g, "\n    ")}`,
        dump
          ? `    original message: "${dump.text.slice(0, 400).replace(/\n/g, " ")}"`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

export async function askQuestion(
  config: ProviderConfig,
  question: string,
  context: AskContext
): Promise<{ answer: string; citations: Citation[] }> {
  if (context.hits.length === 0) {
    return {
      answer:
        "Nothing you've written matches that. Try different words, or widen the filters.",
      citations: [],
    };
  }

  const answer = await chat(config, {
    system: `${SYSTEM}\n\nToday is ${context.now.toISOString().slice(0, 10)}.`,
    user: `Thoughts:\n\n${buildContext(context)}\n\nQuestion: ${question}`,
    temperature: 0.3,
    maxTokens: 1200,
  });

  // Only the thoughts actually cited become links, so a reference always
  // points at something the answer used.
  const cited = new Set(
    [...answer.matchAll(/\[(\d+)\]/g)]
      .map((match) => Number(match[1]))
      .filter((n) => n >= 1 && n <= context.hits.length)
  );

  const citations: Citation[] = [...cited]
    .sort((a, b) => a - b)
    .map((number) => {
      const thought = context.hits[number - 1].thought;
      return {
        kind: "thought",
        id: thought.id,
        title: thought.title,
        snippet: thought.body.slice(0, 160),
      };
    });

  return { answer, citations };
}
