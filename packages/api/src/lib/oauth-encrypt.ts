/**
 * AES-256-GCM encryption for OAuth tokens stored in the database.
 * Requires OAUTH_ENCRYPTION_KEY=<64 hex chars> (32 bytes) in environment.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

const getKey = (): Buffer => {
  const hex = process.env["OAUTH_ENCRYPTION_KEY"];
  if (!hex || hex.length !== 64) {
    throw new Error("OAUTH_ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate with: openssl rand -hex 32");
  }
  return Buffer.from(hex, "hex");
};

/** Encrypt plaintext to base64-encoded ciphertext (IV:TAG:CIPHERTEXT). */
export const encrypt = (plaintext: string): string => {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
};

/** Decrypt base64-encoded ciphertext back to plaintext. Returns null on failure. */
export const decrypt = (encoded: string): string | null => {
  try {
    const key = getKey();
    const buf = Buffer.from(encoded, "base64");
    const iv = buf.subarray(0, IV_BYTES);
    const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext) + decipher.final("utf8");
  } catch {
    return null;
  }
};
