"use client";

import type { TagRecord, ThoughtRecord } from "@/lib/types";

/**
 * What a thought is about, and who it is about — one line, in every view.
 *
 * These are two different kinds of fact and they are drawn as two different
 * materials rather than two colours of the same one. A tag is a bucket the
 * thought was filed into, so it is printed: filled, in the tag's own ink. A
 * person is a name that turned up in what you wrote, so it is written:
 * hairline outline, the data face, no colour of its own. A single dot divides
 * the two groups, which is enough to stop "Work" and "Sam" reading as one list
 * without adding a second rule to learn.
 *
 * Both groups are capped. A row that lists nine tags has stopped being a row
 * and become a paragraph, and the count that replaces them says the same thing
 * in one glyph.
 */

export function facetsOf(thought: ThoughtRecord, tags: TagRecord[]) {
  const thoughtTags = (thought.tags ?? [])
    .map((tagId) => tags.find((tag) => tag.id === tagId))
    .filter((tag): tag is TagRecord => Boolean(tag));
  const people = (thought.people ?? [])
    .map((person) => person.name)
    .filter(Boolean);
  return { thoughtTags, people };
}

export function Facets({
  thought,
  tags,
  limit = 2,
  peopleLimit = 2,
  className = "",
}: {
  thought: ThoughtRecord;
  tags: TagRecord[];
  /** How many tags before the rest become a count. */
  limit?: number;
  peopleLimit?: number;
  className?: string;
}) {
  const { thoughtTags, people } = facetsOf(thought, tags);
  if (thoughtTags.length === 0 && people.length === 0) return null;

  const shownTags = thoughtTags.slice(0, limit);
  const hiddenTags = thoughtTags.length - shownTags.length;
  const shownPeople = people.slice(0, peopleLimit);
  const hiddenPeople = people.length - shownPeople.length;

  return (
    <span className={`flex min-w-0 items-center gap-1 ${className}`}>
      {shownTags.map((tag) => (
        <span
          key={tag.id}
          className="max-w-[8rem] shrink-0 truncate rounded-full px-1.5 py-px text-[0.62rem] leading-[1.35] max-lg:text-[0.72rem]"
          style={{
            background: `var(--${tag.color || "iris"}-soft)`,
            color: `var(--${tag.color || "iris"})`,
          }}
        >
          {tag.name}
        </span>
      ))}
      {hiddenTags > 0 && <More count={hiddenTags} />}

      {shownTags.length > 0 && shownPeople.length > 0 && (
        <span aria-hidden="true" className="shrink-0 px-px text-ink-faint opacity-60">
          ·
        </span>
      )}

      {shownPeople.map((name) => (
        <span
          key={name}
          className="max-w-[8rem] shrink-0 truncate rounded-full border border-line-strong px-1.5 py-px font-data text-[0.58rem] leading-[1.45] text-ink-soft max-lg:text-[0.68rem]"
        >
          {name}
        </span>
      ))}
      {hiddenPeople > 0 && <More count={hiddenPeople} />}
    </span>
  );
}

function More({ count }: { count: number }) {
  return (
    <span className="shrink-0 font-data text-[0.58rem] text-ink-faint max-lg:text-[0.68rem]">
      +{count}
    </span>
  );
}
