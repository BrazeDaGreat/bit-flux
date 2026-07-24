import { cookies } from "next/headers";
import PocketBase from "pocketbase";

import type { UserRecord } from "./types";

export const PB_URL =
  process.env.NEXT_PUBLIC_PB_URL ?? "https://brazeapps-db.uziraze.com";

export const AUTH_COOKIE = "pb_auth";

/**
 * A fresh PocketBase instance per request. Never hoist this to a module-level
 * singleton — on the server that would leak one user's auth into another's
 * request.
 */
export async function pbServer(): Promise<PocketBase> {
  const client = new PocketBase(PB_URL);
  const store = await cookies();
  const raw = store.get(AUTH_COOKIE)?.value;

  if (raw) {
    client.authStore.loadFromCookie(`${AUTH_COOKIE}=${raw}`, AUTH_COOKIE);
  }

  return client;
}

/** The signed-in user, or null. Does not redirect. */
export async function currentUser(): Promise<UserRecord | null> {
  const client = await pbServer();
  if (!client.authStore.isValid) return null;
  return (client.authStore.record as UserRecord | null) ?? null;
}
