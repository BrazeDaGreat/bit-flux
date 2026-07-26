import { Shimmer } from "@/components/Skeleton";

/**
 * Ask, waiting. Its chrome is the full window rather than a centred column, so
 * this mirrors that instead of using the shared `LoadingScreen` frame: the
 * chat bar at the top, the empty-state greeting, the composer at the bottom.
 */
export default function Loading() {
  return (
    <div aria-busy="true" className="flex min-h-full min-w-0 flex-col">
      <p role="status" className="sr-only">
        Loading Ask
      </p>

      <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-line px-3 sm:px-5">
        <Shimmer className="h-4 w-4 rounded" />
        <span className="font-data text-[0.68rem] text-ink-faint">New chat</span>
      </div>

      <div className="min-h-0 flex-1 px-5 sm:px-8">
        <div className="mx-auto w-full max-w-2xl py-8">
          <div className="flex min-h-[45vh] flex-col items-center justify-center text-center">
            <h1 className="font-hand text-[1.7rem] leading-tight tracking-[-0.01em] text-ink">
              Ask your own notes
            </h1>
            <p className="mt-1.5 max-w-[38ch] text-[0.84rem] leading-relaxed text-ink-soft">
              Answers come only from what you wrote, and every one links back to
              where it came from.
            </p>
            <div
              aria-hidden="true"
              className="mt-5 flex flex-wrap justify-center gap-1.5"
            >
              <Shimmer className="h-8 w-40 rounded-full" />
              <Shimmer className="h-8 w-32 rounded-full" />
              <Shimmer className="h-8 w-44 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 px-5 pb-5 sm:px-8">
        <div className="mx-auto w-full max-w-2xl rounded-2xl border border-line-strong bg-surface-2 p-2.5">
          <Shimmer className="h-9 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
