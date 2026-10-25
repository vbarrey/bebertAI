import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { misspelledVariables, parseEnv } from "./env";

describe("environment variables", () => {
  it("fills the defaults of the variables not set, empty ones included", () => {
    const env = parseEnv({ REDIS_URL: "" });

    assert.equal(env.REDIS_URL, "redis://localhost:6379");
    assert.equal(env.INDEXING_CONCURRENCY, 2);
    assert.equal(env.DOCUMENTS_STORAGE_PATH, "./data/documents");
    assert.equal(env.ADMIN_EMAIL, undefined);
  });

  it("reads the numbers and refuses a wrong value, naming it", () => {
    assert.equal(parseEnv({ INDEXING_CONCURRENCY: "4" }).INDEXING_CONCURRENCY, 4);
    assert.throws(() => parseEnv({ INDEXING_CONCURRENCY: "deux" }), /INDEXING_CONCURRENCY/);
    assert.throws(() => parseEnv({ ADMIN_EMAIL: "pas-un-email" }), /ADMIN_EMAIL/);
  });

  it("tells a known variable set in another case, which Linux would not read", () => {
    assert.deepEqual(misspelledVariables({ ADMIN_EMAIl: "a@b.fr", PATH: "/bin" }), ["ADMIN_EMAIl (attendu : ADMIN_EMAIL)"]);
    assert.deepEqual(misspelledVariables({ ADMIN_EMAIL: "a@b.fr" }), []);
  });
});
