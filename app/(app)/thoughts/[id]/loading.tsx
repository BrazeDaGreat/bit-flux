import Link from "next/link";

import { Shimmer } from "@/components/Skeleton";

/**
 * One thought, waiting. The way back is a real link from the first frame — a
 * thought opened by mistake can be left again without waiting for the editor
 * that was never wanted to finish loading.
 */
export default function Loading() {
  return (
    <div
      aria-busy="true"
      className="mx-auto w-full max-w-4xl px-5 py-7 sm:px-8"
    >
      <p role="status" className="sr-only">
        Loading thought
      </p>

      <div className="flex items-center gap-4">
        <Link
          href="/thoughts"
          className="font-data text-[0.7rem] text-ink-faint hover:text-ink max-lg:hidden"
        >
          ← all thoughts
        </Link>
      </div>

      <div className="mt-5 grid gap-x-8 gap-y-7 md:grid-cols-[minmax(0,1fr)_15rem] lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0">
          <Shimmer className="h-6 w-[72%]" />
          <div className="mt-5 flex flex-col gap-2.5">
            <Shimmer className="h-3 w-full" />
            <Shimmer className="h-3 w-[94%]" />
            <Shimmer className="h-3 w-[88%]" />
            <Shimmer className="h-3 w-[46%]" />
          </div>
        </div>

        <div className="flex flex-col gap-5">
          {["status", "when", "tags"].map((label) => (
            <section key={label}>
              <h2 className="mb-1.5 font-data text-[0.62rem] uppercase tracking-[0.14em] text-ink-faint max-lg:text-[0.75rem]">
                {label}
              </h2>
              <Shimmer className="h-8 w-full rounded-full" />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
