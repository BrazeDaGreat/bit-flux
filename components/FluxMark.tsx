/**
 * The mark is the product in miniature: one capture on the left, branching
 * into the separate thoughts it becomes. Same idea as the spine on the
 * capture screen.
 */
export default function FluxMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 20"
      className={className}
      aria-hidden="true"
      fill="none"
      strokeLinecap="round"
    >
      <path
        d="M6 10h5c2 0 3-3.5 5-3.5h5M6 10h5c2 0 3 3.5 5 3.5h5"
        stroke="var(--line-strong)"
        strokeWidth="1.5"
      />
      <circle cx="4" cy="10" r="3" fill="var(--iris)" />
      <circle cx="23" cy="6.5" r="2" fill="var(--apricot)" />
      <circle cx="23" cy="13.5" r="2" fill="var(--mint)" />
    </svg>
  );
}
