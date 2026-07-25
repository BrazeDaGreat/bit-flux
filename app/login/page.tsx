import { Suspense } from "react";
import { Wind } from "lucide-react";

import ThemeModeToggle from "@/components/ThemeModeToggle";
import ThemePicker from "@/components/ThemePicker";
import LoginPanel from "./LoginPanel";

/** One raw line, three separate thoughts — the whole product in one glance. */
const SPLIT_DEMO = [
  { text: "call the dentist back", tone: "apricot", tag: "errands" },
  { text: "voice notes for capture?", tone: "iris", tag: "product" },
  { text: "ship Aris memory Friday", tone: "amber", tag: "aris" },
];

export default function LoginPage() {
  return (
    // Safe-area insets are written as `max-lg:` utilities rather than as an
    // inline style: an inline padding would beat `sm:p-6` at every width,
    // including the desktop the freeze protects.
    <div className="flex min-h-dvh w-full items-center justify-center p-3 sm:p-6 max-lg:pb-[max(0.75rem,var(--safe-bottom))] max-lg:pl-[max(0.75rem,var(--safe-left))] max-lg:pr-[max(0.75rem,var(--safe-right))] max-lg:pt-[max(0.75rem,var(--safe-top))]">
      <div
        className="grid w-full max-w-3xl overflow-hidden rounded-[var(--radius-window)] border border-line bg-surface md:grid-cols-[1.05fr_1fr]"
        style={{ boxShadow: "var(--shadow-window)" }}
      >
        {/* On a phone the two halves are stacked, and the half that does the
            job goes first: on a 320×568 screen the pitch would otherwise push
            the sign-in buttons off the bottom of the only screen that matters
            before you have an account. The story still reads, underneath. */}
        <section className="relative flex flex-col justify-between gap-8 border-line bg-surface-2 p-7 max-md:order-last max-md:gap-6 max-md:border-b-0 max-md:border-t md:border-r md:p-9">
          <div className="flex items-center gap-2">
            <Wind className="h-4 w-4 text-ink" strokeWidth={2} />
            <span className="font-semibold tracking-tight text-ink">BIT Flux</span>
          </div>

          <div>
            <h1 className="font-hand text-[2.1rem] leading-[1.12] tracking-[-0.015em] text-ink max-lg:text-[1.75rem]">
              Write it down now.
              <br />
              <span className="text-iris">Sort it out later.</span>
            </h1>
            <p className="mt-3 max-w-[24ch] text-[0.85rem] leading-relaxed text-ink-soft max-lg:max-w-none max-lg:text-[0.95rem]">
              Dump everything in one box. It gets split, titled and tagged for
              you — the original always kept.
            </p>
          </div>

          <div>
            <p className="font-hand text-[0.95rem] italic text-ink-soft">
              “call the dentist back, maybe voice notes for capture, ship Aris
              memory by friday”
            </p>
            <div className="mt-3 flex flex-col gap-1.5 border-l border-line-strong pl-3.5">
              {SPLIT_DEMO.map((item) => (
                <div key={item.text} className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: `var(--${item.tone})` }}
                  />
                  <span className="text-[0.78rem] text-ink max-lg:text-[0.875rem]">
                    {item.text}
                  </span>
                  <span
                    className="font-data text-[0.64rem] max-lg:text-[0.75rem]"
                    style={{ color: `var(--${item.tone})` }}
                  >
                    #{item.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex flex-col justify-center gap-5 p-7 md:p-9">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[1.05rem] font-semibold tracking-tight text-ink">
                Sign in
              </h2>
              <p className="mt-1 text-[0.8rem] text-ink-soft max-lg:text-[0.95rem]">
                Pick an account. Nothing else to fill in.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ThemeModeToggle />
              <ThemePicker />
            </div>
          </div>

          <Suspense
            fallback={<div className="h-[7rem] rounded-2xl bg-surface-3" />}
          >
            <LoginPanel />
          </Suspense>

          <p className="font-data text-[0.68rem] leading-relaxed text-ink-faint max-lg:text-[0.75rem]">
            Your thoughts stay in your own account. Nothing is shared.
          </p>
        </section>
      </div>
    </div>
  );
}
