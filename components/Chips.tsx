import { toDate } from "@/lib/time";

/**
 * The house disclosure marker. Same shape and same rotation everywhere, so
 * "there is more under this" is one learned gesture rather than a per-screen
 * invention.
 *
 * Callers fade it in on hover, which is a good way to keep a list quiet with a
 * pointer and no way at all with a thumb — there is no hover to reveal it. So
 * below the desktop breakpoint it is simply there, once, here, rather than in
 * every caller.
 */
export function Caret({
  open,
  tone,
  className = "",
}: {
  open: boolean;
  tone?: string;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 10"
      className={`h-2.5 w-2.5 shrink-0 transition-[transform,opacity,color] duration-150 max-lg:opacity-100 ${
        open ? "rotate-180" : ""
      } ${className}`}
      style={open && tone ? { color: `var(--${tone})` } : undefined}
    >
      <path
        d="M1.5 3.5 5 7l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TagChip({
  name,
  color = "iris",
  muted = false,
}: {
  name: string;
  color?: string;
  muted?: boolean;
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[0.7rem] max-lg:text-[0.85rem] ${muted ? "opacity-60" : ""}`}
      style={{ background: `var(--${color}-soft)`, color: `var(--${color})` }}
    >
      {name}
    </span>
  );
}

const PRECISION_NOTE: Record<string, string> = {
  week: "sometime that week",
  month: "sometime that month",
  vague: "no fixed time",
};

/**
 * Dates carry their own certainty. A vague period is shown as a period, never
 * as a time the user never gave.
 */
export function DateChip({
  label,
  value,
  precision,
  sourceText,
  tone = "ink-soft",
}: {
  label: string;
  value: string;
  precision?: string;
  sourceText?: string;
  tone?: string;
}) {
  if (!value) return null;
  const date = toDate(value);
  const vague = precision === "week" || precision === "month" || precision === "vague";

  const formatted = date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time =
    precision === "exact" || !precision
      ? date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : "";

  return (
    <span className="inline-flex items-baseline gap-1.5 font-data text-[0.68rem]">
      <span className="text-ink-faint">{label}</span>
      <span style={{ color: `var(--${tone})` }}>
        {vague ? `${formatted} ·` : formatted}
        {time ? ` ${time}` : ""}
        {vague && precision ? ` ${PRECISION_NOTE[precision]}` : ""}
      </span>
      {sourceText && (
        <span className="text-ink-faint" title="What you actually wrote">
          “{sourceText}”
        </span>
      )}
    </span>
  );
}
