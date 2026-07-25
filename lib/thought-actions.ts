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

export async function deleteThought(id: string): Promise<boolean> {
  return pb().collection("flux_thoughts").delete(id);
}
