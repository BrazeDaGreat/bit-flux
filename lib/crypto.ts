import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * User-supplied API keys are encrypted before they touch the database, so a
 * database dump alone never yields a usable key. Server-only — never import
 * this from a client component.
 */

const ALGO = "aes-256-gcm";

function secret(): Buffer {
  const raw = process.env.JOLTEON_SECRET;
  if (!raw) throw new Error("JOLTEON_SECRET is not set");
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error("JOLTEON_SECRET must be 32 bytes of hex (64 characters)");
  }
  return key;
}

/** Returns "iv.tag.ciphertext", all base64url. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, secret(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    enc.toString("base64url"),
  ].join(".");
}

export function decryptSecret(payload: string): string {
  const [iv, tag, data] = payload.split(".");
  if (!iv || !tag || !data) throw new Error("Stored key is malformed");
  const decipher = createDecipheriv(ALGO, secret(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** "sk-…4f2a" — enough for the user to recognise which key is stored. */
export function maskKey(plain: string): string {
  if (plain.length <= 8) return "•".repeat(plain.length);
  return `${plain.slice(0, 3)}…${plain.slice(-4)}`;
}
