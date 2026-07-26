import { Shimmer } from "@/components/Skeleton";

/** Settings, waiting. Heading and blurb are constants, so only the form waits. */
export default function Loading() {
  return (
    <div
      aria-busy="true"
      className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-8 sm:py-10"
    >
      <p role="status" className="sr-only">
        Loading settings
      </p>
      <h1 className="font-hand text-[1.7rem] leading-tight tracking-[-0.01em] text-ink">
        Settings
      </h1>
      <p className="mt-1 max-w-[48ch] text-[0.82rem] leading-relaxed text-ink-soft max-lg:text-[0.95rem]">
        Your keys, your bill. Keys are encrypted on the server and never sent
        back to the browser.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <Shimmer className="h-16 rounded-xl" />
        <Shimmer className="h-16 rounded-xl" />
        <Shimmer className="h-10 w-40 rounded-full" />
      </div>
    </div>
  );
}
