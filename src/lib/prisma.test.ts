import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { createPrismaClient } from "./prisma";

// A database of its own, created by the migrations. In WAL mode the conflict is certain: a transaction reading before
// another process commits cannot write. In the default mode, the app's, the same transactions fail as a deadlock;
// both are SQLITE_BUSY, retried the same way.
const directory = mkdtempSync(path.join(tmpdir(), "bebert-busy-"));
const url = `file:${path.join(directory, "test.db").replaceAll("\\", "/")}`;
execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });

// Two clients: two connections, like the app and the worker.
const app = createPrismaClient(url);
const worker = createPrismaClient(url);

describe("SQLite busy transactions", () => {
  after(async () => {
    await Promise.all([app.$disconnect(), worker.$disconnect()]);
    rmSync(directory, { recursive: true, force: true });
  });

  it("runs again a transaction that read before another process wrote", async () => {
    await app.$queryRawUnsafe("PRAGMA journal_mode = WAL");
    await app.user.create({ data: { id: "u", name: "u", email: "u@example.com" } });

    let attempts = 0;
    await app.$transaction(async (tx) => {
      attempts++;
      await tx.project.count();

      // The worker writes between the read and the write, on the first attempt only.
      if (attempts === 1) await worker.project.create({ data: { userId: "u", name: "par le worker" } });

      await tx.project.create({ data: { userId: "u", name: `par l'app ${attempts}` } });
    });

    assert.equal(attempts, 2);
    assert.deepEqual((await app.project.findMany({ orderBy: { createdAt: "asc" } })).map((project) => project.name), ["par le worker", "par l'app 2"]);
  });
});
