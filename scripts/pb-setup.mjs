/**
 * Idempotent PocketBase schema setup for Project Jolteon.
 *
 * Creates/updates the flux_* collections. Safe to re-run: existing collections
 * are patched by name, never dropped.
 *
 * Usage: pnpm pb:setup
 * Requires PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD in .env.local
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// --- tiny .env.local loader (no dependency needed) ---
function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (!match) continue;
      const [, key, value = ""] = match;
      if (process.env[key] === undefined) {
        process.env[key] = value.trim().replace(/^["'](.*)["']$/, "$1");
      }
    }
  } catch {
    // no .env.local — rely on real env vars
  }
}
loadEnv();

const PB_URL = process.env.PB_URL ?? process.env.NEXT_PUBLIC_PB_URL;
const EMAIL = process.env.PB_ADMIN_EMAIL;
const PASSWORD = process.env.PB_ADMIN_PASSWORD;

if (!PB_URL || !EMAIL || !PASSWORD) {
  console.error(
    "Missing PB_URL / PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD. Copy .env.example to .env.local and fill it in.",
  );
  process.exit(1);
}

const api = async (path, init = {}, token) => {
  const res = await fetch(`${PB_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
      ...init.headers,
    },
  });
  const body = res.status === 204 ? null : await res.json();
  if (!res.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${path} -> ${res.status}\n${JSON.stringify(body, null, 2)}`,
    );
  }
  return body;
};

// --- field helpers ---------------------------------------------------------

const text = (name, opts = {}) => ({ name, type: "text", ...opts });
const editor = (name, opts = {}) => ({ name, type: "editor", ...opts });
const bool = (name, opts = {}) => ({ name, type: "bool", ...opts });
const json = (name, opts = {}) => ({
  name,
  type: "json",
  maxSize: 2000000,
  ...opts,
});
const number = (name, opts = {}) => ({ name, type: "number", ...opts });
const date = (name, opts = {}) => ({ name, type: "date", ...opts });
const url = (name, opts = {}) => ({ name, type: "url", ...opts });
const select = (name, values, opts = {}) => ({
  name,
  type: "select",
  values,
  maxSelect: 1,
  ...opts,
});
const relation = (name, collectionId, opts = {}) => ({
  name,
  type: "relation",
  collectionId,
  cascadeDelete: false,
  maxSelect: 1,
  ...opts,
});
const autodate = (name, opts) => ({ name, type: "autodate", ...opts });
const timestamps = () => [
  autodate("created", { onCreate: true, onUpdate: false }),
  autodate("updated", { onCreate: true, onUpdate: true }),
];

/** Owner-scoped rules — same pattern the existing focus_sync collection uses. */
const OWNER_RULES = {
  listRule: "@request.auth.id != '' && user = @request.auth.id",
  viewRule: "@request.auth.id != '' && user = @request.auth.id",
  createRule: "@request.auth.id != '' && user = @request.auth.id",
  updateRule: "@request.auth.id != '' && user = @request.auth.id",
  deleteRule: "@request.auth.id != '' && user = @request.auth.id",
};

// --- main ------------------------------------------------------------------

const auth = await api("/api/collections/_superusers/auth-with-password", {
  method: "POST",
  body: JSON.stringify({ identity: EMAIL, password: PASSWORD }),
});
const token = auth.token;
console.log("authenticated as superuser");

const existing = await api("/api/collections?perPage=200", {}, token);
const byName = new Map(existing.items.map((c) => [c.name, c]));

const usersId = byName.get("users")?.id;
if (!usersId)
  throw new Error("users collection not found — cannot wire relations");

const ids = {
  users: usersId,
  // filled in as collections are created, so later definitions can reference them
};

/**
 * Collections are defined lazily so each one can reference ids of the
 * collections created before it.
 */
