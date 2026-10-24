import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";

import { proxy, safeNext } from "./proxy";

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined);

describe("proxy", () => {
  it("sends a page without session cookie to the sign-in page, with the page asked", () => {
    const response = proxy(request("/conversations/abc?x=1"));

    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "http://localhost:3000/login?next=%2Fconversations%2Fabc%3Fx%3D1");
  });

  it("answers 401 to an API call without session cookie", async () => {
    const response = proxy(request("/api/documents/abc"));

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Non authentifié." });
  });

  it("lets the public pages and routes through, but not a path that only starts like one", () => {
    for (const path of ["/login", "/mot-de-passe-oublie", "/reinitialiser?token=t", "/invitation/abc", "/api/auth/sign-in/email", "/api/health"]) {
      assert.equal(proxy(request(path)).headers.get("x-middleware-next"), "1", path);
    }

    assert.equal(proxy(request("/loginx")).status, 307);
    assert.equal(proxy(request("/api/healthy")).status, 401);
  });

  it("lets a request with a session cookie through: the session itself is checked by the page or route", () => {
    const response = proxy(request("/api/documents/abc", "better-auth.session_token=abc.def"));

    assert.equal(response.headers.get("x-middleware-next"), "1");
  });
});

describe("safeNext", () => {
  it("keeps a path of the site", () => {
    assert.equal(safeNext("/conversations/abc?x=1"), "/conversations/abc?x=1");
  });

  it("replaces another site or a missing value with the home page", () => {
    for (const next of [undefined, "", "https://evil.com", "//evil.com", "/\\evil.com", "evil.com"]) {
      assert.equal(safeNext(next), "/", String(next));
    }
  });
});
