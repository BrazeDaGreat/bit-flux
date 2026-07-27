"use client";

import {
  Archive,
  CalendarClock,
  CalendarRange,
  CalendarX2,
  CheckCircle2,
  Circle,
  ExternalLink,
  FolderOpen,
  Sun,
  Sunrise,
  Tag,
  Telescope,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuEmpty,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSubmenu,
  useContextMenuTrigger,
} from "@/components/ContextMenu";
import type { TagRecord, ThoughtRecord } from "@/lib/types";
import { comingSunday, dueValue, endOfDay } from "./filters";

interface ThoughtContextMenuOptions {
  thought: ThoughtRecord;
  tags: TagRecord[];
  onStatus: (id: string, status: ThoughtRecord["status"]) => void;
  onToggleTag: (id: string, tagId: string) => void;
  onDue: (id: string, value: string | null) => void;
  onDelete: (id: string) => void;
}

/**
 * Thought-specific menu composition. Trigger, portal, focus, positioning,
 * dismissal, submenus, and visual primitives live in the shared component.
 */
export function useThoughtContextMenu(options: ThoughtContextMenuOptions) {
  const { thought, tags, onStatus, onToggleTag, onDue, onDelete } = options;
  const { point, close, contextMenuProps } =
    useContextMenuTrigger<HTMLElement>();
  const router = useRouter();
  const href = `/thoughts/${thought.id}`;
  const dated = Boolean(dueValue(thought));

  // "Open" is the same navigation the row's own link performs, so it warms the
  // route the same way — but only once the menu is up. This hook runs for every
  // row in a list that can be 500 long; prefetching on mount would be 500
  // requests for one that gets opened.
  useEffect(() => {
    if (point) router.prefetch(href);
  }, [point, href, router]);

  return {
    contextMenuProps,
    contextMenu: (
      <ContextMenu
        point={point}
        onClose={close}
        ariaLabel={`Actions for ${thought.title}`}
      >
        {/* `router.push`, not `location.assign` — the latter is a document
            navigation, which tears down the app and reloads it just to reach a
            route the client can already render. Clicking the row's own link
            never did that, and neither should this. */}
        <ContextMenuItem icon={<FolderOpen />} onClick={() => router.push(href)}>
          Open
        </ContextMenuItem>
        <ContextMenuItem
          icon={<ExternalLink />}
          onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
        >
          Open in New Tab
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuSubmenu
          id="status"
          label="Mark as"
          ariaLabel="Mark thought as"
          icon={<CheckCircle2 />}
        >
          {STATUS_OPTIONS.filter((option) => option.value !== thought.status).map(
            (option) => (
              <ContextMenuItem
                key={option.value}
                icon={option.icon}
                onClick={() => onStatus(thought.id, option.value)}
              >
                {option.label}
              </ContextMenuItem>
            )
          )}
        </ContextMenuSubmenu>

        {/*
          The three answers a date question almost always has. Anything else is
          a real decision and belongs on the thought's own page, where there is
          a picker and the rest of the context.

          Taking a date off leads, because it is the one destructive move here
          and the one you arrive at the menu already meaning to make.
        */}
        <ContextMenuSubmenu
          id="due"
          label="Due"
          ariaLabel="Set when this is due"
          icon={<CalendarClock />}
        >
          {dated && (
            <>
              <ContextMenuItem
                icon={<CalendarX2 />}
                onClick={() => onDue(thought.id, null)}
              >
                Clear due
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          {dueChoices().map((choice) => (
            <ContextMenuItem
              key={choice.label}
              icon={choice.icon}
              hint={choice.note}
              onClick={() => onDue(thought.id, choice.value)}
            >
              {choice.label}
            </ContextMenuItem>
          ))}
        </ContextMenuSubmenu>

        <ContextMenuSubmenu
          id="tags"
          label="Tags"
          ariaLabel="Toggle tags"
          icon={<Tag />}
          className="max-h-[calc(100vh-1rem)] overflow-y-auto"
        >
          <ContextMenuLabel>Toggle tags</ContextMenuLabel>
          {tags.length === 0 ? (
            <ContextMenuEmpty>No tags yet</ContextMenuEmpty>
          ) : (
            tags.map((tag) => (
              <ContextMenuCheckboxItem
                key={tag.id}
                checked={(thought.tags ?? []).includes(tag.id)}
                tone={tag.color || "iris"}
                onCheckedChange={() => onToggleTag(thought.id, tag.id)}
              >
                {tag.name}
              </ContextMenuCheckboxItem>
            ))
          )}
        </ContextMenuSubmenu>

        <ContextMenuSeparator />

        <ContextMenuItem
          icon={<Trash2 />}
          danger
          onClick={() => onDelete(thought.id)}
        >
          Delete
        </ContextMenuItem>
      </ContextMenu>
    ),
  };
}

/**
 * Today, tomorrow, and the end of the week — worked out at open time, so a tab
 * left up overnight never offers yesterday.
 *
 * Sunday drops out when it is already one of the other two. Two rows that write
 * the same date is a menu asking you to choose between identical answers.
 */
function dueChoices(): {
  label: string;
  note: string;
  value: string;
  icon: React.ReactNode;
}[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const sunday = comingSunday(now);
  const short = (date: Date) =>
    date.toLocaleDateString(undefined, { day: "numeric", month: "short" });

  const out = [
    { label: "Today", note: short(today), value: endOfDay(today), icon: <Sun /> },
    {
      label: "Tomorrow",
      note: short(tomorrow),
      value: endOfDay(tomorrow),
      icon: <Sunrise />,
    },
  ];

  if (sunday.getTime() > tomorrow.getTime()) {
    out.push({
      label: "By Sunday",
      note: short(sunday),
      value: endOfDay(sunday),
      icon: <CalendarRange />,
    });
  }

  return out;
}

const STATUS_OPTIONS: {
  value: ThoughtRecord["status"];
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "open", label: "Open", icon: <Circle /> },
  { value: "done", label: "Done", icon: <CheckCircle2 /> },
  { value: "longterm", label: "Long-term", icon: <Telescope /> },
  { value: "archived", label: "Archived", icon: <Archive /> },
];