const definitions = [
  () => ({
    name: "flux_dumps",
    type: "base",
    ...OWNER_RULES,
    fields: [
      relation("user", ids.users, { required: true, cascadeDelete: true }),
      text("text", { required: true, max: 100000 }),
      select("source", ["web", "api", "voice"]),
      date("captured_at"),
      text("capture_tz", { max: 64 }),
      select("status", ["pending", "processing", "processed", "failed"]),
      date("processed_at"),
      text("process_error", { max: 2000 }),
      text("model_used", { max: 200 }),
      ...timestamps(),
    ],
    indexes: [
      "CREATE INDEX `idx_flux_dumps_user_status` ON `flux_dumps` (`user`, `status`)",
      "CREATE INDEX `idx_flux_dumps_user_captured` ON `flux_dumps` (`user`, `captured_at`)",
    ],
  }),

  () => ({
    name: "flux_collections",
    type: "base",
    ...OWNER_RULES,
    fields: [
      relation("user", ids.users, { required: true, cascadeDelete: true }),
      text("name", { required: true, max: 200 }),
      select("kind", ["project", "topic", "person"]),
      text("description", { max: 2000 }),
      text("color", { max: 40 }),
      bool("archived"),
      ...timestamps(),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_flux_collections_user_name` ON `flux_collections` (`user`, `name`)",
    ],
  }),

  () => ({
    name: "flux_tags",
    type: "base",
    ...OWNER_RULES,
    fields: [
      relation("user", ids.users, { required: true, cascadeDelete: true }),
      text("name", { required: true, max: 100 }),
      text("description", { max: 2000 }),
      text("color", { max: 40 }),
      select("origin", ["user", "ai_suggested"]),
      bool("approved"),
      number("usage_count"),
      ...timestamps(),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_flux_tags_user_name` ON `flux_tags` (`user`, `name`)",
    ],
  }),

  () => ({
    name: "flux_thoughts",
    type: "base",
    ...OWNER_RULES,
    fields: [
      relation("user", ids.users, { required: true, cascadeDelete: true }),
      relation("dump", ids.flux_dumps, { required: true, cascadeDelete: true }),
      number("dump_index"),
      text("title", { max: 300 }),
      editor("body"),
      select("status", ["open", "done", "archived"]),
      relation("tags", ids.flux_tags, { maxSelect: 30 }),
      relation("project", ids.flux_collections, {}),
      json("people"),
      date("action_date"),
      date("deadline"),
      date("reminder_at"),
      date("resurface_at"),
      select("date_precision", ["exact", "day", "week", "month", "vague"]),
      text("date_source_text", { max: 500 }),
      number("confidence"),
      bool("needs_review"),
      json("embedding"),
      text("embedding_model", { max: 200 }),
      date("edited_at"),
      ...timestamps(),
    ],
    indexes: [
      "CREATE INDEX `idx_flux_thoughts_user_action` ON `flux_thoughts` (`user`, `action_date`)",
      "CREATE INDEX `idx_flux_thoughts_user_review` ON `flux_thoughts` (`user`, `needs_review`)",
      "CREATE INDEX `idx_flux_thoughts_dump` ON `flux_thoughts` (`dump`)",
    ],
  }),

  () => ({
    name: "flux_thought_versions",
    type: "base",
    ...OWNER_RULES,
    fields: [
      relation("user", ids.users, { required: true, cascadeDelete: true }),
      relation("thought", ids.flux_thoughts, {
        required: true,
        cascadeDelete: true,
      }),
      json("snapshot"),
      select("reason", ["ai_initial", "user_edit", "merge", "split"]),
      ...timestamps(),
    ],
    indexes: [
      "CREATE INDEX `idx_flux_versions_thought` ON `flux_thought_versions` (`thought`)",
    ],
  }),

  () => ({
    name: "flux_settings",
    type: "base",
    ...OWNER_RULES,
    fields: [
      relation("user", ids.users, { required: true, cascadeDelete: true }),
      select("provider", ["openai", "groq", "gemini", "openrouter", "custom"]),
      url("base_url", { onlyDomains: null }),
      // AES-256-GCM ciphertext. Never sent to the browser — server routes strip it.
      text("api_key_enc", { max: 4000 }),
      text("model", { max: 200 }),
      // Embeddings are always Gemini (AI Studio), independent of the chat
      // provider, so they get their own key.
      text("embed_api_key_enc", { max: 4000 }),
      text("embed_model", { max: 200 }),
      bool("auto_reminders"),
      select("theme", ["light", "dark", "system"]),
      json("prefs"),
      ...timestamps(),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_flux_settings_user` ON `flux_settings` (`user`)",
    ],
  }),

  () => ({
    name: "flux_chats",
    type: "base",
    ...OWNER_RULES,
    fields: [
      relation("user", ids.users, { required: true, cascadeDelete: true }),
      text("title", { max: 300 }),
      // Optional narrowing: project, tag, person, date range.
      json("scope"),
      ...timestamps(),
    ],
    indexes: [
      "CREATE INDEX `idx_flux_chats_user` ON `flux_chats` (`user`, `updated`)",
    ],
  }),

  () => ({
    name: "flux_messages",
    type: "base",
    ...OWNER_RULES,
    fields: [
      relation("user", ids.users, { required: true, cascadeDelete: true }),
      relation("chat", ids.flux_chats, { required: true, cascadeDelete: true }),
      select("role", ["user", "assistant"]),
      text("content", { max: 50000 }),
      // [{kind:'thought'|'dump', id, title, snippet}] — every answer stays
      // traceable to what it was built from.
      json("citations"),
      text("model_used", { max: 200 }),
      ...timestamps(),
    ],
    indexes: [
      "CREATE INDEX `idx_flux_messages_chat` ON `flux_messages` (`chat`, `created`)",
    ],
  }),
];

for (const define of definitions) {
  const def = define();
  const current = byName.get(def.name);

  if (!current) {
    const created = await api(
      "/api/collections",
      { method: "POST", body: JSON.stringify(def) },
      token,
    );
    ids[def.name] = created.id;
    byName.set(def.name, created);
    console.log(`created  ${def.name}`);
    continue;
  }

  // Patch: keep existing field ids so data survives, add anything missing.
  const currentFields = new Map(current.fields.map((f) => [f.name, f]));
  const mergedFields = def.fields.map((f) => {
    const prev = currentFields.get(f.name);
    return prev ? { ...f, id: prev.id } : f;
  });
  // Preserve fields the script doesn't know about (e.g. added by hand).
  for (const [name, f] of currentFields) {
    if (!def.fields.some((d) => d.name === name) && name !== "id")
      mergedFields.push(f);
  }

  const updated = await api(
    `/api/collections/${current.id}`,
    { method: "PATCH", body: JSON.stringify({ ...def, fields: mergedFields }) },
    token,
  );
  ids[def.name] = updated.id;
  byName.set(def.name, updated);
  console.log(`updated  ${def.name}`);
}

console.log("\nschema ready.");
