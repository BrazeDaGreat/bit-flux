"use client";

import PocketBase from "pocketbase";

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
