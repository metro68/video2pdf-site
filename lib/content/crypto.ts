import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Encryption for OAuth tokens at rest.
//
// AES-256-GCM: authenticated, so a tampered ciphertext fails to decrypt rather
// than yielding garbage that gets sent to a platform API. The key comes from
// CONTENT_TOKEN_KEY (32 bytes, base64) and never leaves the server.
//
// Stored format is "v1.<iv>.<authTag>.<ciphertext>", all base64. The version
// prefix means the scheme can change later without guessing at old rows.

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function key(): Buffer {
  const raw = process.env.CONTENT_TOKEN_KEY;
  if (!raw) throw new Error("CONTENT_TOKEN_KEY is not set");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("CONTENT_TOKEN_KEY must be 32 bytes, base64 encoded");
  }
  return buf;
}

export function isConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

export function decryptToken(stored: string): string {
  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("unrecognised token format");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
