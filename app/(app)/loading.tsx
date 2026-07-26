import { Shimmer } from "@/components/Skeleton";

/**
 * Capture, waiting. Also the fallback any segment under `(app)` without its
 * own `loading.tsx` inherits — the redirect at `/review` being the one that
 * relies on it.
 *
 * The prompt is a constant, so it is drawn for real: on `g c` the question is
 * on screen in the same frame as the keystroke, and only the box below it is
 * still arriving.
 */
export default function Loading() {
  return (
    <div
      aria-busy="true"
      className="flex min-h-full flex-col px-5 py-6 sm:px-8"
    >
      <p role="status" className="sr-only">
        Loading capture
      </p>

      <div className="flex flex-1 items-center justify-center py-8">
        <div className="w-full max-w-xl">
          <h1 className="text-center font-hand text-[1.5rem] leading-[1.25] tracking-[-0.01em] text-ink lg:text-[1.8rem] lg:leading-tight">
            What&apos;s on your mind?
          </h1>
          <p className="mt-1 text-center text-[0.82rem] text-ink-soft">
            Write it however it comes out. Sorting happens after.
          </p>

          <div className="mt-5 rounded-2xl border border-line-strong bg-surface-2 p-1">
            <div className="min-h-[7rem] px-4 py-3.5">
              <Shimmer className="h-3 w-[68%]" />
            </div>
            <div className="flex items-center gap-2 px-2.5 pb-2.5 pt-1">
              <Shimmer className="h-7 w-28 rounded-full" />
              <Shimmer className="ml-auto h-7 w-20 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
