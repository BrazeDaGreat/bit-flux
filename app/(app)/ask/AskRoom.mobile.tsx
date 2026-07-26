"use client";

import Link from "next/link";

import FilterMenu, { FilterChips } from "@/components/FilterMenu";
import MentionField from "@/components/MentionField";
import MentionText from "@/components/MentionText";
import ModelPicker from "@/components/ModelPicker";
import { Answer, EXAMPLES, PanelIcon, type AskShellProps } from "./ask-shell";

/**
 * Ask for a thumb.
 *
 * The room is one column with a fixed head and a fixed foot and a scroller
 * between them, exactly as on a desktop. What changes is the foot: on a 360px
 * screen a scope control, a model picker, a field and a send button on one line
 * leaves about a hundred pixels to write in. So the two pickers take their own
 * line and the field gets the whole width of the next one — and at `md`, where
 * there is room again, `flex-wrap` puts all four back on one line without a
 * second layout.
 *
 * Enter makes a newline here. On a desktop Enter sends and Shift+Enter breaks
 * the line; on a phone the return key is the return key, and the send button is
 * the only way to send.
 */
export default function AskRoomMobile({
  areaRef,
  endRef,
  question,
  setQuestion,
  ask,
  turns,
  busy,
  error,
  needsKey,
  loadingChat,
  openChatTitle,
  newChat,
  toggleSidebar,
  sidebarOpen,
  scopeGroups,
  setScopeKey,
  clearScope,
  scopeCount,
  selection,
  onComposerFocus,
  onComposerBlur,
}: AskShellProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col lg:hidden">
      <div className="flex shrink-0 items-center gap-1 border-b border-line px-2">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-expanded={sidebarOpen}
          aria-label={sidebarOpen ? "Hide chats" : "Show chats"}
          className={`tap grid shrink-0 place-items-center rounded-lg ${
            sidebarOpen ? "text-ink" : "text-ink-faint"
          }`}
        >
          <PanelIcon className="h-5 w-5" />
        </button>
        <span
          className="min-w-0 flex-1 truncate px-1 text-[0.875rem] text-ink-soft"
          title={openChatTitle}
        >
          {loadingChat ? "opening…" : (openChatTitle ?? "New chat")}
        </span>
        {turns.length > 0 && (
          <button
            type="button"
            onClick={newChat}
            aria-label="New chat"
            className="tap grid shrink-0 place-items-center rounded-lg text-[1.25rem] font-light text-ink-soft"
          >
            +
          </button>
        )}
      </div>

      <div className="flux-scroll min-h-0 flex-1 overflow-y-auto px-4">
        <div className="mx-auto w-full max-w-2xl py-6">
          {turns.length === 0 ? (
            <div className="flex min-h-[30vh] flex-col justify-center">
              <h1 className="font-hand text-[1.5rem] leading-[1.25] tracking-[-0.01em] text-ink">
                Ask your own notes
              </h1>
              <p className="mt-1.5 text-[0.95rem] leading-snug text-ink-soft">
                Answers come only from what you wrote, and every one links back
                to where it came from.
              </p>
              <div className="mt-5 flex flex-col items-start gap-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => ask(example)}
                    className="tap max-w-full rounded-full border border-line-strong px-4 text-left text-[0.95rem] text-ink-soft"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {turns.map((turn, index) =>
                turn.role === "user" ? (
                  <p
                    key={index}
                    className="max-w-[88%] self-end rounded-2xl rounded-br-md bg-surface-3 px-3.5 py-2.5 text-[0.95rem] leading-relaxed text-ink"
                  >
                    <MentionText text={turn.content} />
                  </p>
                ) : (
                  <div key={index} className="flex flex-col gap-2">
                    <Answer text={turn.content} citations={turn.citations ?? []} />

                    {(turn.citations?.length ?? 0) > 0 && (
                      <details className="group">
                        <summary className="flex min-h-[var(--tap)] cursor-pointer list-none items-center font-data text-[0.75rem] text-ink-faint">
                          {turn.citations!.length} source
                          {turn.citations!.length === 1 ? "" : "s"}
                          <span className="ml-1 opacity-60 group-open:hidden">show</span>
                          <span className="ml-1 hidden opacity-60 group-open:inline">
                            hide
                          </span>
                        </summary>
                        <ul className="flex flex-col border-l border-line-strong pl-3">
                          {turn.citations!.map((citation, i) => (
                            <li key={citation.id} className="flex items-center gap-2">
                              <span className="font-data text-[0.75rem] text-iris">
                                {i + 1}
                              </span>
                              <Link
                                href={`/thoughts/${citation.id}`}
                                className="flex min-h-[var(--tap)] min-w-0 flex-1 items-center text-[0.95rem] text-ink-soft"
                              >
                                {citation.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}

                    {turn.note && (
                      <p className="font-data text-[0.75rem] text-ink-faint">
                        {turn.note}
                      </p>
                    )}
                  </div>
                )
              )}

              {busy && (
                <p className="font-data text-[0.8rem] text-ink-faint">
                  reading your thoughts…
                </p>
              )}
              <div ref={endRef} />
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-blush-soft px-3.5 py-2.5 text-[0.95rem] leading-snug text-blush"
            >
              {error}
              {needsKey && (
                <>
                  {" "}
                  <Link href="/settings" className="underline underline-offset-2">
                    Open settings
                  </Link>
                </>
              )}
            </p>
          )}
        </div>
      </div>

      <div
        className="shrink-0 border-t border-line bg-surface px-3 pt-2"
        style={{ paddingBottom: "max(0.5rem, var(--safe-bottom))" }}
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          {scopeCount > 0 && (
            <FilterChips
              groups={scopeGroups}
              onRemove={(key) => setScopeKey(key, null)}
              onClear={clearScope}
            />
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(question);
            }}
            className="flex flex-wrap items-end gap-2 rounded-2xl border border-line-strong bg-surface-2 p-2 transition-colors focus-within:border-iris"
          >
            {/* Full width below `md`, which is what forces the wrap; auto width
                at `md`, which is what undoes it. */}
            <div className="flex items-center gap-2 max-md:w-full">
              <FilterMenu
                groups={scopeGroups}
                onPick={setScopeKey}
                label="Narrow what gets searched"
                align="left"
                placement="up"
              />
              <ModelPicker
                initial={selection}
                align="left"
                placement="up"
                label="Model answering"
              />
            </div>

            <MentionField
              fieldRef={areaRef}
              value={question}
              onChange={setQuestion}
              onFocus={onComposerFocus}
              onBlur={onComposerBlur}
              enterKeyHint="enter"
              ariaLabel="Your question"
              placeholder="Ask about anything you've written… (# to name a thought)"
              wrapperClassName="min-w-0 flex-1 self-center"
              className="flux-scroll max-h-40 min-h-[var(--tap)] overflow-y-auto bg-transparent px-1 py-2.5 font-hand text-[1rem] leading-[1.4] text-ink"
            />
            <button
              type="submit"
              disabled={!question.trim() || busy}
              // Keeps the caret in the field through the press. Without this
              // the blur brings the sill back, the composer moves up by the
              // height of it, and the tap lands on whatever slid into its
              // place.
              onMouseDown={(e) => e.preventDefault()}
              className="tap shrink-0 rounded-full bg-iris px-5 text-[0.95rem] font-medium text-white transition-opacity disabled:opacity-35 dark:text-[#1a1622]"
            >
              Ask
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
