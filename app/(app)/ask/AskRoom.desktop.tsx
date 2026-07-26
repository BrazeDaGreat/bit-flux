"use client";

import Link from "next/link";

import FilterMenu, { FilterChips } from "@/components/FilterMenu";
import MentionField from "@/components/MentionField";
import MentionText from "@/components/MentionText";
import ModelPicker from "@/components/ModelPicker";
import { Answer, EXAMPLES, PanelIcon, type AskShellProps } from "./ask-shell";

/**
 * Ask as it has always been, moved out of `AskRoom` whole. Only the root's
 * `flex` became `hidden … lg:flex` — at the desktop breakpoint that computes to
 * the same `display: flex` it had before.
 */
export default function AskRoomDesktop({
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
}: AskShellProps) {
  return (
    <div className="hidden min-w-0 flex-1 flex-col lg:flex">
      <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-line px-3 sm:px-5">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-expanded={sidebarOpen}
          aria-label={sidebarOpen ? "Hide chats" : "Show chats"}
          title={sidebarOpen ? "Hide chats" : "Show chats"}
          className={`rounded-lg p-1.5 transition-colors hover:bg-surface-2 ${
            sidebarOpen ? "text-ink" : "text-ink-faint hover:text-ink"
          }`}
        >
          <PanelIcon className="h-4 w-4" />
        </button>
        <span
          className="min-w-0 flex-1 truncate font-data text-[0.68rem] text-ink-faint"
          title={openChatTitle}
        >
          {loadingChat ? "opening…" : (openChatTitle ?? "New chat")}
        </span>
        {turns.length > 0 && (
          <button
            type="button"
            onClick={newChat}
            className="shrink-0 font-data text-[0.68rem] text-ink-soft transition-colors hover:text-ink"
          >
            + new chat
          </button>
        )}
      </div>

      <div className="flux-scroll min-h-0 flex-1 overflow-y-auto px-5 sm:px-8">
        <div className="mx-auto w-full max-w-2xl py-8">
          {turns.length === 0 ? (
            <div className="flex min-h-[45vh] flex-col items-center justify-center text-center">
              <h1 className="font-hand text-[1.7rem] leading-tight tracking-[-0.01em] text-ink">
                Ask your own notes
              </h1>
              <p className="mt-1.5 max-w-[38ch] text-[0.84rem] leading-relaxed text-ink-soft">
                Answers come only from what you wrote, and every one links back
                to where it came from.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-1.5">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => ask(example)}
                    className="rounded-full border border-line-strong px-3.5 py-1.5 text-[0.8rem] text-ink-soft transition-colors hover:border-iris hover:text-ink"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-7">
              {turns.map((turn, index) =>
                turn.role === "user" ? (
                  <p
                    key={index}
                    className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-surface-3 px-4 py-2.5 text-[0.9rem] leading-relaxed text-ink"
                  >
                    <MentionText text={turn.content} />
                  </p>
                ) : (
                  <div key={index} className="flex flex-col gap-3">
                    <Answer text={turn.content} citations={turn.citations ?? []} />

                    {(turn.citations?.length ?? 0) > 0 && (
                      <details className="group">
                        <summary className="cursor-pointer list-none font-data text-[0.66rem] text-ink-faint hover:text-ink-soft">
                          {turn.citations!.length} source
                          {turn.citations!.length === 1 ? "" : "s"}
                          <span className="ml-1 opacity-60 group-open:hidden">show</span>
                          <span className="ml-1 hidden opacity-60 group-open:inline">
                            hide
                          </span>
                        </summary>
                        <ul className="mt-2 flex flex-col gap-1.5 border-l border-line-strong pl-3">
                          {turn.citations!.map((citation, i) => (
                            <li key={citation.id} className="flex gap-2">
                              <span className="font-data text-[0.64rem] text-iris">
                                {i + 1}
                              </span>
                              <Link
                                href={`/thoughts/${citation.id}`}
                                className="text-[0.8rem] text-ink-soft hover:text-iris"
                              >
                                {citation.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}

                    {turn.note && (
                      <p className="font-data text-[0.64rem] text-ink-faint">
                        {turn.note}
                      </p>
                    )}
                  </div>
                )
              )}

              {busy && (
                <p className="font-data text-[0.7rem] text-ink-faint">
                  reading your thoughts…
                </p>
              )}
              <div ref={endRef} />
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-blush-soft px-3.5 py-2.5 text-[0.8rem] text-blush"
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

      <div className="border-t border-line bg-surface px-5 pb-4 pt-3 sm:px-8">
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
            className="flex items-end gap-2 rounded-2xl border border-line-strong bg-surface-2 p-2 transition-colors focus-within:border-iris"
          >
            <FilterMenu
              groups={scopeGroups}
              onPick={setScopeKey}
              label="Narrow what gets searched"
              align="left"
              placement="up"
            />
            <div className="self-center">
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
              onKeyDown={(e) => {
                // The picker takes Enter first when it is up; it says so by
                // having already handled the key.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(question);
                }
              }}
              ariaLabel="Your question"
              placeholder="Ask about anything you've written… (# to name a thought)"
              wrapperClassName="min-w-0 flex-1 self-center"
              className="flux-scroll max-h-40 min-h-9 overflow-y-auto bg-transparent px-1 py-2 font-hand text-[1rem] leading-[1.4] text-ink lg:text-[0.98rem]"
            />
            <button
              type="submit"
              disabled={!question.trim() || busy}
              className="h-9 shrink-0 rounded-full bg-iris px-4 text-[0.78rem] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-35 dark:text-[#1a1622]"
            >
              Ask
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
