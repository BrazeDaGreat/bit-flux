"use client";

import { Check, ChevronRight } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export interface ContextMenuPoint {
  x: number;
  y: number;
}

interface ContextMenuState {
  close: () => void;
  openSubmenu: string | null;
  setOpenSubmenu: (id: string | null) => void;
  submenuSide: "left" | "right";
  depth: number;
}

const ContextMenuStateContext = createContext<ContextMenuState | null>(null);

function useContextMenuState() {
  const state = useContext(ContextMenuStateContext);
  if (!state) {
    throw new Error("Context menu components must be inside <ContextMenu>");
  }
  return state;
}

/** Right-click plus keyboard-context-menu bindings for any target element. */
export function useContextMenuTrigger<T extends HTMLElement = HTMLElement>() {
  const [point, setPoint] = useState<ContextMenuPoint | null>(null);
  const close = useCallback(() => setPoint(null), []);
  const openAt = useCallback((next: ContextMenuPoint) => setPoint(next), []);

  const onContextMenu = useCallback(
    (event: React.MouseEvent<T>) => {
      event.preventDefault();
      openAt({ x: event.clientX, y: event.clientY });
    },
    [openAt]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<T>) => {
      if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) {
        return;
      }
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      openAt({ x: rect.left + Math.min(36, rect.width / 2), y: rect.top + 32 });
    },
    [openAt]
  );

  return {
    point,
    openAt,
    close,
    contextMenuProps: { onContextMenu, onKeyDown },
  };
}

export function ContextMenu({
  point,
  onClose,
  ariaLabel,
  children,
  className = "",
}: {
  point: ContextMenuPoint | null;
  onClose: () => void;
  ariaLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (!point) return null;
  return (
    <ContextMenuContent
      key={`${point.x}:${point.y}`}
      point={point}
      onClose={onClose}
      ariaLabel={ariaLabel}
      className={className}
    >
      {children}
    </ContextMenuContent>
  );
}

function ContextMenuContent({
  point: initialPoint,
  onClose,
  ariaLabel,
  children,
  className,
}: {
  point: ContextMenuPoint;
  onClose: () => void;
  ariaLabel: string;
  children: React.ReactNode;
  className: string;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState(initialPoint);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const padding = 8;
    const x = Math.max(padding, Math.min(point.x, window.innerWidth - rect.width - padding));
    const y = Math.max(
      padding,
      Math.min(point.y, window.innerHeight - rect.height - padding)
    );
    if (x !== point.x || y !== point.y) setPoint({ x, y });
  }, [point]);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const closeForViewportChange = () => onClose();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("blur", closeForViewportChange);
    window.addEventListener("resize", closeForViewportChange);
    window.addEventListener("scroll", closeForViewportChange, true);
    menuRef.current
      ?.querySelector<HTMLButtonElement>('[role^="menuitem"]')
      ?.focus();

    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("blur", closeForViewportChange);
      window.removeEventListener("resize", closeForViewportChange);
      window.removeEventListener("scroll", closeForViewportChange, true);
    };
  }, [onClose]);

  const state: ContextMenuState = {
    close: onClose,
    openSubmenu,
    setOpenSubmenu,
    submenuSide: point.x + 470 > window.innerWidth ? "left" : "right",
    depth: 0,
  };

  return createPortal(
    <ContextMenuStateContext.Provider value={state}>
      <div
        ref={menuRef}
        role="menu"
        aria-label={ariaLabel}
        onKeyDown={moveMenuFocus}
        className={`fixed z-[100] w-56 rounded-xl border border-line-strong bg-surface p-1.5 text-[0.78rem] text-ink shadow-[var(--shadow-window)] outline-none motion-safe:animate-[flux-unfold_120ms_ease-out] ${className}`}
        style={{ left: point.x, top: point.y }}
      >
        {children}
      </div>
    </ContextMenuStateContext.Provider>,
    document.body
  );
}

