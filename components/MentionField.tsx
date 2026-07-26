"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { LIMIT, MentionPopover } from "@/components/MentionPopover";
import {
  caretOffset,
  caretPoint,
  MENTION_ID,
  placeCaret,
  readField,
  writeField,
  type CaretPoint,
} from "@/lib/mention-dom";
import { mentionToken, readQuery } from "@/lib/mentions";
import {
  matchThoughts,
  thoughtIndex,
  type IndexedThought,
} from "@/lib/thought-index";

/**
 * A writing field where a mentioned thought is a chip, not its own storage
 * format.
 *
 * Type `#`, see the thoughts you could be talking about, arrow to one, press
 * enter. What lands in the sentence is the thought's title, set as one object:
 * the caret steps around it and a single backspace takes all of it. The id it
 * carries is never on screen — it is in the element, and it comes back out
 * when the text is read.
 *
 * The same field in the capture box, in a thought's own body, and in the
 * question you ask. Only what happens on a click differs: in a body a chip is
 * a door to that thought, and in a composer it is a word you are still
 * writing.
 */
export default function MentionField({
  value,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
  placeholder,
  className = "",
  wrapperClassName = "",
  ariaLabel,
  fieldRef,
  autoFocus = false,
  enterKeyHint,
  linkMentions = false,
  suppressHydrationWarning = false,
}: {
  value: string;
  onChange: (next: string) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLDivElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLDivElement>) => void;
  placeholder?: string;
  className?: string;
  /** For the cases where the field is a flex child and the sizing belongs to
   *  the box around it, not to the writing surface. */
  wrapperClassName?: string;
  ariaLabel?: string;
  /** Callback ref, for a screen that mounts two shells and writes to whichever
   *  one the stylesheet is showing. */
  fieldRef?: (element: HTMLDivElement | null) => void;
  autoFocus?: boolean;
  enterKeyHint?: React.HTMLAttributes<HTMLDivElement>["enterKeyHint"];
  /** True where a chip is a way to that thought rather than a word in a draft. */
  linkMentions?: boolean;
  suppressHydrationWarning?: boolean;
}) {
  const router = useRouter();
  const index = useSyncExternalStore(
    thoughtIndex.subscribe,
    thoughtIndex.getSnapshot,
    thoughtIndex.getServerSnapshot
  );

  const host = useRef<HTMLDivElement | null>(null);
  /** What the DOM currently spells. The field is uncontrolled between
   *  keystrokes — redrawing it on each one would move the caret to the end. */
  const drawn = useRef<string>("");

  const [range, setRange] = useState<{ start: number; end: number } | null>(null);
  const [query, setQuery] = useState("");
  const [point, setPoint] = useState<CaretPoint | null>(null);
  const [cursor, setCursor] = useState(0);
  /** Where a `#` was waved away. Escape has to mean it — a list that comes
   *  back on the next letter is a list you have to dismiss twice. */
  const dismissed = useRef<number | null>(null);

  const attach = useCallback(
    (element: HTMLDivElement | null) => {
      host.current = element;
      if (element && element.textContent === "" && drawn.current === "") {
        // First mount: draw whatever was handed in before anyone types.
        writeField(element, value);
        drawn.current = value;
      }
      fieldRef?.(element);
    },
    // `value` is deliberately read once, on attach: after that the effect below
    // owns redrawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fieldRef]
  );

  // A change from outside — a draft restored, a save coming back, the other
  // shell being typed into — is the only reason to rebuild the field.
  useEffect(() => {
    const element = host.current;
    if (!element || value === drawn.current) return;
    drawn.current = value;
    writeField(element, value);
  }, [value]);

  useEffect(() => {
    if (autoFocus) host.current?.focus();
  }, [autoFocus]);

  const close = useCallback(() => {
    setRange(null);
    setQuery("");
    setPoint(null);
    setCursor(0);
  }, []);

  /** Read the caret's surroundings and decide whether a `#` is in progress. */
  const refresh = useCallback(() => {
    const element = host.current;
    if (!element) return;

    const caret = caretOffset(element);
    if (caret === null) return close();

    const found = readQuery(readField(element), caret);
    if (!found) {
      dismissed.current = null;
      return close();
    }
    if (dismissed.current === found.start) return;

    thoughtIndex.load();
    setRange({ start: found.start, end: found.end });
    setQuery(found.query);
    setPoint(caretPoint(element));
  }, [close]);

  const matches = range ? matchThoughts(index.thoughts, query, LIMIT) : [];
  const total = range
    ? matchThoughts(index.thoughts, query, Number.MAX_SAFE_INTEGER).length
    : 0;
  const open = Boolean(range && point && matches.length > 0);
  // The list can shrink under the cursor when the index finishes loading, so
  // the highlighted row is clamped rather than trusted.
  const active = matches.length ? Math.min(cursor, matches.length - 1) : 0;

  // A new query is a new list, and the first row is the answer often enough
  // that starting anywhere else would cost a keystroke.
  useEffect(() => {
    setCursor(0);
  }, [query]);

  function read() {
    const element = host.current;
    if (!element) return;
    const next = readField(element);
    drawn.current = next;
    // Deleting the last character leaves a browser's own `br` behind, and an
    // element holding one is not `:empty` — which is what the placeholder is
    // waiting for. Emptied means emptied.
    if (!next && element.childNodes.length) writeField(element, "");
    onChange(next);
  }

  const insert = useCallback(
    (thought: IndexedThought) => {
      const element = host.current;
      if (!element || !range) return;

      const current = readField(element);
      const token = `${mentionToken(thought.title, thought.id)} `;
      const next =
        current.slice(0, range.start) + token + current.slice(range.end);

      // Redrawn rather than patched: the chip is a new element, and the caret
      // has to land after it in the same frame or the next keystroke goes
      // inside it.
      drawn.current = next;
      writeField(element, next);
      element.focus();
      placeCaret(element, range.start + token.length);

      onChange(next);
      close();
    },
    [close, onChange, range]
  );

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setCursor(
          event.key === "ArrowDown"
            ? (active + 1) % matches.length
            : (active - 1 + matches.length) % matches.length
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const picked = matches[active];
        if (picked) insert(picked);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        dismissed.current = range?.start ?? null;
        close();
        return;
      }
    }
    onKeyDown?.(event);
  }

  const reposition = useCallback(() => {
    const element = host.current;
    if (element) setPoint(caretPoint(element));
  }, []);

  return (
    <div className={`relative ${wrapperClassName}`}>
      <div
        ref={attach}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        contentEditable
        suppressContentEditableWarning
        suppressHydrationWarning={suppressHydrationWarning}
        enterKeyHint={enterKeyHint}
        spellCheck
        onInput={() => {
          read();
          refresh();
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={refresh}
        onMouseUp={refresh}
        onFocus={(event) => onFocus?.(event)}
        onBlur={(event) => {
          close();
          onBlur?.(event);
        }}
        // Pasting rich text into a field whose only formatting is a mention
        // would bring markup nothing here can read, so it arrives as words.
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain");
          if (text) document.execCommand("insertText", false, text);
          read();
          refresh();
        }}
        onClick={(event) => {
          if (!linkMentions) return;
          const chip = (event.target as HTMLElement).closest(`[${MENTION_ID}]`);
          const id = chip?.getAttribute(MENTION_ID);
          if (id) router.push(`/thoughts/${id}`);
        }}
        data-placeholder={placeholder}
        className={`flux-field ${linkMentions ? "flux-field-links" : ""} ${className}`}
      />

      <MentionPopover
        open={open}
        point={point}
        query={query}
        matches={matches}
        hidden={total - matches.length}
        cursor={active}
        onHover={setCursor}
        onPick={insert}
        onReposition={reposition}
      />
    </div>
  );
}
