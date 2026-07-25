"use client";

import Link from "next/link";

import type { Bucket, ViewMode } from "./filters";

/** The pieces both shells draw the same way. Lifted out of the browser so the
 *  two of them cannot drift into two versions of the same empty state. */

const EMPTY_COPY: Record<Bucket, { title: string; hint: string }> = {
  open: {
    title: "Nothing open.",
    hint: "Write something and it'll show up sorted.",
  },
  done: {
    title: "Nothing finished yet.",
    hint: "Tick a thought's circle and it lands here.",
  },
  archived: {
    title: "The archive is empty.",
    hint: "Archiving takes a thought out of every list, and out of what Ask can see.",
  },
};

export function Empty({
  bucket,
  filtered,
  onClear,
}: {
  bucket: Bucket;
  filtered: boolean;
  onClear: () => void;
}) {
  const copy = EMPTY_COPY[bucket];
  return (
    <div className="rounded-2xl border border-dashed border-line-strong px-5 py-10 text-center">
      <p className="font-hand text-[1.05rem] text-ink">
        {filtered ? "Nothing matches." : copy.title}
      </p>
      <p className="mt-1 text-[0.8rem] text-ink-soft">
        {filtered ? "Those filters are too narrow." : copy.hint}
      </p>
      {filtered ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-3 rounded-full bg-iris px-4 py-1.5 text-[0.8rem] font-medium text-white dark:text-[#1a1622] max-lg:h-11 max-lg:px-5 max-lg:text-[0.95rem]"
        >
          Clear filters
        </button>
      ) : bucket === "open" ? (
        <Link
          href="/"
          className="mt-3 inline-block rounded-full bg-iris px-4 py-1.5 text-[0.8rem] font-medium text-white dark:text-[#1a1622] max-lg:inline-flex max-lg:h-11 max-lg:items-center max-lg:px-5 max-lg:text-[0.95rem]"
        >
          Write something
        </Link>
      ) : null}
    </div>
  );
}

/** Four shapes, drawn as themselves. */
export function ViewIcon({
  view,
  className = "h-3.5 w-3.5",
}: {
  view: ViewMode;
  className?: string;
}) {
  const common = {
    viewBox: "0 0 16 16",
    className,
    "aria-hidden": true,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
  };

  if (view === "timeline") {
    // A line with stops on it.
    return (
      <svg {...common}>
        <path d="M4 2.5v11" />
        <circle cx="4" cy="5.5" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="4" cy="10.5" r="1.3" fill="currentColor" stroke="none" />
        <path d="M7 5.5h6M7 10.5h4" />
      </svg>
    );
  }
  if (view === "calendar") {
    return (
      <svg {...common}>
        <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
        <path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2" />
      </svg>
    );
  }
  if (view === "tags") {
    return (
      <svg {...common}>
        <path d="M8.6 2.5H13v4.4l-6 6-4.4-4.4z" strokeLinejoin="round" />
        <circle cx="10.6" cy="5" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M3 4.5h10M3 8h10M3 11.5h6" />
    </svg>
  );
}
