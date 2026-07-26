export const VERSION = "v0.4.6-alpha (26.07.26)";

export interface ChangelogEntry {
  added?: string[];
  changed?: string[];
  fixed?: string[];
  removed?: string[];
}

/**
 * Rules for what to add in CHANGELOG:
 * - CHANGELOG is user facing, it should never contain technical details, only what the user can see and experience.
 * - Added is for new features, style changes, or decisions that affect the user experience.
 * - Changed is for changes in existing functionality, or deprecation of existing features.
 * - Fixed is for any big or small bug fixes. Bug fixes shouldn't be mentioned anywhere else.
 * - Removed is for removal of functionality or deprecated features.
 *
 * Every line is read by someone, in the "What's new" panel on Capture. Inline
 * markdown is rendered there: `` `code` `` for a key or a character to type,
 * `**bold**` for emphasis, `*italic*`. Nothing else — no headings, no links,
 * no lists inside a line, since one line already is a list item.
 */
export const CHANGELOG: Record<string, ChangelogEntry> = {
  "v0.4.6-alpha (26.07.26)": {
    added: [
      "A **What's new** link in the top left of Capture, opening this changelog for the current version and every one before it",
    ],
    changed: [
      "Screens now appear the moment you ask for one, with their layout already in place while the contents arrive",
    ],
    fixed: [
      "Keyboard shortcuts switch pages immediately instead of pausing on the page you were leaving",
      "Opening a thought from its right-click menu no longer reloads the whole app",
      "Pressing `/` now reliably leaves the cursor in the search box",
    ],
  },
  "v0.4.5-alpha (26.07.26)": {
    added: [
      "Type `#` to link thoughts in the capture composer, ask room, and thought editor",
      "Linked thoughts appear as clickable chips in thought bodies and ask conversations",
      "Questions can now point at specific thoughts with `#` for more precise answers",
    ],
    changed: [
      "Text input fields now use a smart composer that grows naturally as you type",
      "Character counter counts actual written words instead of raw characters",
    ],
  },
  "v0.4.0-alpha (26.07.25)": {
    added: [
      "Responsive UI layout that adapts to different screen sizes",
      "Context menu component for enhanced right-click interactions",
    ],
  },
  "v0.3.5-alpha (26.07.25)": {
    added: [
      "Review pane to manage uncertain thoughts",
      "People Manager for tracking individuals mentioned in thoughts with notes and mentions",
      "Keyboard shortcuts for improved navigation and accessibility",
    ],
    changed: [
      "Enhanced Thoughts page with settings and review-specific data",
      "Review Queue now supports merging and splitting thoughts",
    ],
  },
  "v0.2.0-alpha (26.07.25)": {
    added: [
      "Provider management API routes",
      "Model Picker component for selecting AI models",
    ],
    changed: [
      "Refactored Thoughts page for better structure and maintainability",
    ],
  },
  "v0.1.3-alpha (26.07.25)": {
    removed: ["Project references removed from various components and types"],
  },
  "v0.1.2-alpha (26.07.25)": {
    fixed: ["Failed captures are now preserved and can be retried"],
  },
  "v0.1.1-alpha (26.07.25)": {
    changed: [
      "Simplified search hit structure and cleaned up unused variables",
    ],
  },
  "v0.1.0-alpha (26.07.25)": {
    added: ["Initial release of Bit Flux"],
  },
};
