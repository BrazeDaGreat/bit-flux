/**
 * A thought referred to from inside someone else's writing.
 *
 * The written form is `#[Title](id)`. It carries the title as well as the id
 * for one reason: everywhere a mention appears, the raw text is a real thing
 * the user reads and edits — the capture box, the body field, a saved
 * question. A bare id would turn their own sentence into machine noise, and a
 * bare title would break the moment two thoughts shared one. So the title is
 * the reading and the id is the link, and the token holds both.
 *
 * The `#` is outside the brackets so the trigger key that produced it is still
 * the first character of what it produced.
 */

export interface Mention {
  title: string;
  id: string;
}

/** PocketBase ids are 15 alphanumeric characters; the range is loose enough to
 *  survive a change of that and tight enough not to swallow prose. */
const TOKEN = /#\[([^\]\n]{1,160})\]\(([A-Za-z0-9]{6,24})\)/;

/** A fresh global matcher each time — a shared `lastIndex` is a bug factory. */
function tokens(): RegExp {
  return new RegExp(TOKEN.source, "g");
}

/** Titles are written by the user, so the characters that would end the token
 *  early are the ones that have to go. */
export function mentionToken(title: string, id: string): string {
  const safe = title.replace(/[\r\n]+/g, " ").replace(/[[\]()]/g, "").trim();
  return `#[${safe || "untitled"}](${id})`;
}

export function parseMentions(text: string): Mention[] {
  return [...(text ?? "").matchAll(tokens())].map((match) => ({
    title: match[1],
    id: match[2],
  }));
}

/** Ids in the order they were written, each one once. */
export function mentionIds(text: string): string[] {
  return [...new Set(parseMentions(text).map((mention) => mention.id))];
}

export function hasMentions(text: string): boolean {
  return TOKEN.test(text ?? "");
}

/** The sentence as the user hears it: `#[Dentist](abc)` reads `#Dentist`.
 *  Used wherever the text is going somewhere that has no idea what a token is
 *  — a search query, a chat title, a model. */
export function plainMentions(text: string): string {
  return (text ?? "").replace(tokens(), (_, title: string) => `#${title}`);
}

/** The same flattening, but each mention also carries the number it has in the
 *  context the model was given — so "similar to #A nice dream [3]" points the
 *  model at the thought it is already holding. */
export function numberMentions(
  text: string,
  numberFor: (id: string) => number | undefined
): string {
  return (text ?? "").replace(tokens(), (_, title: string, id: string) => {
    const n = numberFor(id);
    return n ? `#${title} [${n}]` : `#${title}`;
  });
}

export type MentionPart =
  | { kind: "text"; value: string }
  | { kind: "mention"; title: string; id: string };

/** Text split into what to read and what to link, in order. */
export function splitMentions(text: string): MentionPart[] {
  const parts: MentionPart[] = [];
  const matcher = tokens();
  let cursor = 0;

  for (const match of (text ?? "").matchAll(matcher)) {
    const at = match.index ?? 0;
    if (at > cursor) parts.push({ kind: "text", value: text.slice(cursor, at) });
    parts.push({ kind: "mention", title: match[1], id: match[2] });
    cursor = at + match[0].length;
  }

  if (cursor < (text ?? "").length) {
    parts.push({ kind: "text", value: text.slice(cursor) });
  }
  return parts;
}

/**
 * What the caret is currently in the middle of typing, if anything.
 *
 * A trigger is a `#` that starts a word — beginning of the text, or after
 * whitespace or an opening bracket — with no newline between it and the caret.
 * Spaces are allowed inside the query because thought titles are sentences,
 * not handles; the list closing when nothing matches is what stops a `#` in
 * ordinary prose from following the caret down the page.
 */
export interface MentionQuery {
  /** Index of the `#`. */
  start: number;
  /** Index of the caret. */
  end: number;
  /** What was typed after the `#`. */
  query: string;
}

const MAX_QUERY = 48;

export function readQuery(text: string, caret: number): MentionQuery | null {
  const upto = text.slice(0, caret);
  const hash = upto.lastIndexOf("#");
  if (hash === -1) return null;

  const before = hash === 0 ? "" : upto[hash - 1];
  if (before && !/[\s([{"'—–-]/.test(before)) return null;

  const query = upto.slice(hash + 1);
  if (query.length > MAX_QUERY) return null;
  if (/[\n\r]/.test(query)) return null;
  // Already a finished token, or the start of one — leave it alone.
  if (query.startsWith("[")) return null;

  return { start: hash, end: caret, query };
}
