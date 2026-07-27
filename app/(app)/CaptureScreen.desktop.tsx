"use client";

import Link from "next/link";

import MentionField from "@/components/MentionField";
import ModelPicker from "@/components/ModelPicker";
import PopupButton from "@/components/PopupButton";
import WhatsNew from "@/components/WhatsNew";
import { plainMentions } from "@/lib/mentions";
import { VERSION } from "@/lib/VERSION";
import type { CaptureShellProps } from "./capture-shell";

/**
 * The capture screen as it has always been, moved out of `CaptureScreen` whole.
 * Only the root's `flex` became `hidden … lg:flex` — at the desktop breakpoint
 * that computes to the same `display: flex` it had before, and below it the
 * mobile shell takes over.
 *
 * Nothing here holds state. Anything that needs changing on a phone gets
 * changed in `CaptureScreen.mobile.tsx`, never here.
 */
export default function CaptureScreenDesktop({
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
}: CaptureShellProps) {
  // A mention is one word on screen however long its stored form is.
  const typed = plainMentions(text).trim().length;

  return (
    <div className="relative hidden min-h-full flex-col px-5 py-6 sm:px-8 lg:flex">
      {/* Peripheral, not part of the main column — both corners of it. The week
          keeps the right edge it has always had; the changelog takes the left,
          which was empty. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <WhatsNew />
          <PopupButton />
        </div>
        {weekPanel}
      </div>

      <div className="flex flex-1 items-center justify-center py-8">
        <div className="w-full max-w-xl">
          <h1 className="text-center font-hand text-[1.8rem] leading-tight tracking-[-0.01em] text-ink">
            What&apos;s on your mind?
          </h1>
          <p className="mt-1 text-center text-[0.82rem] text-ink-soft">
            Write it however it comes out. Sorting happens after.
          </p>

          <div className="mt-5 rounded-2xl border border-line-strong bg-surface-2 p-1 transition-colors focus-within:border-iris">
            <MentionField
              fieldRef={areaRef}
              suppressHydrationWarning
              value={text}
              onChange={setText}
              onKeyDown={onKeyDown}
              ariaLabel="What's on your mind"
              placeholder="call the dentist back, maybe voice notes for capture, ship Aris memory by friday… (# to link a thought)"
              className="flux-scroll block max-h-[21rem] min-h-[7rem] w-full overflow-y-auto bg-transparent px-4 py-3.5 font-hand text-[1.05rem] leading-[1.6] text-ink"
            />
            {/* Which model sorts this sits with the box it will sort, not on
                another screen — and it stays put for next time. */}
            <div className="flex items-center gap-2 px-2.5 pb-2.5 pt-1">
              {hasProvider && (
                <ModelPicker initial={selection} align="left" placement="up" />
              )}
              <span className="ml-auto shrink-0 font-data text-[0.68rem] text-ink-faint">
                {typed ? `${typed} characters` : "⌘↵ to save"}
              </span>
              <button
                type="button"
                onClick={() => save()}
                disabled={!text.trim() || saving}
                className="rounded-full bg-iris px-4 py-1.5 text-[0.8rem] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35 dark:text-[#1a1622]"
              >
                Save
              </button>
            </div>
          </div>

          <div className="mt-3 min-h-[2.5rem]">
            {flash && (
              <p
                role="status"
                className="text-center font-data text-[0.7rem] text-mint"
              >
                {flash}
              </p>
            )}

            {!canSort && !flash && (
              <p className="rounded-xl bg-amber-soft px-3.5 py-2.5 text-center text-[0.78rem] text-amber">
                Everything you write is saved.{" "}
                {hasProvider ? (
                  "Pick a model below to have it sorted."
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
                className="flex items-center justify-between gap-3 rounded-xl bg-blush-soft px-3.5 py-2.5 text-[0.78rem] text-blush"
              >
                <span>
                  {error}
                  {needsKey && (
                    <>
                      {" "}
                      <Link href="/settings" className="underline underline-offset-2">
                        Open settings
                      </Link>
                    </>
                  )}
                </span>
                {failedRequest && (
                  <button
                    type="button"
                    onClick={retryFailedRequest}
                    disabled={saving || retrying}
                    className="shrink-0 rounded-full border border-current px-3 py-1 font-medium transition-opacity hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving || retrying ? "Retrying…" : "Retry"}
                  </button>
                )}
              </div>
            )}
          </div>

          <p className="mt-2 text-center font-data text-[0.66rem] text-ink-faint">
            <Link href="/thoughts" className="hover:text-ink">
              everything you&apos;ve written →
            </Link>
            <span className="mt-1 block">{VERSION}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
