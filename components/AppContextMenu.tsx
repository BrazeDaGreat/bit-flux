"use client";

import {
  ClipboardCopy,
  ClipboardPaste,
  Keyboard,
  PictureInPicture2,
  RefreshCw,
  RotateCw,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  type ContextMenuPoint,
} from "@/components/ContextMenu";
import { freshness } from "@/lib/freshness";
import { shortcutsStore } from "@/lib/shortcuts-store";
import { stickyStore } from "@/lib/sticky-store";

interface OpenMenu {
  point: ContextMenuPoint;
  copyText: string;
  pasteTarget: PasteTarget | null;
}

type PasteTarget =
  | {
      kind: "control";
      element: HTMLInputElement | HTMLTextAreaElement;
      start: number;
      end: number;
    }
  | {
      kind: "editable";
      element: HTMLElement;
      range: Range;
    };

/**
 * The app's answer to a right-click that no more specific surface claimed.
 *
 * This listens at document level so Thought rows and the rail can keep their
 * own menus. Their React handlers prevent the native event first; by the time
 * it reaches this listener, `defaultPrevented` tells us to stand down.
 */
export default function AppContextMenu() {
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const open = (event: MouseEvent) => {
      if (event.defaultPrevented) {
        setMenu(null);
        return;
      }

      event.preventDefault();
      const target = event.target instanceof HTMLElement ? event.target : null;
      setMenu({
        point: { x: event.clientX, y: event.clientY },
        copyText: selectedText(target),
        pasteTarget: capturePasteTarget(target),
      });
    };

    document.addEventListener("contextmenu", open);
    return () => document.removeEventListener("contextmenu", open);
  }, []);

  const refetch = useCallback(() => {
    freshness.mark(pathname);
    router.refresh();
  }, [pathname, router]);

  const copy = useCallback(async () => {
    if (!menu?.copyText || !navigator.clipboard) return;
    await navigator.clipboard.writeText(menu.copyText);
  }, [menu]);

  const paste = useCallback(async () => {
    if (!menu?.pasteTarget || !navigator.clipboard) return;
    const text = await navigator.clipboard.readText();
    insertClipboardText(menu.pasteTarget, text);
  }, [menu]);

  const hasClipboard = typeof navigator !== "undefined" && Boolean(navigator.clipboard);

  return (
    <ContextMenu
      point={menu?.point ?? null}
      onClose={() => setMenu(null)}
      ariaLabel="Page actions"
    >
      <ContextMenuItem
        icon={<PictureInPicture2 />}
        onClick={() => stickyStore.request()}
      >
        Open PiP
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem
        icon={<ClipboardCopy />}
        hint="Ctrl+C"
        disabled={!hasClipboard || !menu?.copyText}
        onClick={() => void copy().catch(() => undefined)}
      >
        Copy
      </ContextMenuItem>
      <ContextMenuItem
        icon={<ClipboardPaste />}
        hint="Ctrl+V"
        disabled={!hasClipboard || !menu?.pasteTarget}
        onClick={() => void paste().catch(() => undefined)}
      >
        Paste
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem icon={<RefreshCw />} onClick={refetch}>
        Re-fetch Data
      </ContextMenuItem>
      <ContextMenuItem icon={<RotateCw />} onClick={() => window.location.reload()}>
        Refresh Page
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem icon={<Keyboard />} onClick={() => shortcutsStore.request()}>
        Keyboard Shortcuts
      </ContextMenuItem>
    </ContextMenu>
  );
}

const PASTEABLE_INPUT_TYPES = new Set([
  "text",
  "search",
  "url",
  "tel",
  "email",
  "password",
]);

function selectedText(target: HTMLElement | null): string {
  if (
    (target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement) &&
    target.selectionStart !== null &&
    target.selectionEnd !== null &&
    target.selectionStart !== target.selectionEnd
  ) {
    return target.value.slice(target.selectionStart, target.selectionEnd);
  }

  return window.getSelection()?.toString() ?? "";
}

function capturePasteTarget(target: HTMLElement | null): PasteTarget | null {
  if (
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLInputElement &&
      PASTEABLE_INPUT_TYPES.has(target.type))
  ) {
    if (target.disabled || target.readOnly) return null;
    return {
      kind: "control",
      element: target,
      start: target.selectionStart ?? target.value.length,
      end: target.selectionEnd ?? target.value.length,
    };
  }

  const editable = target?.closest<HTMLElement>(
    '[contenteditable="true"], [contenteditable="plaintext-only"]'
  );
  if (!editable) return null;

  const selection = window.getSelection();
  if (selection?.rangeCount) {
    const range = selection.getRangeAt(0);
    const common =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentNode
        : range.commonAncestorContainer;
    if (common && editable.contains(common)) {
      return { kind: "editable", element: editable, range: range.cloneRange() };
    }
  }

  const range = document.createRange();
  range.selectNodeContents(editable);
  range.collapse(false);
  return { kind: "editable", element: editable, range };
}

function insertClipboardText(target: PasteTarget, text: string) {
  if (target.kind === "control") {
    const { element, start, end } = target;
    const next = `${element.value.slice(0, start)}${text}${element.value.slice(end)}`;
    const prototype =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, next);
    element.focus();
    element.setSelectionRange(start + text.length, start + text.length);
    element.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertFromPaste",
        data: text,
      })
    );
    return;
  }

  const { element, range } = target;
  element.focus();
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  element.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertFromPaste",
      data: text,
    })
  );
}
