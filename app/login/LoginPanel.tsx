"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { pb } from "@/lib/pb";
import ProviderIcon from "@/components/ProviderIcon";

const LABELS: Record<string, string> = {
  github: "GitHub",
  discord: "Discord",
  google: "Google",
};

export default function LoginPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const [providers, setProviders] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Built from whatever PocketBase reports, so a provider added in the admin
  // UI shows up here without a code change.
  useEffect(() => {
    pb()
      .collection("users")
      .listAuthMethods()
      .then((methods) =>
        setProviders(methods.oauth2.providers.map((p) => p.name))
      )
      .catch(() => setError("Can't reach the server. Try again in a moment."));
  }, []);

  // Not an async handler: Safari blocks window.open from async click handlers.
  function signIn(provider: string) {
    setBusy(provider);
    setError(null);
    pb()
      .collection("users")
      .authWithOAuth2({ provider })
      .then(() => {
        router.replace(params.get("next") || "/");
        router.refresh();
      })
      .catch((err: unknown) => {
        setBusy(null);
        const message =
          err instanceof Error ? err.message : "Sign-in didn't complete.";
        setError(
          /cancel|closed/i.test(message)
            ? "Sign-in was cancelled."
            : `Sign-in didn't complete. ${message}`
        );
      });
  }

  return (
    <div className="flex flex-col gap-2.5">
      {providers === null ? (
        <div className="flex flex-col gap-2.5" aria-hidden="true">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-[3.25rem] animate-pulse rounded-2xl bg-surface-3"
            />
          ))}
        </div>
      ) : providers.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink-soft">
          No sign-in providers are enabled on the server yet.
        </p>
      ) : (
        providers.map((provider) => (
          <button
            key={provider}
            type="button"
            disabled={busy !== null}
            onClick={() => signIn(provider)}
            className="group flex h-[3.25rem] items-center gap-3 rounded-2xl border border-line-strong bg-surface px-4 text-left transition-all hover:-translate-y-px hover:border-iris hover:shadow-[0_6px_16px_-8px_var(--iris)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
          >
            <ProviderIcon
              provider={provider}
              className="h-5 w-5 shrink-0 text-ink-soft transition-colors group-hover:text-ink"
            />
            <span className="text-[0.9rem] font-medium text-ink">
              Continue with {LABELS[provider] ?? provider}
            </span>
            <span className="ml-auto font-data text-[0.7rem] text-ink-faint">
              {busy === provider ? "waiting…" : "→"}
            </span>
          </button>
        ))
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-blush-soft px-3.5 py-2.5 text-[0.8rem] text-blush"
        >
          {error}
        </p>
      )}
    </div>
  );
}
