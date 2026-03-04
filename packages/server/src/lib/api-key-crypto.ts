import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const ENCRYPTION_ALGO = "aes-256-gcm";
const ENCRYPTION_VERSION = "v1";

let cachedPrimaryEncryptionKey: Buffer | null | undefined;
let cachedDecryptionKeys: Buffer[] | undefined;
let cachedHashKey: Buffer | null | undefined;

function decodeSecret(raw: string): Buffer {
  const value = raw.trim();
  if (!value) throw new Error("Secret value is empty");

  if (/^[a-fA-F0-9]{64}$/.test(value)) {
    return Buffer.from(value, "hex");
  }

  try {
    const asBase64 = Buffer.from(value, "base64");
    if (asBase64.length > 0) return asBase64;
  } catch {
    // ignored
  }

  return Buffer.from(value, "utf8");
}

function getPrimaryEncryptionKey(): Buffer | null {
  if (cachedPrimaryEncryptionKey !== undefined) return cachedPrimaryEncryptionKey;

  const raw = process.env["API_KEY_ENCRYPTION_KEY"];
  if (!raw?.trim()) {
    cachedPrimaryEncryptionKey = null;
    return null;
  }

  const key = decodeSecret(raw);
  if (key.length !== 32) {
    throw new Error("API_KEY_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }

  cachedPrimaryEncryptionKey = key;
  return cachedPrimaryEncryptionKey;
}

function getDecryptionKeys(): Buffer[] {
  if (cachedDecryptionKeys !== undefined) return cachedDecryptionKeys;

  const keys: Buffer[] = [];
  const primary = getPrimaryEncryptionKey();
  if (primary) keys.push(primary);

  const previousRaw = process.env["API_KEY_ENCRYPTION_KEY_PREVIOUS"]?.trim();
  if (previousRaw) {
    for (const chunk of previousRaw.split(",")) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;
      const key = decodeSecret(trimmed);
      if (key.length !== 32) {
        throw new Error("API_KEY_ENCRYPTION_KEY_PREVIOUS entries must decode to exactly 32 bytes");
      }
      keys.push(key);
    }
  }

  cachedDecryptionKeys = keys;
  return cachedDecryptionKeys;
}

function getHashKey(): Buffer | null {
  if (cachedHashKey !== undefined) return cachedHashKey;

  const hashRaw = process.env["API_KEY_HASH_SECRET"]?.trim();
  if (hashRaw) {
    cachedHashKey = decodeSecret(hashRaw);
    return cachedHashKey;
  }

  const encryptionKey = getPrimaryEncryptionKey();
  if (!encryptionKey) {
    cachedHashKey = null;
    return null;
  }

  cachedHashKey = encryptionKey;
  return cachedHashKey;
}

export function hasApiKeyEncryptionConfigured(): boolean {
  return Boolean(getPrimaryEncryptionKey());
}

export function encryptApiKey(plainApiKey: string): string {
  const key = getPrimaryEncryptionKey();
  if (!key) {
    throw new Error("API key encryption is not configured");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(plainApiKey, "utf8")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTION_VERSION}.${iv.toString("base64")}.${encrypted.toString("base64")}.${tag.toString("base64")}`;
}

export function decryptApiKey(encryptedApiKey: string): string | null {
  const keys = getDecryptionKeys();
  if (keys.length === 0) return null;

  const parts = encryptedApiKey.split(".");
  if (parts.length !== 4 || parts[0] !== ENCRYPTION_VERSION) {
    throw new Error("Invalid encrypted API key format");
  }

  const iv = Buffer.from(parts[1] ?? "", "base64");
  const payload = Buffer.from(parts[2] ?? "", "base64");
  const tag = Buffer.from(parts[3] ?? "", "base64");

  for (const key of keys) {
    try {
      const decipher = createDecipheriv(ENCRYPTION_ALGO, key, iv);
      decipher.setAuthTag(tag);
      const plain = Buffer.concat([decipher.update(payload), decipher.final()]);
      return plain.toString("utf8");
    } catch {
      // try next key
    }
  }

  throw new Error("Unable to decrypt API key with configured keys");
}

export function hashApiKey(plainApiKey: string): string {
  const hashKey = getHashKey();
  if (!hashKey) {
    throw new Error("API key hash secret is not configured");
  }
  return createHmac("sha256", hashKey).update(plainApiKey, "utf8").digest("hex");
}

export function resolveStoredApiKey(input: {
  basicsApiKey?: string | null;
  basicsApiKeyEnc?: string | null;
}): string | null {
  const encrypted = input.basicsApiKeyEnc?.trim();
  if (encrypted) {
    return decryptApiKey(encrypted)?.trim() ?? null;
  }

  const legacy = input.basicsApiKey?.trim();
  return legacy || null;
}
