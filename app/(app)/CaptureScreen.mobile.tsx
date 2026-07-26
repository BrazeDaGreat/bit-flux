"use client";

import Link from "next/link";

import MentionField from "@/components/MentionField";
import ModelPicker from "@/components/ModelPicker";
import { plainMentions } from "@/lib/mentions";
import { VERSION } from "@/lib/VERSION";
import type { CaptureShellProps } from "./capture-shell";

/**
 * Capture on a phone. Same screen, one job: the box is the first thing under
 * the bar and it never moves.
 *
 * Three things differ from the desktop shell, each for a reason the desktop
 * does not have:
 *
 * - **Top-aligned, not centred.** Vertical centring puts the composer in the
 *   middle of the viewport, which the software keyboard then pushes off the
 *   bottom of it. Anchored to the top, the box is in the same place whether the
 *   keyboard is up or down.
 * - **Left-aligned heading.** A centred heading over a centred field reads as a
 *   landing page. This is a workspace, so it is set like one.
 * - **The week goes below.** It is peripheral vision, and on a phone peripheral
 *   means after the job rather than beside it.
 */
export default function CaptureScreenMobile({
  areaRef,
  text,
  setText,
  onKeyDown,
  save,
  retryFailedRequest,
  saving,
  retrying,
  flash,
  error,
  needsKey,
  failedRequest,
  hasProvider,
  canSort,
  selection,
  weekPanel,
  weekPanelCompact,
}: CaptureShellProps) {
  // A mention is one word on screen however long its stored form is.
  const typed = plainMentions(text).trim().length;

  return (
    <div className="flex min-h-full flex-col px-4 pb-8 pt-6 md:px-8 lg:hidden">
      {/* A tablet has the room again, so the week goes back to the corner it
          occupies on a desktop and stops being a line under the composer. */}
      <div className="mb-6 hidden justify-end md:flex">{weekPanel}</div>

      <div className="flex flex-1 flex-col md:mx-auto md:w-full md:max-w-xl">
      <h1 className="font-hand text-[1.5rem] leading-[1.25] tracking-[-0.01em] text-ink">
        What&apos;s on your mind?
      </h1>
      <p className="mt-1 text-[0.875rem] leading-snug text-ink-soft">
        Write it however it comes out. Sorting happens after.
      </p>

      <div className="mt-4 rounded-2xl border border-line-strong bg-surface-2 p-1 transition-colors focus-within:border-iris">
        {/* The ceiling is a share of the viewport as well as a number: 21rem of
            composer with the keyboard up leaves nothing of the screen to read
            back. */}
        <MentionField
          fieldRef={areaRef}
          suppressHydrationWarning
          value={text}
          onChange={setText}
          onKeyDown={onKeyDown}
          enterKeyHint="enter"
          ariaLabel="What's on your mind"
          placeholder="call the dentist back, ship Aris memory by friday… (# to link a thought)"
          className="flux-scroll block max-h-[min(21rem,30vh)] min-h-[8rem] w-full overflow-y-auto bg-transparent px-3.5 py-3 font-hand text-[1.05rem] leading-[1.6] text-ink"
        />
        {/* Its own line: a picker and a counter side by side at this width are
            two truncated things instead of one legible one. */}
        {hasProvider && (
          <div className="flex items-center border-t border-line px-1.5 py-1">
            <ModelPicker initial={selection} align="left" placement="up" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        {/* "⌘↵ to save" is a lie on a phone, so the slot stays empty until
            there is something true to put in it. */}
        <span className="min-w-0 flex-1 font-data text-[0.75rem] text-ink-faint">
          {typed ? `${typed} characters` : ""}
        </span>
        <button
          type="button"
          onClick={() => save()}
          disabled={!typed || saving}
          className="tap shrink-0 rounded-full bg-iris px-6 text-[0.95rem] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-35 dark:text-[#1a1622]"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="mt-3 empty:mt-0">
        {flash && (
          <p role="status" className="font-data text-[0.75rem] text-mint">
            {flash}
          </p>
        )}

        {!canSort && !flash && (
          <p className="rounded-xl bg-amber-soft px-3.5 py-2.5 text-[0.875rem] leading-snug text-amber">
            Everything you write is saved.{" "}
            {hasProvider ? (
              "Pick a model above to have it sorted."
            ) : (
              <>
                <Link href="/settings" className="underline underline-offset-2">
                  Add a provider
                </Link>{" "}
                to have it sorted.
              </>
            )}
          </p>
        )}

        {error && (
          <div
            role="alert"
            className="mt-2 rounded-xl bg-blush-soft px-3.5 py-2.5 text-[0.875rem] leading-snug text-blush"
          >
            <p>
              {error}
              {needsKey && (
                <>
                  {" "}
                  <Link href="/settings" className="underline underline-offset-2">
                    Open settings
                  </Link>
                </>
              )}
            </p>
            {failedRequest && (
              <button
                type="button"
                onClick={retryFailedRequest}
                disabled={saving || retrying}
                className="tap mt-1 rounded-full border border-current px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving || retrying ? "Retrying…" : "Retry"}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-7 md:hidden">{weekPanelCompact}</div>

      <p className="mt-auto pt-6 text-center font-data text-[0.75rem] text-ink-faint">
        {VERSION}
      </p>
      </div>
    </div>
  );
}
