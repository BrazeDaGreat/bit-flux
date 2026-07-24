"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Caret } from "@/components/Chips";
import FilterMenu, {
  FilterChips,
  type FilterGroup,
} from "@/components/FilterMenu";
import type {
  CollectionRecord,
  TagRecord,
  ThoughtRecord,
} from "@/lib/types";
import { toDate } from "@/lib/time";

const VIEWS: FilterGroup["options"] = [
  { value: "list", label: "Recent" },
  { value: "scheduled", label: "By date" },
  { value: "project", label: "By project" },
  { value: "tag", label: "By tag" },
];

interface Group {
  key: string;
  label: string;
  items: ThoughtRecord[];
}

interface SearchHit {
  id: string;
  title: string;
  via: "both" | "meaning" | "words";
}

export default function ThoughtsList({
  groups,
  tags,
  projects,
  people,
  total,
}: {
  groups: Group[];
  tags: TagRecord[];
  projects: CollectionRecord[];
  people: string[];
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [mode, setMode] = useState("");
  const [searching, setSearching] = useState(false);

  function withParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value && !(key === "view" && value === "list")) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const filterGroups: FilterGroup[] = [
    {
      key: "view",
      label: "Group by",
      options: VIEWS,
      value: params.get("view") ?? undefined,
    },
    {
      key: "tag",
      label: "Tag",
      options: tags.map((t) => ({
        value: t.id,
        label: t.name,
        tone: t.color || "iris",
      })),
      value: params.get("tag") ?? undefined,
    },
    {
      key: "project",
      label: "Project",
      options: projects.map((p) => ({ value: p.id, label: p.name })),
      value: params.get("project") ?? undefined,
    },
    {
      key: "person",
      label: "Person",
      options: people.map((p) => ({ value: p, label: p })),
      value: params.get("person") ?? undefined,
    },
    {
      key: "status",
      label: "Status",
      options: [
        { value: "open", label: "open" },
        { value: "done", label: "done" },
        { value: "archived", label: "archived" },
      ],
      value: params.get("status") ?? undefined,
    },
  ];

  const activeFilters = filterGroups.filter(
    (g) => g.key !== "view" && g.value
  ).length;

  async function search(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return setResults(null);
    setSearching(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
      });
      const data = (await res.json()) as { hits?: SearchHit[]; mode?: string };
      setResults(data.hits ?? []);
      setMode(data.mode ?? "");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <form onSubmit={search} className="flex-1">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!e.target.value) setResults(null);
            }}
            placeholder={searching ? "Searching…" : "Search…"}
            className="input h-9 py-0"
          />
        </form>
        <FilterMenu
          groups={filterGroups}
          onPick={(key, value) => withParam(key, value)}
          label="Filter and group"
        />
      </div>

      <FilterChips
        groups={filterGroups}
        onRemove={(key) => withParam(key, null)}
        onClear={() => router.push(pathname)}
      />

      {results !== null ? (
        <section>
          <Header
            label={`${results.length} ${results.length === 1 ? "match" : "matches"}`}
            note={mode === "hybrid" ? "words + meaning" : "words"}
            action={
              <button
                type="button"
                onClick={() => {
                  setResults(null);
                  setQuery("");
                }}
                className="text-[0.74rem] text-ink-faint hover:text-ink"
              >
                clear
              </button>
            }
          />
          {results.length === 0 ? (
            <p className="px-1.5 py-3 text-[0.82rem] text-ink-soft">
              Nothing matched. Try fewer words.
            </p>
          ) : (
            <ul>
              {results.map((hit) => (
                <li key={hit.id} className="border-b border-line/60 last:border-b-0">
                  <Link
                    href={`/thoughts/${hit.id}`}
                    className="flex items-center gap-3 rounded-lg px-1.5 py-2.5 transition-colors hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-[0.88rem] text-ink">
                      {hit.title}
                    </span>
                    {hit.via !== "words" && (
                      <span className="shrink-0 font-data text-[0.62rem] text-ink-faint">
                        meaning
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : total === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong px-5 py-10 text-center">
          <p className="font-hand text-[1.05rem] text-ink">Nothing here yet.</p>
          <p className="mt-1 text-[0.8rem] text-ink-soft">
            {activeFilters > 0
              ? "Those filters are too narrow."
              : "Write something and it'll show up sorted."}
          </p>
          <Link
            href={activeFilters > 0 ? pathname : "/"}
            className="mt-3 inline-block rounded-full bg-iris px-4 py-1.5 text-[0.8rem] font-medium text-white dark:text-[#1a1622]"
          >
            {activeFilters > 0 ? "Clear filters" : "Write something"}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <section key={group.key}>
              <Header label={group.label} note={String(group.items.length)} />
              <ul>
                {group.items.map((thought) => (
                  <Row
                    key={thought.id}
                    thought={thought}
                    tags={tags}
                    projects={projects}
                    expanded={open === thought.id}
                    onToggle={() =>
                      setOpen(open === thought.id ? null : thought.id)
                    }
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Header({
  label,
  note,
  action,
}: {
  label: string;
  note?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-1 flex items-baseline gap-2 px-1.5">
      <h2
        className="font-data text-[0.64rem] uppercase tracking-[0.14em] text-ink-faint"
        suppressHydrationWarning
      >
        {label}
      </h2>
      {note && (
        <span className="font-data text-[0.62rem] text-ink-faint opacity-70">
          {note}
        </span>
      )}
      {action && <span className="ml-auto">{action}</span>}
    </div>
  );
}

/**
 * A row opens in place rather than becoming a card: the title line keeps its
 * position, padding and weight in both states, so nothing jumps and the list
 * never loses its shape. One caret at the end of the row does both directions,
 * so the place you click to close is the place you clicked to open.
 */
function Row({
  thought,
  tags,
  projects,
  expanded,
  onToggle,
}: {
  thought: ThoughtRecord;
  tags: TagRecord[];
  projects: CollectionRecord[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const date = thought.deadline || thought.action_date;
  const done = thought.status === "done";
  const panelId = `thought-${thought.id}-detail`;

  const rowTags = (thought.tags ?? [])
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is TagRecord => Boolean(t));
  const project = projects.find((p) => p.id === thought.project);

  return (
    <li className="border-b border-line/60 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="group flex w-full items-center gap-3 rounded-lg px-1.5 py-2.5 text-left transition-colors hover:bg-surface-2"
      >
        <span
          className={`min-w-0 flex-1 truncate text-[0.88rem] leading-snug text-ink ${
            done ? "line-through opacity-50" : ""
          }`}
        >
          {thought.title}
        </span>
        {thought.needs_review && (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber"
            title="Needs a look"
          />
        )}
        {date && (
          <span
            className="shrink-0 font-data text-[0.62rem] text-ink-faint"
            suppressHydrationWarning
          >
            {toDate(date).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
            })}
          </span>
        )}
        {/* The one affordance for both directions — same spot open or closed. */}
        <Caret
          open={expanded}
          className={`text-ink-faint group-hover:opacity-100 group-focus-visible:opacity-100 ${
            expanded ? "opacity-100" : "opacity-0"
          }`}
        />
      </button>

      {expanded && (
        <div
          id={panelId}
          className="relative flex flex-col gap-2.5 pb-3.5 pl-[1.62rem] pr-1.5 motion-safe:animate-[flux-unfold_180ms_ease-out]"
        >
          <span
            aria-hidden="true"
            className="absolute bottom-1 left-[0.5rem] top-0 w-[2px] rounded-full opacity-45"
            style={{ background: "var(--line-strong)" }}
          />

          {thought.body && thought.body !== thought.title && (
            <p className="font-hand text-[0.95rem] leading-[1.55] text-ink">
              {thought.body}
            </p>
          )}

          <dl className="flex flex-col gap-1">
            {thought.action_date && (
              <Detail
                label="do"
                value={formatDate(thought.action_date, thought.date_precision)}
              />
            )}
            {thought.deadline && (
              <Detail
                label="due"
                value={formatDate(thought.deadline, thought.date_precision)}
              />
            )}
            {thought.reminder_at && (
              <Detail label="remind" value={formatDate(thought.reminder_at, "exact")} />
            )}
            {thought.date_source_text && (
              <Detail label="you wrote" value={`“${thought.date_source_text}”`} />
            )}
            {project && <Detail label="project" value={project.name} />}
            {(thought.people?.length ?? 0) > 0 && (
              <Detail
                label="people"
                value={thought.people!.map((p) => p.name).join(", ")}
              />
            )}
            {rowTags.length > 0 && (
              <div className="flex items-baseline gap-2">
                <dt className="w-[4.5rem] shrink-0 font-data text-[0.62rem] uppercase tracking-[0.1em] text-ink-soft">
                  tags
                </dt>
                <dd className="flex flex-wrap gap-1">
                  {rowTags.map((tag) => (
                    <span
                      key={tag.id}
                      className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.7rem] text-ink-soft"
                    >
                      {tag.name}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>

          <div className="flex items-center gap-3">
            <Link
              href={`/thoughts/${thought.id}`}
              className="font-data text-[0.66rem] uppercase tracking-[0.1em] text-ink-soft transition-colors hover:text-ink"
            >
              Open →
            </Link>
            {thought.needs_review && (
              <span className="font-data text-[0.66rem] text-amber">
                needs a look
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-[4.5rem] shrink-0 font-data text-[0.62rem] uppercase tracking-[0.1em] text-ink-soft">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-[0.8rem] text-ink" suppressHydrationWarning>
        {value}
      </dd>
    </div>
  );
}

function formatDate(value: string, precision?: string): string {
  const date = toDate(value);
  const vague = precision === "week" || precision === "month" || precision === "vague";
  const day = date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  if (vague) {
    return `${day} · ${precision === "week" ? "sometime that week" : precision === "month" ? "sometime that month" : "no fixed time"}`;
  }
  return `${day}, ${date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
