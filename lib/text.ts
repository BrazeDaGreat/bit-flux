/** Tags reasoning models wrap their scratch work in before the real answer. */
const REASONING = "think|thought|thinking|reasoning|reflection|scratchpad";

const PAIRED = new RegExp(`<(${REASONING})\\b[^>]*>[\\s\\S]*?</\\1\\s*>`, "gi");
const DANGLING_CLOSE = new RegExp(`^[\\s\\S]*</(?:${REASONING})\\s*>`, "i");
const DANGLING_OPEN = new RegExp(`<(?:${REASONING})\\b[^>]*>[\\s\\S]*$`, "i");
const MARKERS = new RegExp(`</?(?:${REASONING})\\b[^>]*>`, "gi");

/**
 * Strips a model's private reasoning out of its answer.
 *
 * Providers are inconsistent about this: some return a clean `<think>…</think>`
 * pair, some drop the opening tag and leave a stray `</think>`, and some get
 * cut off mid-thought with no closing tag at all. Each case is handled.
 *
 * When a reply is nothing but reasoning there is no answer to salvage, so the
 * text is kept and only the tags come off: a half-formed answer is more use
 * than a blank one, and either way no markup reaches the reader.
 */
export function stripReasoning(text: string): string {
  let out = text.replace(PAIRED, "");

  // A stray close means everything before it was reasoning.
  if (DANGLING_CLOSE.test(out)) out = out.replace(DANGLING_CLOSE, "");
  // A stray open means everything after it is.
  if (DANGLING_OPEN.test(out)) out = out.replace(DANGLING_OPEN, "");

  out = out.trim();
  return out || text.replace(MARKERS, "").trim();
}
