export const VERSION = "v0.5.3 (26.07.28)";

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
  "v0.5.3 (26.07.28)": {
    added: [
      "Answers in **Ask** now render Markdown, including bold and italic text, headings, lists, links, quotes, code and tables",
    ],
    changed: [
      "**Ask** now treats Open as active work and Long-term as intentionally deferred, keeping future ideas out of current priorities and overdue lists unless you ask for them",
    ],
    fixed: [
      "Numbered citations in **Ask** now consistently appear as links to the right thought, including citations in existing chat history",
    ],
  },
  "v0.5.2 (26.07.28)": {
    added: [
      "The page right-click menu now includes **Copy** for selected text and **Paste** wherever you are writing",
      "Right-click **Open**, **Done**, **Long-term** or **Archived** in Thoughts to move the whole pile somewhere else, or remove it after typing `CONFIRM`",
    ],
  },
  "v0.5.1 (26.07.28)": {
    added: [
      "Right-click anywhere outside a thought for quick access to **Open PiP**, **Re-fetch Data**, **Refresh Page** and the **Keyboard Shortcuts** guide",
      "Right-click **Capture**, **Thoughts**, **Tags & people** or **Ask** to open that screen here without reloading the app, or open it in a new tab",
    ],
    fixed: [
      "Thought right-click submenus now move back inside the window when they would otherwise run off an edge",
    ],
  },
  "v0.5.0 (26.07.27)": {
    added: [
      "A **Long-term** pile beside Open, Done and Archived — for the big ones: a project you mean to start, somewhere you mean to go. They wait there instead of ageing in your open list",
      "A **Popup** button on Capture opens a small note window that floats above your other windows and follows you around the app. Leave it open all day and write into it whenever something lands — it saves and sorts exactly like Capture does",
      "Right-click a thought and **Due** now offers Today, Tomorrow and By Sunday, each showing the date it will write — and **Clear due** at the top when there is already one",
      "Tags and people now show on every view, tags filled in their own colour and people written in outline, with a dot between the two",
      "In **Tags** view, drag a tag's heading to move it and its whole pile — Family above Work, or the other way round. Below the heading, arrow buttons do the same on a phone",
    ],
    changed: [
      "Today is drawn rather than tinted in **Calendar**: an outlined square in the month grid and a solid date, so where you are is answerable at a glance",
      "Right-click submenus now sit apart from the menu that opened them instead of joined to its edge",
      "A thought's circle now pulses while a change is still being saved, so a slow one looks slow rather than finished",
      "**Switching pages is now instant**. Each screen is kept ready in the background and shown from what's already here, then brought up to date behind it — so you land on your thoughts rather than on a skeleton of them",
      "Screens also catch up on their own when you come back to the tab, or as soon as anything is saved anywhere in the app",
    ],
    fixed: [
      "When a change can't be saved, the reason is now said plainly instead of only that it didn't work",
    ],
  },
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
