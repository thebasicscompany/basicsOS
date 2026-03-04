import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

async function loadCryptoModule(env: Record<string, string | undefined>) {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV, ...env };
  return import("./api-key-crypto.js");
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe("api-key-crypto", () => {
  it("encrypts and decrypts API keys with primary key", async () => {
    const mod = await loadCryptoModule({
      API_KEY_ENCRYPTION_KEY: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
      API_KEY_HASH_SECRET: "hash-secret",
    });

    const enc = mod.encryptApiKey("bos_live_abc123");
    expect(enc.startsWith("v1.")).toBe(true);
    expect(mod.decryptApiKey(enc)).toBe("bos_live_abc123");
  });

  it("decrypts values encrypted with a previous rotation key", async () => {
    const oldKey = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const newKey = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    const oldModule = await loadCryptoModule({
      API_KEY_ENCRYPTION_KEY: oldKey,
    });
    const encryptedWithOldKey = oldModule.encryptApiKey("bos_live_old");

    const rotatedModule = await loadCryptoModule({
      API_KEY_ENCRYPTION_KEY: newKey,
      API_KEY_ENCRYPTION_KEY_PREVIOUS: oldKey,
    });
    expect(rotatedModule.decryptApiKey(encryptedWithOldKey)).toBe("bos_live_old");
  });

  it("hashes deterministically for the same input", async () => {
    const mod = await loadCryptoModule({
      API_KEY_ENCRYPTION_KEY: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
      API_KEY_HASH_SECRET: "hash-secret",
    });
    const h1 = mod.hashApiKey("bos_live_same");
    const h2 = mod.hashApiKey("bos_live_same");
    const h3 = mod.hashApiKey("bos_live_different");
    expect(h1).toHaveLength(64);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });

  it("falls back to legacy plaintext key if encrypted key is absent", async () => {
    const mod = await loadCryptoModule({
      API_KEY_ENCRYPTION_KEY: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
    });
    expect(mod.resolveStoredApiKey({ basicsApiKey: " legacy-key " })).toBe("legacy-key");
  });
});
