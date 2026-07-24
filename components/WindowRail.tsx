"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Wind } from "lucide-react";

import { clearAuth } from "@/lib/pb";
import type { UserRecord } from "@/lib/types";
import ThemeModeToggle from "./ThemeModeToggle";
import ThemePicker from "./ThemePicker";

const NAV = [
  { href: "/", label: "Capture" },
  { href: "/thoughts", label: "Thoughts" },
  { href: "/review", label: "Review" },
  { href: "/tags", label: "Tags" },
  { href: "/ask", label: "Ask" },
];

export default function WindowRail({ user }: { user: UserRecord }) {
  const pathname = usePathname();
  const router = useRouter();

  function signOut() {
    clearAuth();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header
      className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface-2 px-3 sm:px-5"
      style={{ boxShadow: "inset 0 1px 0 var(--rail-highlight)" }}
    >
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2 rounded-lg px-1 py-1"
      >
        <Wind className="h-4 w-4 text-ink" strokeWidth={2} />
        <span className="text-[0.95rem] font-semibold tracking-tight text-ink">
          BIT Flux
        </span>
      </Link>

      <nav className="ml-1 flex min-w-0 items-center gap-0.5 overflow-x-auto">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 rounded-full px-2.5 py-1.5 text-[0.8rem] font-medium transition-colors ${
                active
                  ? "bg-iris-soft text-iris"
                  : "text-ink-soft hover:bg-surface-3 hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <ThemeModeToggle />
        <ThemePicker />
        <Link
          href="/settings"
          aria-label="Settings"
          className="rounded-full p-1.5 text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
            <path d="M10 6.5A3.5 3.5 0 1 0 10 13.5 3.5 3.5 0 0 0 10 6.5Zm0 5.5a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
            <path d="m17.3 11.4-.9-.5a6.6 6.6 0 0 0 0-1.8l.9-.5a1 1 0 0 0 .4-1.3l-.8-1.4a1 1 0 0 0-1.3-.4l-.9.5a6.4 6.4 0 0 0-1.6-.9V4a1 1 0 0 0-1-1h-1.6a1 1 0 0 0-1 1v1.1a6.4 6.4 0 0 0-1.6.9l-.9-.5a1 1 0 0 0-1.3.4l-.8 1.4a1 1 0 0 0 .4 1.3l.9.5a6.6 6.6 0 0 0 0 1.8l-.9.5a1 1 0 0 0-.4 1.3l.8 1.4a1 1 0 0 0 1.3.4l.9-.5c.5.4 1 .7 1.6.9V16a1 1 0 0 0 1 1h1.6a1 1 0 0 0 1-1v-1.1c.6-.2 1.1-.5 1.6-.9l.9.5a1 1 0 0 0 1.3-.4l.8-1.4a1 1 0 0 0-.4-1.3Z" />
          </svg>
        </Link>

        <div className="flex items-center gap-2 border-l border-line pl-2 sm:pl-3">
          {user.avatarUrl ? (
            // Remote avatars come from whichever OAuth provider the user chose,
            // so they are not on a fixed known host.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="h-6 w-6 rounded-full border border-line object-cover"
            />
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-iris-soft text-[0.7rem] font-semibold text-iris">
              {(user.name || user.email || "?").charAt(0).toUpperCase()}
            </span>
          )}
          <button
            type="button"
            onClick={signOut}
            className="font-data text-[0.7rem] text-ink-faint transition-colors hover:text-ink"
          >
            sign out
          </button>
        </div>
      </div>
    </header>
  );
}
