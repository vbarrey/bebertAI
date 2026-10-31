import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { before, describe, it } from "node:test";

// Set before the modules reading it are loaded: the environment is read once, when env.ts loads.
process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");

// Loaded in before(): the project compiles to CommonJS, without top-level await.
let decryptApiKey: typeof import("./provider-access").decryptApiKey;
let encryptApiKey: typeof import("./provider-access").encryptApiKey;
let hasClearApiKey: typeof import("./provider-access").hasClearApiKey;
let isManageable: typeof import("./provider-access").isManageable;

describe("provider API keys", () => {
  before(async () => {
    ({ decryptApiKey, encryptApiKey, hasClearApiKey, isManageable } = await import("./provider-access"));
  });

  it("stores the key encrypted and gives it back decrypted to the client", () => {
    const stored = encryptApiKey({ apiKey: "sk-secret-key", defaultModel: "m" });

    assert.ok(stored.apiKey.startsWith("enc:") && !stored.apiKey.includes("sk-secret-key"));
    assert.equal(stored.defaultModel, "m");
    assert.deepEqual(decryptApiKey(stored), { apiKey: "sk-secret-key", defaultModel: "m" });
  });

  it("never encrypts twice, and tells a key still in clear", () => {
    const stored = encryptApiKey({ apiKey: "sk-secret-key" });

    assert.deepEqual(encryptApiKey(stored), stored);
    assert.equal(hasClearApiKey({ apiKey: "sk-secret-key" }), true);
    assert.equal(hasClearApiKey(stored), false);
    assert.equal(hasClearApiKey({ host: "http://ollama:11434" }), false);
  });

  it("leaves a configuration without key as it is", () => {
    assert.deepEqual(decryptApiKey({ host: "http://ollama:11434" }), { host: "http://ollama:11434" });
  });
});

describe("isManageable", () => {
  it("a user manages their own providers only, the admin included", () => {
    const alices = { userId: "alice" };
    assert.equal(isManageable(alices, { id: "alice" }), true);
    assert.equal(isManageable(alices, { id: "bob" }), false);
    assert.equal(isManageable(alices, { id: "bob", role: "admin" }), false);
  });
});
