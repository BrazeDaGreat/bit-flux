import Link from "next/link";

import { splitMentions } from "@/lib/mentions";

/**
 * Writing that has other thoughts named inside it.
 *
 * A mention is set in the same face as the sentence around it, tinted iris,
 * with only the `#` in the machine's typeface to say where it came from. No
 * pill, no border, no icon: it is a word the person wrote that happens to be a
 * door, and dressing it as a control would make their own sentence read like a
 * form. The wash appears when it is hovered or focused — the door showing
 * itself only when it is reached for.
 */
export default function MentionText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const parts = splitMentions(text);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.kind === "text" ? (
          <span key={index}>{part.value}</span>
        ) : (
          <Link
            key={index}
            href={`/thoughts/${part.id}`}
            title={`Go to “${part.title}”`}
            className="rounded-[4px] px-[0.15em] text-iris no-underline decoration-iris/40 underline-offset-[0.2em] transition-colors hover:bg-iris-soft hover:underline focus-visible:bg-iris-soft"
          >
            <span className="font-data text-[0.78em] opacity-60">#</span>
            {part.title}
          </Link>
        )
      )}
    </span>
  );
}