export function ContextMenuItem({
  icon,
  trailing,
  hint,
  danger = false,
  closeOnSelect = true,
  preserveSubmenu = false,
  children,
  className = "",
  onClick,
  onMouseEnter,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  /** A quiet answer to "which one is that", set beside the label rather than
   *  inside it — the date behind "Tomorrow", the count behind a filter. */
  hint?: React.ReactNode;
  danger?: boolean;
  closeOnSelect?: boolean;
  preserveSubmenu?: boolean;
}) {
  const state = useContextMenuState();

  return (
    <button
      type="button"
      role="menuitem"
      className={`group/menu flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors focus-visible:outline-none ${
        danger
          ? "text-ink-faint hover:bg-blush-soft hover:text-blush focus-visible:bg-blush-soft focus-visible:text-blush"
          : "text-ink-soft hover:bg-surface-2 hover:text-ink focus-visible:bg-surface-2 focus-visible:text-ink"
      } ${className}`}
      onMouseEnter={(event) => {
        if (!preserveSubmenu && state.depth === 0) state.setOpenSubmenu(null);
        onMouseEnter?.(event);
      }}
      onClick={(event) => {
        onClick?.(event);
        if (closeOnSelect && !event.defaultPrevented) state.close();
      }}
      {...props}
    >
      {icon && <ContextMenuIcon>{icon}</ContextMenuIcon>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && (
        <span className="shrink-0 font-data text-[0.62rem] text-ink-faint">
          {hint}
        </span>
      )}
      {trailing && (
        <span
          aria-hidden="true"
          className="grid h-4 w-4 shrink-0 place-items-center text-ink-faint [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:stroke-[1.7]"
        >
          {trailing}
        </span>
      )}
    </button>
  );
}

export function ContextMenuSubmenu({
  id,
  label,
  icon,
  ariaLabel = label,
  children,
  className = "",
}: {
  id: string;
  label: string;
  icon?: React.ReactNode;
  ariaLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const state = useContextMenuState();
  const open = state.openSubmenu === id;

  return (
    <div className="relative" onMouseEnter={() => state.setOpenSubmenu(id)}>
      <ContextMenuItem
        icon={icon}
        trailing={<ChevronRight />}
        closeOnSelect={false}
        preserveSubmenu
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => state.setOpenSubmenu(open ? null : id)}
      >
        {label}
      </ContextMenuItem>
      {open && (
        <ContextMenuStateContext.Provider value={{ ...state, depth: state.depth + 1 }}>
          {/* Two panels, not one wide one. The outer element is the gap: it is
              padding rather than margin so the pointer stays inside the
              submenu's own subtree while it crosses, which is what keeps the
              gap from being a place the menu closes. */}
          <div
            className={`absolute top-0 z-10 ${
              state.submenuSide === "left"
                ? "right-full pr-2.5"
                : "left-full pl-2.5"
            }`}
          >
            <div
              role="menu"
              aria-label={ariaLabel}
              className={`w-56 rounded-xl border border-line-strong bg-surface p-1.5 shadow-[var(--shadow-window)] motion-safe:animate-[flux-unfold_120ms_ease-out] ${className}`}
            >
              {children}
            </div>
          </div>
        </ContextMenuStateContext.Provider>
      )}
    </div>
  );
}

export function ContextMenuCheckboxItem({
  checked,
  tone = "iris",
  children,
  onCheckedChange,
}: {
  checked: boolean;
  tone?: string;
  children: React.ReactNode;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <ContextMenuItem
      role="menuitemcheckbox"
      aria-checked={checked}
      closeOnSelect={false}
      icon={
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: `var(--${tone})`, opacity: checked ? 1 : 0.42 }}
        />
      }
      trailing={
        <Check
          className={checked ? "opacity-100" : "opacity-0"}
          style={{ color: `var(--${tone})` }}
        />
      }
      className={
        checked
          ? "text-ink"
          : "text-ink-faint opacity-60 transition-opacity hover:opacity-100"
      }
      style={checked ? { background: `var(--${tone}-soft)` } : undefined}
      onClick={() => onCheckedChange(!checked)}
    >
      {children}
    </ContextMenuItem>
  );
}

export function ContextMenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pb-1.5 pt-1 font-data text-[0.6rem] uppercase tracking-[0.13em] text-ink-faint">
      {children}
    </p>
  );
}

export function ContextMenuEmpty({ children }: { children: React.ReactNode }) {
  return <p className="px-2 py-2 text-[0.74rem] text-ink-faint">{children}</p>;
}

export function ContextMenuSeparator() {
  return <div className="my-1 h-px bg-line" role="separator" />;
}

function ContextMenuIcon({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="grid h-4 w-4 shrink-0 place-items-center [&>svg]:h-[15px] [&>svg]:w-[15px] [&>svg]:stroke-[1.7]"
    >
      {children}
    </span>
  );
}

function moveMenuFocus(event: React.KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();
  const items = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role^="menuitem"]:not(:disabled)'
    ),
  ];
  const current = items.indexOf(document.activeElement as HTMLButtonElement);
  const direction = event.key === "ArrowDown" ? 1 : -1;
  const next = current < 0 ? 0 : (current + direction + items.length) % items.length;
  items[next]?.focus();
}
