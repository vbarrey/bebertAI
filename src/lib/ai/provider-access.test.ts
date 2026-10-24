import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";

import { decryptApiKey, encryptApiKey, hasClearApiKey, isManageable } from "./provider-access";

describe("provider API keys", () => {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");

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
  const shared = { userId: null, type: "OLLAMA_LOCAL" as const };
  const alices = { userId: "alice", type: "ANTHROPIC" as const };

  it("a user manages their own providers, the admin also the shared Ollama local", () => {
    assert.equal(isManageable(alices, { id: "alice" }), true);
    assert.equal(isManageable(alices, { id: "bob", role: "admin" }), false);
    assert.equal(isManageable(shared, { id: "bob" }), false);
    assert.equal(isManageable(shared, { id: "bob", role: "admin" }), true);
  });

  it("a remote provider without owner is nobody's", () => {
    assert.equal(isManageable({ userId: null, type: "ANTHROPIC" }, { id: "bob", role: "admin" }), false);
  });
});
