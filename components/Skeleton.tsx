/**
 * What a screen looks like between the keystroke and the data.
 *
 * Every screen in the app is a dynamic server render that waits on PocketBase
 * before it can draw anything, so without a boundary here the browser sits on
 * the *old* page until the round trip finishes and a shortcut feels broken.
 * These pieces are what a `loading.tsx` streams instead, immediately.
 *
 * The rule the shapes follow: anything already known on the client — the
 * heading, the blurb, the shape of the list — is drawn for real, and only the
 * parts that are actually waiting on the server shimmer. Arriving on a screen
 * should read as arriving, not as a grey copy of one.
 */

/** One waiting bar. `h-*` and `w-*` come from the caller — this is only tone. */
export function Shimmer({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block rounded-md bg-surface-3 motion-safe:animate-pulse ${className}`}
    />
  );
}

/**
 * The frame every waiting screen shares: the same column width, padding and
 * heading rhythm its finished page uses, so nothing shifts when the data lands.
 */
export function LoadingScreen({
  title,
  blurb,
  width = "max-w-3xl",
  children,
}: {
  title: string;
  blurb?: string;
  /** Match the finished page's column, or the heading jumps sideways. */
  width?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      aria-busy="true"
      className={`mx-auto w-full ${width} px-5 py-8 sm:px-8`}
    >
      <p role="status" className="sr-only">
        Loading {title}
      </p>
      <h1 className="font-hand text-[1.6rem] leading-tight tracking-[-0.01em] text-ink">
        {title}
      </h1>
      {blurb && (
        <p className="mt-1 max-w-[52ch] text-[0.82rem] leading-relaxed text-ink-soft max-lg:text-[0.95rem]">
          {blurb}
        </p>
      )}
      {children}
    </div>
  );
}

/**
 * The rhythm of a thought list: a 20px circle, a title, a stamp. Widths cycle
 * so the block reads as a list of different things rather than a bar chart.
 */
export function SkeletonRows({ count = 7 }: { count?: number }) {
  const widths = ["w-[62%]", "w-[45%]", "w-[71%]", "w-[38%]", "w-[55%]"];
  return (
    <ul aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li
          key={index}
          className="flex items-center gap-2.5 border-b border-line/60 px-1.5 py-2 last:border-b-0 max-lg:min-h-[3.5rem]"
        >
          <span className="h-5 w-5 shrink-0 rounded-full border border-line-strong" />
          <Shimmer className={`h-3 ${widths[index % widths.length]}`} />
          <Shimmer className="ml-auto h-2.5 w-9 shrink-0 max-lg:hidden" />
        </li>
      ))}
    </ul>
  );
}
