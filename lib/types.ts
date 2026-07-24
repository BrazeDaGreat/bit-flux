import type { RecordModel } from "pocketbase";

export type DumpStatus = "pending" | "processing" | "processed" | "failed";

export type DatePrecision = "exact" | "day" | "week" | "month" | "vague";

export interface UserRecord extends RecordModel {
  email: string;
  name: string;
  avatarUrl: string;
  provider: string;
}

export interface DumpRecord extends RecordModel {
  user: string;
  /** The original submission. Never edited after create. */
  text: string;
  source: "web" | "api" | "voice";
  captured_at: string;
  capture_tz: string;
  status: DumpStatus;
  processed_at: string;
  process_error: string;
  model_used: string;
}

export interface ThoughtRecord extends RecordModel {
  user: string;
  dump: string;
  dump_index: number;
  title: string;
  body: string;
  status: "open" | "done" | "archived";
  tags: string[];
  project: string;
  people: { name: string; collection_id?: string }[] | null;
  action_date: string;
  deadline: string;
  reminder_at: string;
  resurface_at: string;
  date_precision: DatePrecision | "";
  /** The user's own wording for the date, kept so "next week" still reads as
   *  "next week" a month from now. */
  date_source_text: string;
  confidence: number;
  needs_review: boolean;
  embedding: number[] | null;
  embedding_model: string;
  edited_at: string;
}

export interface TagRecord extends RecordModel {
  user: string;
  name: string;
  /** Fed to the model as classification context — this is what makes tagging
   *  personal rather than generic. */
  description: string;
  color: string;
  origin: "user" | "ai_suggested";
  approved: boolean;
  usage_count: number;
}

export interface CollectionRecord extends RecordModel {
  user: string;
  name: string;
  kind: "project" | "topic" | "person";
  description: string;
  color: string;
  archived: boolean;
}

export interface SettingsRecord extends RecordModel {
  user: string;
  provider: "openai" | "groq" | "gemini" | "openrouter" | "custom" | "";
  base_url: string;
  api_key_enc: string;
  model: string;
  /** Separate Gemini key — embeddings never use the chat provider. */
  embed_api_key_enc: string;
  embed_model: string;
  auto_reminders: boolean;
  theme: "light" | "dark" | "system" | "";
  prefs: { corrections?: string[] } | null;
}

export interface ThoughtVersionRecord extends RecordModel {
  user: string;
  thought: string;
  snapshot: Record<string, unknown>;
  reason: "ai_initial" | "user_edit" | "merge" | "split";
}

/** What the settings screen is allowed to see. The key itself never leaves
 *  the server. */
export interface SafeSettings {
  provider: SettingsRecord["provider"];
  base_url: string;
  model: string;
  embed_model: string;
  auto_reminders: boolean;
  has_key: boolean;
  key_hint: string;
  has_embed_key: boolean;
  embed_key_hint: string;
}

export interface ChatRecord extends RecordModel {
  user: string;
  title: string;
  scope: AskScope | null;
}

export interface AskScope {
  project?: string;
  tag?: string;
  person?: string;
  from?: string;
  to?: string;
}

export interface Citation {
  kind: "thought" | "dump";
  id: string;
  title: string;
  snippet: string;
}

export interface MessageRecord extends RecordModel {
  user: string;
  chat: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[] | null;
  model_used: string;
}

export const TAG_COLORS = [
  "iris",
  "mint",
  "apricot",
  "blush",
  "sky",
  "amber",
  "sage",
] as const;
