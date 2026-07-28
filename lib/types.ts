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
  /** `longterm` is not a stage of doing something — it is a decision that this
   *  belongs to the years rather than the week, so it never crowds the open
   *  list and never reads as finished. */
  status: "open" | "done" | "archived" | "longterm";
  tags: string[];
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

/**
 * Someone the user keeps mentioning. Names already live on each thought, so a
 * record here exists only to hold what a name means — which is what stops the
 * model treating one Sam as two.
 */
export interface PersonRecord extends RecordModel {
  user: string;
  name: string;
  /** Who they are to the user. Fed to the model as extraction context. */
  note: string;
  origin: "user" | "ai_seen";
}

export type ProviderKind =
  | "openai"
  | "groq"
  | "gemini"
  | "openrouter"
  | "custom";

/** One connected account. A user can hold several. */
export interface ProviderRecord extends RecordModel {
  user: string;
  provider: ProviderKind;
  /** The user's own name for it — two custom endpoints need telling apart. */
  label: string;
  base_url: string;
  api_key_enc: string;
  /** The models this connection is allowed to offer, picked in Settings.
   *  Endpoints list hundreds; the picker shows only these. */
  models: string[] | null;
}

/** A model, and the connection it is reached through. */
export interface ModelRef {
  provider: string;
  model: string;
}

export interface SettingsRecord extends RecordModel {
  user: string;
  /** flux_providers id currently in use for chat. */
  active_provider: string;
  model: string;
  favorites: ModelRef[] | null;
  /** Legacy single-connection fields, migrated into flux_providers on read. */
  provider: ProviderKind | "";
  base_url: string;
  api_key_enc: string;
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

/** A connection as the browser is allowed to see it. The key itself never
 *  leaves the server. */
export interface SafeProvider {
  id: string;
  provider: ProviderKind;
  label: string;
  base_url: string;
  has_key: boolean;
  key_hint: string;
  /** The models chosen in Settings. Empty means the picker has nothing to
   *  offer from this connection yet. */
  models: string[];
}

/** What the settings screen is allowed to see. */
export interface SafeSettings {
  providers: SafeProvider[];
  /** The connection and model chat is using, if one is chosen. */
  active: ModelRef | null;
  favorites: ModelRef[];
  embed_model: string;
  auto_reminders: boolean;
  has_embed_key: boolean;
  embed_key_hint: string;
}

/** One connection with the models it offers — what the picker renders. These
 *  are the ones picked in Settings, not everything the endpoint has. */
export interface ProviderCatalog {
  provider: SafeProvider;
  models: string[];
  /** Set when there is nothing to show and the reason is worth saying. */
  note?: string;
}

export interface ChatRecord extends RecordModel {
  user: string;
  title: string;
  scope: AskScope | null;
}

export interface AskScope {
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
  /** The `[n]` marker used in an Ask answer. Older stored chats predate this
   *  field, so the renderer keeps a content-based fallback for them. */
  number?: number;
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
