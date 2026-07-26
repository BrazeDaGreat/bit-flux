import { chat, type ProviderConfig } from "./provider";
import { plainMentions } from "../mentions";
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
- Every thought is marked DONE or OPEN. A DONE thought is finished: never list it as outstanding, never suggest doing it, and never call it overdue — say it is already done. Only OPEN thoughts count as things still to do.
- A word starting with # is a thought the person pointed at deliberately. When it is followed by a number, that number is its entry below — answer about that exact thought, not one that merely sounds like it.
- No preamble, no "based on your thoughts". Just answer.`;

/** Completion is the fact most often got wrong, so it is stated first, in one
 *  unmissable word, rather than left for the model to infer from a field. */
function label(thought: ThoughtRecord): string {
  const bits: string[] = [
    thought.status === "done" ? "DONE — already finished" : "OPEN — not done yet",
  ];
  if (thought.action_date) bits.push(`do ${thought.action_date.slice(0, 10)}`);
  if (thought.deadline) bits.push(`due ${thought.deadline.slice(0, 10)}`);
  return bits.join(", ");
}

export function buildContext(context: AskContext): string {
  return context.hits
    .map((hit, index) => {
      const thought = hit.thought;
      const dump = context.dumps.get(thought.dump);
      const done = thought.status === "done";
      // Mentions are flattened on the way in: `#[Dentist](abc)` is a link in
      // the app and noise in a prompt, and the title is the part that means
      // anything to a model.
      const body = plainMentions(thought.body);
      return [
        `[${index + 1}] ${done ? "[DONE] " : ""}${plainMentions(thought.title)}`,
        `    status: ${label(thought)}`,
        `    captured: ${(thought.created ?? "").slice(0, 10)}`,
        `    ${body.replace(/\n/g, "\n    ")}`,
        dump
          ? `    original message: "${plainMentions(dump.text).slice(0, 400).replace(/\n/g, " ")}"`
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
