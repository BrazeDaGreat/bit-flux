"use client";

import {
  Archive,
  CheckCircle2,
  Circle,
  ExternalLink,
  FolderOpen,
  Tag,
  Trash2,
} from "lucide-react";

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

interface ThoughtContextMenuOptions {
  thought: ThoughtRecord;
  tags: TagRecord[];
  onStatus: (id: string, status: ThoughtRecord["status"]) => void;
  onToggleTag: (id: string, tagId: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Thought-specific menu composition. Trigger, portal, focus, positioning,
 * dismissal, submenus, and visual primitives live in the shared component.
 */
export function useThoughtContextMenu(options: ThoughtContextMenuOptions) {
  const { thought, tags, onStatus, onToggleTag, onDelete } = options;
  const { point, close, contextMenuProps } =
    useContextMenuTrigger<HTMLElement>();
  const href = `/thoughts/${thought.id}`;

  return {
    contextMenuProps,
    contextMenu: (
      <ContextMenu
        point={point}
        onClose={close}
        ariaLabel={`Actions for ${thought.title}`}
      >
        <ContextMenuItem
          icon={<FolderOpen />}
          onClick={() => window.location.assign(href)}
        >
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

const STATUS_OPTIONS: {
  value: ThoughtRecord["status"];
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "open", label: "Open", icon: <Circle /> },
  { value: "done", label: "Done", icon: <CheckCircle2 /> },
  { value: "archived", label: "Archived", icon: <Archive /> },
];
