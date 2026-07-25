"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { composerStore } from "@/lib/composer-store";

/**
 * The window's bottom edge.
 *
 * On a desktop the app is one rounded window floating on the page, and the rail
 * is the lit top edge of it. A phone has nothing to float in, so the window
 * fills the screen — and the frame that made it an object has to be carried by
 * its two edges instead of its outline. This is the other one: the same border,
 * the same surface, the same inset highlight along its upper face, because a
 * frame lit from above catches light on the top of its sill as well as the top
 * of its head.
 *
 * Four places, always on screen, always in the same order. Navigation you have
 * to open is navigation you forget you have.
 */
const NAV = [
  { href: "/", label: "Write", icon: PenIcon },
  { href: "/thoughts", label: "Thoughts", icon: ListIcon },
  { href: "/ask", label: "Ask", icon: BubbleIcon },
  { href: "/tags", label: "Tags", icon: TagIcon },
];

export default function MobileNav() {
  const pathname = usePathname();
  // Steps out of the way while a composer has the caret — see composer-store.
  const typing = useSyncExternalStore(
    composerStore.subscribe,
    composerStore.getSnapshot,
    composerStore.getServerSnapshot
  );

  if (typing) return null;

  return (
    <nav
      aria-label="Main"
      className="flex shrink-0 items-stretch border-t border-line bg-surface-2 md:hidden"
      style={{
        height: "calc(var(--sill-h) + var(--safe-bottom))",
        paddingBottom: "var(--safe-bottom)",
        boxShadow: "inset 0 1px 0 var(--rail-highlight)",
      }}
    >
      {NAV.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${
              active ? "text-iris" : "text-ink-faint"
            }`}
          >
            {/* The same 2px rule the bucket tabs use, on the edge this control
                sits against. */}
            <span
              aria-hidden="true"
              className={`absolute top-0 h-[2px] w-7 rounded-full transition-opacity ${
                active ? "bg-iris opacity-100" : "opacity-0"
              }`}
            />
            <Icon />
            <span className="text-[0.68rem] font-medium leading-none">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/* Drawn here rather than imported, in the same hand as the view switcher on the
   Thoughts screen — 16px box, 1.4 stroke, round caps. Two of the four are
   literally its paths, so "a list of your thoughts" and "a tag" are one drawing
   wherever they appear. */
const common = {
  viewBox: "0 0 16 16",
  className: "h-[1.15rem] w-[1.15rem]",
  "aria-hidden": true,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
};

function PenIcon() {
  return (
    <svg {...common}>
      <path d="M3.2 12.8 4 10l6.2-6.2a1.3 1.3 0 0 1 1.8 1.8L5.8 11.8z" strokeLinejoin="round" />
      <path d="M9.6 4.6l1.8 1.8" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg {...common}>
      <path d="M3 4.5h10M3 8h10M3 11.5h6" />
    </svg>
  );
}

function BubbleIcon() {
  return (
    <svg {...common}>
      <path
        d="M13.4 8c0 2.4-2.4 4.3-5.4 4.3-.6 0-1.2-.1-1.7-.2l-3.1 1.2 1-2.4A4.1 4.1 0 0 1 2.6 8c0-2.4 2.4-4.3 5.4-4.3S13.4 5.6 13.4 8Z"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg {...common}>
      <path d="M8.6 2.5H13v4.4l-6 6-4.4-4.4z" strokeLinejoin="round" />
      <circle cx="10.6" cy="5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
