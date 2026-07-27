"use client";

import PocketBase from "pocketbase";

import { freshness } from "./freshness";

export const PB_URL =
  process.env.NEXT_PUBLIC_PB_URL ?? "https://brazeapps-db.uziraze.com";

/** Cookie the server reads to identify the request. Written by the browser, so
 *  it cannot be httpOnly — PocketBase tokens are short-lived and scoped by
 *  collection rules. */
export const AUTH_COOKIE = "pb_auth";

let client: PocketBase | undefined;

export function pb(): PocketBase {
  if (client) return client;

  client = new PocketBase(PB_URL);
  client.autoCancellation(false);

  /**
   * Screens are now served from the copy the browser kept, which is only ever
   * wrong just after something was written. Every write in the app goes through
   * this client, so this is the one place that knows — no per-call bookkeeping,
   * and nothing to forget to add to the next feature that saves something.
   *
   * It marks, it does not fetch: the next screen still paints from cache
   * immediately and is brought up to date behind it.
   */
  client.beforeSend = (url, options) => {
    const method = (options.method ?? "GET").toUpperCase();
    if (method !== "GET") freshness.forget();
    return { url, options };
  };

  // Mirror the auth store into a cookie so server components see the session.
  client.authStore.onChange(() => {
    document.cookie = client!.authStore.exportToCookie(
      {
        httpOnly: false,
        secure: location.protocol === "https:",
        sameSite: "lax",
        path: "/",
      },
      AUTH_COOKIE
    );
  }, true);

  return client;
}

export function clearAuth() {
  pb().authStore.clear();
  document.cookie = `${AUTH_COOKIE}=; Max-Age=0; path=/`;
}
