"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";

import type { UserRecord } from "@/lib/types";
import AccountSheet from "./AccountSheet";

/**
 * The window's top edge on a phone. Deliberately almost empty: the sill below
 * already says where you are, so this only has to say what this screen is and
 * offer the one door out of it.
 *
 * No logo. A person who has the app open knows which app it is, and the space
 * is worth more as quiet.
 */
function screenOf(pathname: string): { title: string; back?: string } {
  if (pathname === "/") return { title: "Write" };
  if (pathname === "/thoughts") return { title: "Thoughts" };
  if (pathname.startsWith("/thoughts/")) return { title: "Thought", back: "/thoughts" };
  if (pathname.startsWith("/ask")) return { title: "Ask" };
  if (pathname.startsWith("/tags")) return { title: "Tags & people" };
  if (pathname.startsWith("/settings")) return { title: "Settings", back: "/" };
  return { title: "BIT Flux" };
}

export default function MobileBar({ user }: { user: UserRecord }) {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);
  const screen = screenOf(pathname);

  return (
    <>
      <header
        className="flex shrink-0 items-center gap-1 border-b border-line bg-surface-2 px-2 md:hidden"
        style={{
          height: "calc(var(--rail-h) + var(--safe-top))",
          paddingTop: "var(--safe-top)",
          boxShadow: "inset 0 1px 0 var(--rail-highlight)",
        }}
      >
        {screen.back && (
          <Link
            href={screen.back}
            aria-label="Back"
            className="tap -ml-1 grid shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:text-ink"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        )}

        <h1 className="min-w-0 flex-1 truncate px-1.5 text-[0.95rem] font-semibold tracking-tight text-ink">
          {screen.title}
        </h1>

        <button
          type="button"
          onClick={() => setAccountOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={accountOpen}
          aria-label="Account, theme and settings"
          className="tap grid shrink-0 place-items-center rounded-full"
        >
          {user.avatarUrl ? (
            // Remote avatars come from whichever OAuth provider the user chose,
            // so they are not on a fixed known host.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="h-7 w-7 rounded-full border border-line object-cover"
            />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-iris-soft text-[0.78rem] font-semibold text-iris">
              {(user.name || user.email || "?").charAt(0).toUpperCase()}
            </span>
          )}
        </button>
      </header>

      <AccountSheet
        user={user}
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
      />
    </>
  );
}
