"use client";

import {
  Archive,
  ArrowRight,
  CheckCircle2,
  Circle,
  Telescope,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSubmenu,
  useContextMenuTrigger,
} from "@/components/ContextMenu";
import type { Bucket } from "./filters";
import { BUCKETS } from "./useThoughtsBrowser";

export default function ThoughtsBucketActions({
  bucket,
  label,
  count,
  active,
  busy,
  className,
  style,
  children,
  onSelect,
  onMoveAll,
  onRemoveAll,
}: {
  bucket: Bucket;
  label: string;
  count: number;
  active: boolean;
  busy: boolean;
  className: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  onSelect: () => void;
  onMoveAll: (from: Bucket, to: Bucket) => Promise<void>;
  onRemoveAll: (bucket: Bucket) => Promise<void>;
}) {
  const { point, close, contextMenuProps } =
    useContextMenuTrigger<HTMLButtonElement>();
  const [confirmingCount, setConfirmingCount] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const cancelRemove = useCallback(() => setConfirmingCount(null), []);

  async function removeAll() {
    setRemoving(true);
    await onRemoveAll(bucket);
    setRemoving(false);
    setConfirmingCount(null);
  }

  return (
    <>
      <button
        type="button"
        aria-pressed={active}
        aria-label={label}
        disabled={busy}
        onClick={onSelect}
        className={className}
        style={style}
        {...contextMenuProps}
      >
        {children}
      </button>

      <ContextMenu
        point={point}
        onClose={close}
        ariaLabel={`Actions for all ${label.toLowerCase()} thoughts`}
      >
        <ContextMenuSubmenu
          id={`move-all-${bucket}`}
          label="Move All To"
          ariaLabel={`Move all ${label.toLowerCase()} thoughts to`}
          icon={<ArrowRight />}
        >
          {BUCKETS.filter((option) => option.key !== bucket).map((option) => (
            <ContextMenuItem
              key={option.key}
              icon={STATUS_ICONS[option.key]}
              disabled={count === 0 || busy}
              onClick={() => void onMoveAll(bucket, option.key)}
            >
              {option.label}
            </ContextMenuItem>
          ))}
        </ContextMenuSubmenu>

        <ContextMenuSeparator />

        <ContextMenuItem
          icon={<Trash2 />}
          hint={String(count)}
          danger
          disabled={count === 0 || busy}
          onClick={() => setConfirmingCount(count)}
        >
          Remove All
        </ContextMenuItem>
      </ContextMenu>

      {confirmingCount !== null && (
        <RemoveAllDialog
          label={label}
          count={confirmingCount}
          busy={removing}
          onCancel={cancelRemove}
          onConfirm={() => void removeAll()}
        />
      )}
    </>
  );
}

const STATUS_ICONS: Record<Bucket, React.ReactNode> = {
  open: <Circle />,
  done: <CheckCircle2 />,
  longterm: <Telescope />,
  archived: <Archive />,
};

function RemoveAllDialog({
  label,
  count,
  busy,
  onCancel,
  onConfirm,
}: {
  label: string;
  count: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [value, setValue] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled)'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [busy, onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-ink/25 p-4 backdrop-blur-[2px]"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-all-title"
        aria-describedby="remove-all-description"
        className="w-full max-w-[25rem] rounded-2xl border border-line-strong bg-surface p-5 shadow-[var(--shadow-window)] outline-none motion-safe:animate-[flux-unfold_140ms_ease-out]"
      >
        <div className="mb-4 flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blush-soft text-blush [&>svg]:h-4 [&>svg]:w-4 [&>svg]:stroke-[1.7]"
          >
            <Trash2 />
          </span>
          <div>
            <h2 id="remove-all-title" className="text-[1rem] font-medium text-ink">
              Remove all {label.toLowerCase()} thoughts?
            </h2>
            <p
              id="remove-all-description"
              className="mt-1 text-[0.82rem] leading-relaxed text-ink-soft"
            >
              This permanently deletes {count} thought{count === 1 ? "" : "s"}.
              Type <strong className="font-data text-ink">CONFIRM</strong> to
              continue.
            </p>
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block font-data text-[0.64rem] uppercase tracking-[0.12em] text-ink-faint">
            Confirmation
          </span>
          <input
            ref={inputRef}
            value={value}
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && value === "CONFIRM" && !busy) {
                onConfirm();
              }
            }}
            placeholder="Type CONFIRM"
            className="input h-10 font-data tracking-[0.08em]"
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="tap rounded-full px-4 text-[0.86rem] text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={value !== "CONFIRM" || busy}
            onClick={onConfirm}
            className="tap rounded-full bg-blush px-4 text-[0.86rem] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
          >
            {busy ? "Removing…" : `Remove ${count}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
