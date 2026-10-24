import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

// Reached without a session by design: Better Auth's own routes, the healthcheck, the invitation link.
const PUBLIC = ["src/app/api/auth/", "src/app/api/health/", "src/app/(auth)/invitation/"];

const sources = readdirSync("src", { recursive: true, encoding: "utf8" })
  .map((file) => path.join("src", file).replaceAll("\\", "/"))
  .filter((file) => /\.tsx?$/.test(file) && !file.endsWith(".test.ts") && !PUBLIC.some((dir) => file.startsWith(dir)));

/** The exported functions of `file` whose body does not start by awaiting one of `checks`. */
function unchecked(file: string, checks: string[]) {
  const source = readFileSync(file, "utf8");
  const functions = source.split(/(?=export async function )/).slice(1);

  return functions
    .filter((fn) => {
      // The first statements of the body, after the signature's brace; CRLF or LF line ends.
      const start = fn.search(/\{\r?\n/);
      return !checks.some((check) => fn.slice(start, start + 120).includes(`await ${check}(`));
    })
    .map((body) => `${file}: ${body.match(/export async function (\w+)/)![1]}`);
}

describe("session checks", () => {
  it("every API route handler starts with apiUser", () => {
    const routes = sources.filter((file) => file.startsWith("src/app/api/") && file.endsWith("/route.ts"));

    assert.ok(routes.length > 10);
    assert.deepEqual(routes.flatMap((file) => unchecked(file, ["apiUser"])), []);
  });

  it("every server action starts with requireUser or requireAdmin", () => {
    const actions = sources.filter((file) => /^["']use server["']/.test(readFileSync(file, "utf8")));

    assert.ok(actions.length > 3);
    assert.deepEqual(actions.flatMap((file) => unchecked(file, ["requireUser", "requireAdmin"])), []);
  });
});
