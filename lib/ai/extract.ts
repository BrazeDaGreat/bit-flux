import { chat, type ProviderConfig } from "./provider";
import type { ExtractedThought, ExtractionResult } from "./types";
import type { DatePrecision, PersonRecord, TagRecord } from "../types";

const PRECISIONS: DatePrecision[] = ["exact", "day", "week", "month", "vague"];

export interface ExtractionContext {
  tags: Pick<TagRecord, "name" | "description">[];
  /** Known people, so one Sam doesn't become two spellings. */
  people: Pick<PersonRecord, "name" | "note">[];
  /** Local time where the dump was written, so "tonight" resolves correctly. */
  capturedAt: Date;
  timeZone: string;
  autoReminders: boolean;
  /** Learned from the user's own corrections in the review queue. */
  corrections: string[];
}

function localStamp(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      dateStyle: "full",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function buildSystemPrompt(context: ExtractionContext): string {
  const corrections = context.corrections.filter(
    (correction) =>
      !/\bis a (?:task|idea|note|question|decision|reminder|reference), not a (?:task|idea|note|question|decision|reminder|reference)\.?$/i.test(
        correction
      )
  );

  const tagList = context.tags.length
    ? context.tags
        .map((t) => `- ${t.name}: ${t.description || "(no description)"}`)
        .join("\n")
    : "(none yet)";

  const peopleList = context.people.length
    ? context.people
        .map((p) => `- ${p.name}${p.note ? `: ${p.note}` : ""}`)
        .join("\n")
    : "(none yet)";

  return `You sort a person's raw brain dump into separate thoughts. You are a librarian, not an author.

CAPTURE TIME: ${localStamp(context.capturedAt, context.timeZone)} (timezone ${context.timeZone})

THE USER'S EXISTING TAGS — match against these before inventing anything; the descriptions tell you what each one means to this person:
${tagList}

PEOPLE THE USER ALREADY WRITES ABOUT — when a mention is clearly one of them, use this exact spelling so they stay one person:
${peopleList}

RULES
1. Split only genuinely separate thoughts. One idea stays one thought, however long. Do not split a single thought into steps.
2. Never add facts, names, dates or intentions the user did not write. Fix grammar and cut filler; keep the meaning exactly.
3. The title is short and concrete — how the user would recognise it in a list. No invented flourish.
4. Dates: resolve relative wording against the capture time above, in the user's timezone. Always put the user's own phrase in date_source_text.
   - action_date = when they mean to do it. deadline = the latest it can happen. resurface_at = when a thought should come back to them.
   - If the user gave only a vague period ("next week", "sometime in August"), set the date to the start of that period and set date_precision to week/month/vague. Never invent a specific hour the user did not give.
   - date_precision: ${PRECISIONS.join(", ")}.
5. reminder_at: ${
    context.autoReminders
      ? "the user has asked for automatic reminders, so set one when a deadline exists and a reminder is clearly useful."
      : "only when the user explicitly asks to be reminded. Otherwise leave it null."
  }
6. tags: only names from the existing list. If a recurring topic has no tag, put it in suggested_tags with a one-line description of when it should apply. Suggested tags are proposals; do not treat them as applied.
7. LINKS TO OTHER THOUGHTS. Text of the form #[Some title](abc123) is a link the user placed by hand. Copy it into the body character for character — brackets, parentheses, the id, all of it — and put it in the thought whose meaning it belongs to. Never rewrite it, never drop the id, never turn it into plain words, never invent one. In a title, write the plain words instead of the link.
8. confidence 0-1. Below 0.7 means you were unsure about the split, tags, or a date. Never guess silently; lower the confidence instead.
${
  corrections.length
    ? `\nHOW THIS USER LIKES THINGS ORGANISED (learned from their own corrections):\n${corrections.map((c) => `- ${c}`).join("\n")}`
    : ""
}

Return JSON only, this exact shape:
{"thoughts":[{"title":string,"body":string,"tags":string[],"suggested_tags":[{"name":string,"description":string}],"people":string[],"action_date":string|null,"deadline":string|null,"reminder_at":string|null,"resurface_at":string|null,"date_precision":string|null,"date_source_text":string|null,"confidence":number}]}
Dates are ISO 8601 with an offset. Use null, never an empty string, for anything absent.`;
}

/** Models wrap JSON in prose or fences often enough that this is required. */
function parseJson(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("No JSON in the response");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asDate(value: unknown): string | null {
  const text = asString(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalise(
  raw: Record<string, unknown>,
  context: ExtractionContext
): ExtractedThought | null {
  const body = asString(raw.body);
  const title = asString(raw.title) || body.slice(0, 60);
  if (!body && !title) return null;

  const knownTags = new Set(context.tags.map((t) => t.name.toLowerCase()));
  const knownPeople = new Map(
    context.people.map((p) => [p.name.toLowerCase(), p.name])
  );
  const tags = Array.isArray(raw.tags)
    ? raw.tags
        .map(asString)
        .filter((name) => name && knownTags.has(name.toLowerCase()))
    : [];

  const suggested = Array.isArray(raw.suggested_tags)
    ? raw.suggested_tags
        .map((item) => {
          const entry = item as Record<string, unknown>;
          return {
            name: asString(entry?.name),
            description: asString(entry?.description),
          };
        })
        .filter((t) => t.name && !knownTags.has(t.name.toLowerCase()))
    : [];

  const precision = PRECISIONS.includes(raw.date_precision as DatePrecision)
    ? (raw.date_precision as DatePrecision)
    : null;

  const confidence =
    typeof raw.confidence === "number" && raw.confidence >= 0 && raw.confidence <= 1
      ? raw.confidence
      : 0.5;

  return {
    title,
    body: body || title,
    tags,
    suggested_tags: suggested,
    // Snapped to the spelling already on file, so "priya" and "Priya" stay one
    // person in the roster and in filters.
    people: Array.isArray(raw.people)
      ? raw.people
          .map(asString)
          .filter(Boolean)
          .map((name) => knownPeople.get(name.toLowerCase()) ?? name)
      : [],
    action_date: asDate(raw.action_date),
    deadline: asDate(raw.deadline),
    // The prompt already restricts this to explicit requests unless the user
    // opted into automatic reminders.
    reminder_at: asDate(raw.reminder_at),
    resurface_at: asDate(raw.resurface_at),
    date_precision: precision,
    date_source_text: asString(raw.date_source_text) || null,
    confidence,
  };
}

export async function extractThoughts(
  config: ProviderConfig,
  dumpText: string,
  context: ExtractionContext
): Promise<ExtractionResult> {
  const system = buildSystemPrompt(context);

  let content = await chat(config, {
    system,
    user: dumpText,
    json: true,
    maxTokens: 3000,
  });

  let parsed: unknown;
  try {
    parsed = parseJson(content);
  } catch {
    // One repair pass — cheaper than failing the whole dump.
    content = await chat(config, {
      system: "Return only the JSON object described. No prose, no fences.",
      user: `Fix this into valid JSON matching {"thoughts":[...]}:\n\n${content}`,
      json: true,
      maxTokens: 3000,
    });
    parsed = parseJson(content);
  }

  const list = (parsed as { thoughts?: unknown })?.thoughts;
  if (!Array.isArray(list)) throw new Error("The model returned no thoughts array");

  const thoughts = list
    .map((item) => normalise(item as Record<string, unknown>, context))
    .filter((t): t is ExtractedThought => t !== null);

  if (thoughts.length === 0) throw new Error("The model returned no usable thoughts");

  return { thoughts, model: config.model };
}
