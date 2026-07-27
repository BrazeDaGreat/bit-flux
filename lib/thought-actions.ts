"use client";

import { pb } from "./pb";
import type { ThoughtRecord } from "./types";

/**
 * Archiving takes a thought out of circulation, and that includes retrieval:
 * the vector goes with it, so an archived thought isn't merely filtered out of
 * search, it isn't in the index at all. Un-archiving leaves it unindexed until
 * "Index older thoughts" in Settings picks it back up.
 */
export function statusPatch(
  status: ThoughtRecord["status"]
): Record<string, unknown> {
  return status === "archived"
    ? { status, embedding: null, embedding_model: "" }
    : { status };
}

export async function setStatus(
  id: string,
  status: ThoughtRecord["status"]
): Promise<ThoughtRecord> {
  return pb()
    .collection("flux_thoughts")
    .update<ThoughtRecord>(id, statusPatch(status));
}

export async function setThoughtTags(
  id: string,
  tags: string[]
): Promise<ThoughtRecord> {
  return pb().collection("flux_thoughts").update<ThoughtRecord>(id, {
    tags,
    edited_at: new Date().toISOString(),
  });
}

/** Every field a due date is spread across, always written together. */
export interface DuePatch {
  deadline: string;
  action_date: string;
  reminder_at: string;
  date_precision: ThoughtRecord["date_precision"];
  date_source_text: string;
  edited_at: string;
}

/**
 * The whole of a thought's due date, set or cleared in one write.
 *
 * "Due" on screen is whichever of deadline / do-on / remind-at is set, so both
 * directions have to touch all three: leaving one behind on a clear would take
 * away the date the user was looking at and reveal a different one underneath,
 * and leaving one behind on a set would put a second date on a thought the user
 * just gave exactly one.
 *
 * Their own wording goes too. "next friday" printed beside a date they picked
 * by hand is a claim about them that stopped being true.
 */
export function duePatch(value: string | null): DuePatch {
  return {
    deadline: value ?? "",
    action_date: "",
    reminder_at: "",
    date_precision: value ? "day" : "",
    date_source_text: "",
    edited_at: new Date().toISOString(),
  };
}

export async function setDue(
  id: string,
  value: string | null
): Promise<ThoughtRecord> {
  return pb().collection("flux_thoughts").update<ThoughtRecord>(id, duePatch(value));
}

export async function deleteThought(id: string): Promise<boolean> {
  return pb().collection("flux_thoughts").delete(id);
}

/**
 * What actually went wrong, in the sentence the user gets.
 *
 * PocketBase answers a rejected write with a message per field — "Invalid value
 * longterm" on `status` when the database hasn't been migrated yet. Swallowing
 * that and saying "didn't stick" turns a five-second fix into an afternoon: the
 * app knew the answer and declined to pass it on. So the field's own message is
 * shown, and the generic line is only what's left when there isn't one.
 */
export function writeError(err: unknown, fallback: string): string {
  const data = (
    err as { response?: { data?: Record<string, { message?: string }> } }
  )?.response?.data;

  const detail = data
    ? Object.values(data).find((field) => field?.message)?.message
    : undefined;

  if (!detail) return fallback;
  // The field messages are sentence fragments and arrive unpunctuated.
  return `${fallback.replace(/\.$/, "")} — ${detail.replace(/\.$/, "")}.`;
}
