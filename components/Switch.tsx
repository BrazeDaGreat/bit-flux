"use client";

/**
 * A setting that's on or off, shown as one control instead of a heading, a hint
 * and a checkbox stacked on top of each other. The knob carries the state, so
 * the row reads at a glance without having to find the tick.
 */
export default function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex w-full items-start gap-3 rounded-xl px-1 py-1 text-left transition-colors"
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 h-6 w-10 shrink-0 rounded-full border transition-colors ${
          checked
            ? "border-iris bg-iris-soft"
            : "border-line-strong bg-surface-3 group-hover:border-iris"
        }`}
      >
        <span
          className="relative top-1/2 block h-4 w-4 -translate-y-1/2 rounded-full bg-surface shadow-sm transition-[left,background] duration-200 ease-out"
          style={{
            left: checked ? "calc(100% - 1.125rem)" : "0.125rem",
            background: checked ? "var(--iris)" : "var(--surface)",
          }}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.85rem] text-ink">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-[0.74rem] leading-relaxed text-ink-faint">
            {hint}
          </span>
        )}
      </span>
    </button>
  );
}
