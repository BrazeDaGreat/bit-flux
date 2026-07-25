import type { Selection } from "@/lib/model-store";

/**
 * What a capture shell is handed. All of it comes from `CaptureScreen`, which
 * owns every piece of state — the two shells are drawings of the same thing and
 * hold nothing of their own.
 */

export type FailedRequest =
  | { kind: "save"; text: string }
  | { kind: "sort"; dumpId: string; text: string };

export interface CaptureShellProps {
  /** Callback ref: both shells mount, only the visible one is written to. */
  areaRef: (el: HTMLTextAreaElement | null) => void;
  text: string;
  setText: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  save: () => void;
  retryFailedRequest: () => void;
  saving: boolean;
  retrying: boolean;
  flash: string | null;
  error: string | null;
  needsKey: boolean;
  failedRequest: FailedRequest | null;
  hasProvider: boolean;
  /** Both halves of the decision are in place: an account, and a model on it. */
  canSort: boolean;
  selection: Selection | null;
  weekPanel: React.ReactNode;
  /** The same week, collapsed to a line. Below the desktop breakpoint the week
   *  is peripheral vision, and on a phone peripheral means below. */
  weekPanelCompact: React.ReactNode;
}
