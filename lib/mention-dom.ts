"use client";

import { mentionToken, splitMentions } from "./mentions";

/**
 * The bridge between the text a mention is stored as and the text a person
 * sees while they are writing it.
 *
 * A textarea can only hold characters, so `#[Dentist](kd91…)` sits in the
 * middle of the sentence you are editing — the id is storage, and storage is
 * not something anyone should have to read around. So the field is a
 * contenteditable element instead, and a mention is drawn in it as one
 * undeletable-by-halves chip.
 *
 * Everything here exists to keep those two views in step: the DOM is built
 * from the stored string, and the stored string is read back out of the DOM
 * after every keystroke. One function does the reading, and caret positions
 * are measured with that same function, so an offset can never mean one thing
 * to the text and another to the browser.
 */

export const MENTION_ID = "data-mention-id";
export const MENTION_TITLE = "data-mention-title";

/** Elements a browser puts a line of text in when Enter is pressed. Which one
 *  it picks is not ours to choose — Chrome wraps lines in divs, Firefox
 *  separates them with `br` — so reading handles both. */
const BLOCK = new Set([
  "DIV",
  "P",
  "LI",
  "UL",
  "OL",
  "BLOCKQUOTE",
  "PRE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
]);

function isBlock(element: HTMLElement): boolean {
  return BLOCK.has(element.tagName);
}

function tokenOf(element: HTMLElement): string {
  return mentionToken(
    element.getAttribute(MENTION_TITLE) ?? element.textContent?.slice(1) ?? "",
    element.getAttribute(MENTION_ID) ?? ""
  );
}

/**
 * The `br` a browser leaves at the end of an empty line so the line has a
 * height. It is scaffolding, not a newline the person typed, and counting it
 * would grow the text by a blank line every time Enter was pressed.
 */
function isFiller(node: Node, root: HTMLElement): boolean {
  const parent = node.parentNode;
  if (!parent || node !== parent.lastChild) return false;
  return parent === root || (parent instanceof HTMLElement && isBlock(parent));
}

/**
 * The field, as text. Stops early at `stop` when one is given, which is how a
 * caret position becomes a string offset — same walk, same rules, so the two
 * cannot disagree.
 */
export function readField(
  root: HTMLElement,
  stop?: { node: Node; offset: number }
): string {
  let out = "";
  let done = false;

  const walk = (node: Node) => {
    const children = Array.from(node.childNodes);
    // A caret sitting *between* children of an element is expressed as a count
    // of the children before it.
    const limit =
      stop && node === stop.node && stop.node.nodeType !== Node.TEXT_NODE
        ? Math.min(stop.offset, children.length)
        : children.length;

    for (let i = 0; i < children.length && !done; i += 1) {
      if (i >= limit) {
        done = true;
        return;
      }
      const child = children[i];

      if (child.nodeType === Node.TEXT_NODE) {
        const text = (child as Text).data;
        if (stop && child === stop.node) {
          out += text.slice(0, stop.offset);
          done = true;
          return;
        }
        out += text;
        continue;
      }

      if (!(child instanceof HTMLElement)) continue;

      if (child.getAttribute(MENTION_ID)) {
        out += tokenOf(child);
        continue;
      }

      if (child.tagName === "BR") {
        if (!isFiller(child, root)) out += "\n";
        continue;
      }

      if (isBlock(child) && out && !out.endsWith("\n")) out += "\n";
      walk(child);
    }
  };

  walk(root);
  return out;
}

/** Where the caret is, as an offset into what `readField` would return. */
export function caretOffset(root: HTMLElement): number | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!range.collapsed) return null;
  if (!root.contains(range.startContainer)) return null;

  return readField(root, {
    node: range.startContainer,
    offset: range.startOffset,
  }).length;
}

function chip(title: string, id: string): HTMLElement {
  const element = document.createElement("span");
  element.setAttribute(MENTION_ID, id);
  element.setAttribute(MENTION_TITLE, title);
  // One object: the caret goes around it, and one backspace takes all of it.
  element.setAttribute("contenteditable", "false");
  element.className = "flux-mention";
  element.textContent = `#${title}`;
  return element;
}

/** Draw the stored text into the field. Only ever called when the two have
 *  actually diverged — rebuilding on every keystroke would move the caret. */
export function writeField(root: HTMLElement, value: string) {
  const nodes: Node[] = [];
  for (const part of splitMentions(value)) {
    if (part.kind === "text") {
      if (part.value) nodes.push(document.createTextNode(part.value));
    } else {
      nodes.push(chip(part.title, part.id));
    }
  }
  root.replaceChildren(...nodes);
}

/** Put the caret at a string offset. Used after the field has been redrawn,
 *  so the shape it walks is the one `writeField` just made. */
export function placeCaret(root: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  let left = offset;
  let placed = false;

  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (placed) return;

      if (child.nodeType === Node.TEXT_NODE) {
        const length = (child as Text).length;
        if (left <= length) {
          range.setStart(child, left);
          placed = true;
          return;
        }
        left -= length;
        continue;
      }

      if (!(child instanceof HTMLElement)) continue;

      if (child.getAttribute(MENTION_ID)) {
        const length = tokenOf(child).length;
        if (left <= length) {
          range.setStartAfter(child);
          placed = true;
          return;
        }
        left -= length;
        continue;
      }

      if (child.tagName === "BR") {
        if (left <= 1) {
          range.setStartAfter(child);
          placed = true;
          return;
        }
        left -= 1;
        continue;
      }

      walk(child);
    }
  };

  walk(root);

  if (!placed) {
    range.selectNodeContents(root);
    range.collapse(false);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

export interface CaretPoint {
  left: number;
  top: number;
  height: number;
}

/** Where the caret is on screen, so the picker opens at the word being typed
 *  rather than at the corner of the box. */
export function caretPoint(root: HTMLElement): CaretPoint | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(true);

  const rect = range.getClientRects()[0];
  if (rect) return { left: rect.left, top: rect.top, height: rect.height };

  // A caret at an element boundary has no rectangle of its own; the element it
  // sits in is close enough to hang a panel from.
  const holder =
    range.startContainer instanceof HTMLElement
      ? range.startContainer
      : (range.startContainer.parentElement ?? root);
  const box = holder.getBoundingClientRect();
  return { left: box.left, top: box.top, height: box.height };
}
