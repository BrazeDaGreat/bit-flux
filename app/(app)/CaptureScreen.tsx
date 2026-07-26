"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { MEDIA } from "@/lib/breakpoint";
import { thoughtIndex } from "@/lib/thought-index";
import { modelStore, type Selection } from "@/lib/model-store";
import { pb } from "@/lib/pb";
import { sortingStore } from "@/lib/sorting-store";
import type { DumpRecord } from "@/lib/types";
import type { CaptureShellProps, FailedRequest } from "./capture-shell";
import CaptureScreenDesktop from "./CaptureScreen.desktop";
import CaptureScreenMobile from "./CaptureScreen.mobile";

const DRAFT_KEY = "flux-draft";

/**
 * The draft, the save, the background sort and the retry — one copy of each,
 * handed to whichever shell the stylesheet is showing.
 *
 * Both shells mount: which one is on screen is a layout question, and CSS is
 * the only thing that answers it correctly on the server. That means two
 * textareas exist, so the ref is a registry rather than a slot — the one that
 * is actually laid out is the one focus and autosizing act on.
 */
export default function CaptureScreen({
  userId,
  hasProvider,
  selection,
  weekPanel,
  weekPanelCompact,
}: {
  userId: string;
  hasProvider: boolean;
  /** What the model picker starts on — the choice made last time. */
  selection: Selection | null;
  /** Server-rendered — the only other thing on this screen. */
  weekPanel: React.ReactNode;
  /** The same week collapsed to a line, for the compact shell. */
  weekPanelCompact: React.ReactNode;
}) {
  // Read the draft during the first client render rather than in an effect,
  // so the box is never briefly empty.
  const [text, setText] = useState(() =>
    typeof window === "undefined" ? "" : (localStorage.getItem(DRAFT_KEY) ?? "")
  );
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [failedRequest, setFailedRequest] = useState<FailedRequest | null>(null);
  const [retrying, setRetrying] = useState(false);
  const areas = useRef<HTMLElement[]>([]);
  const router = useRouter();

  /** A `display: none` element has no offset parent, which is exactly the
   *  question being asked: which of the two shells is on screen. */
  const liveArea = useCallback(
    () =>
      areas.current.find((el) => el.isConnected && el.offsetParent !== null) ??
      null,
    []
  );

  const areaRef = useCallback((el: HTMLElement | null) => {
    // Detached nodes are swept on every registration rather than on a cleanup
    // callback, which is the one form of this that works on every React that
    // ships with this app.
    areas.current = areas.current.filter((known) => known.isConnected);
    if (el && !areas.current.includes(el)) areas.current.push(el);
  }, []);

  const models = useSyncExternalStore(
    modelStore.subscribe,
    modelStore.getSnapshot,
    modelStore.getServerSnapshot
  );
  const chosen = models.resolved
    ? models.selection
    : (models.selection ?? selection);
  /** Sorting needs both halves of the decision: an account, and a model on it. */
  const canSort = hasProvider && Boolean(chosen);

  // Opening the keyboard the instant the app loads hides most of the screen
  // before the user has looked at it, and the tap it saves is the tap they
  // were going to make anyway. So the caret only lands here on a pointer
  // device. Read from matchMedia rather than the hook: this runs once, on
  // mount, before the hook's first correction.
  useEffect(() => {
    if (window.matchMedia(MEDIA.compact).matches) return;
    liveArea()?.focus();
  }, [liveArea]);

  // A refresh should never cost the user what they were typing.
  useEffect(() => {
    if (text) localStorage.setItem(DRAFT_KEY, text);
    else localStorage.removeItem(DRAFT_KEY);
  }, [text]);

  // Growing with the content used to be measured and set here. The composer is
  // a contenteditable element now, which grows on its own — what is left is the
  // ceiling, and a ceiling is a stylesheet's job.

  /** Runs in the background — capture must never wait on a model. */
  function sortInBackground(
    dumpId: string,
    capturedText: string,
    isRetry = false
  ) {
    if (isRetry) setRetrying(true);
    sortingStore.start(dumpId);
    // Send the model that was on screen when Save was pressed, so a change
    // made a second ago is the one that runs.
    const picked = modelStore.effective(selection);
    fetch(`/api/dumps/${dumpId}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: picked
          ? { provider: picked.provider, model: picked.model }
          : undefined,
      }),
    })
      .then(async (res) => {
        const data = (await res.json()) as { error?: string; needs_key?: boolean };
        if (!res.ok) {
          setNeedsKey(Boolean(data.needs_key));
          setError(data.error ?? "Sorting failed");
          setText((current) => current || capturedText);
          setFailedRequest({ kind: "sort", dumpId, text: capturedText });
          liveArea()?.focus();
          return;
        }
        if (isRetry) {
          setText((current) => (current === capturedText ? "" : current));
          setError(null);
          setNeedsKey(false);
          setFailedRequest(null);
        }
        // The thoughts that just appeared should be mentionable immediately.
        thoughtIndex.invalidate();
        // The week panel is server-rendered from the thoughts just created.
        router.refresh();
      })
      .catch((err: unknown) => {
        setNeedsKey(false);
        setError(err instanceof Error ? err.message : "Sorting failed");
        setText((current) => current || capturedText);
        setFailedRequest({ kind: "sort", dumpId, text: capturedText });
        liveArea()?.focus();
      })
      .finally(() => {
        sortingStore.finish(dumpId);
        if (isRetry) setRetrying(false);
      });
  }

  async function save() {
    const body = text.trim();
    if (!body || saving) return;

    const capturedAt = new Date().toISOString();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    setText("");
    setError(null);
    setNeedsKey(false);
    setFailedRequest(null);
    setSaving(true);
    liveArea()?.focus();

    try {
      const saved = await pb().collection("flux_dumps").create<DumpRecord>({
        user: userId,
        text: body,
        source: "web",
        captured_at: capturedAt,
        capture_tz: timeZone,
        status: "pending",
      });

      setFlash(canSort ? "Saved — sorting it now" : "Saved");
      window.setTimeout(() => setFlash(null), 2600);
      if (canSort) sortInBackground(saved.id, body);
    } catch (err) {
      setText((current) => current || body);
      setFailedRequest({ kind: "save", text: body });
      setError(
        err instanceof Error ? `Couldn't save that. ${err.message}` : "Couldn't save that."
      );
    } finally {
      setSaving(false);
    }
  }

  function retryFailedRequest() {
    if (!failedRequest || saving || retrying) return;
    if (failedRequest.kind === "sort") {
      sortInBackground(failedRequest.dumpId, failedRequest.text, true);
      return;
    }
    void save();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void save();
    }
  }

  const shell: CaptureShellProps = {
    areaRef,
    text,
    setText,
    onKeyDown,
    save: () => void save(),
    retryFailedRequest,
    saving,
    retrying,
    flash,
    error,
    needsKey,
    failedRequest,
    hasProvider,
    canSort,
    selection,
    weekPanel,
    weekPanelCompact,
  };

  return (
    <>
      <CaptureScreenDesktop {...shell} />
      <CaptureScreenMobile {...shell} />
    </>
  );
}
