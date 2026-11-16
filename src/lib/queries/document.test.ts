import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import { defaultDocumentListQuery, type DocumentListQuery } from "@/lib/documents/list-query";

// A database of its own, created by the migrations: set before the modules reading DATABASE_URL are loaded.
const directory = mkdtempSync(path.join(tmpdir(), "bebert-documents-page-"));
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.DATABASE_URL = `file:${path.join(directory, "test.db").replaceAll("\\", "/")}`;
execSync("npx prisma migrate deploy", { env: process.env, stdio: "ignore" });

let prisma: typeof import("@/lib/prisma").prisma;
let documents: typeof import("@/lib/queries/document");

const userId = "user-pages";
let projectId: string;

async function names(query: Partial<DocumentListQuery> = {}, offset = 0, limit = 50) {
  const page = await documents.getDocumentsPage(userId, { ...defaultDocumentListQuery, ...query, offset, limit });
  return { names: page.documents.map((document) => document.displayName), total: page.total };
}

describe("documents page: sorted, filtered and sliced by the database", () => {
  before(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    documents = await import("@/lib/queries/document");

    await prisma.user.create({ data: { id: userId, name: "pages", email: "pages@example.com" } });
    await prisma.user.create({ data: { id: "someone-else", name: "other", email: "other@example.com" } });
    projectId = (await prisma.project.create({ data: { userId, name: "Projet", documentScope: "ALL" } })).id;

    const rows: [string, number | null, string | null, "PROCESSED" | "FAILED" | "UNPLANNED", boolean][] = [
      ["beta.pdf", 300, "french", "PROCESSED", false],
      ["Alpha.txt", 100, null, "UNPLANNED", false],
      ["zeta.docx", null, "english", "FAILED", true],
      ["Gamma 100%.txt", 200, "french", "PROCESSED", false],
      ["gamma_1.txt", 50, null, "PROCESSED", true],
    ];
    for (const [index, [displayName, fileSize, language, indexingStatus, owned]] of rows.entries()) {
      await prisma.document.create({
        data: {
          userId, displayName, fileSize, language, indexingStatus, format: displayName.split(".").pop()!.toUpperCase(),
          checksum: `c${index}`, sourceType: "LOCAL", ownerProjectId: owned ? projectId : null,
          createdAt: new Date(2026, 0, index + 1),
        },
      });
    }
    await prisma.document.create({
      data: { userId: "someone-else", displayName: "aaa.txt", format: "TXT", checksum: "x", sourceType: "LOCAL" },
    });
  });

  after(async () => {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  });

  it("the newest first by default, the user's documents only", async () => {
    assert.deepEqual(await names(), {
      names: ["gamma_1.txt", "Gamma 100%.txt", "zeta.docx", "Alpha.txt", "beta.pdf"],
      total: 5,
    });
  });

  it("names sorted whatever their case", async () => {
    assert.deepEqual((await names({ sort: "displayName", order: "asc" })).names,
      ["Alpha.txt", "beta.pdf", "Gamma 100%.txt", "gamma_1.txt", "zeta.docx"]);
  });

  it("the empty values last, in both orders", async () => {
    assert.deepEqual((await names({ sort: "fileSize", order: "asc" })).names,
      ["gamma_1.txt", "Alpha.txt", "Gamma 100%.txt", "beta.pdf", "zeta.docx"]);
    assert.deepEqual((await names({ sort: "fileSize", order: "desc" })).names,
      ["beta.pdf", "Gamma 100%.txt", "Alpha.txt", "gamma_1.txt", "zeta.docx"]);
  });

  it("slices that follow one another, ties included", async () => {
    const all = (await names({ sort: "language", order: "asc" })).names;
    const slices = [...(await names({ sort: "language", order: "asc" }, 0, 2)).names,
      ...(await names({ sort: "language", order: "asc" }, 2, 2)).names,
      ...(await names({ sort: "language", order: "asc" }, 4, 2)).names];

    assert.deepEqual(slices, all);
    assert.equal((await names({}, 4, 2)).total, 5);
  });

  it("search: case-insensitive, % and _ taken as letters", async () => {
    assert.deepEqual((await names({ search: "GAMMA", sort: "displayName", order: "asc" })).names, ["Gamma 100%.txt", "gamma_1.txt"]);
    assert.deepEqual((await names({ search: "100%" })).names, ["Gamma 100%.txt"]);
    assert.deepEqual((await names({ search: "a_1" })).names, ["gamma_1.txt"]);
  });

  it("status and location filters", async () => {
    assert.deepEqual(await names({ status: "PROCESSED", sort: "displayName", order: "asc" }), {
      names: ["beta.pdf", "Gamma 100%.txt", "gamma_1.txt"],
      total: 3,
    });
    assert.deepEqual((await names({ location: "LIBRARY", sort: "displayName", order: "asc" })).names,
      ["Alpha.txt", "beta.pdf", "Gamma 100%.txt"]);
    assert.deepEqual((await names({ location: projectId, sort: "displayName", order: "asc" })).names, ["gamma_1.txt", "zeta.docx"]);
    assert.deepEqual((await names({ location: projectId, status: "FAILED" })).names, ["zeta.docx"]);
  });

  it("stats counted over every document of the user", async () => {
    const stats = await documents.getDocumentStats(userId);

    assert.deepEqual(stats.counts, { PROCESSED: 3, FAILED: 1, UNPLANNED: 1 });
    assert.equal(stats.total, 5);
    assert.deepEqual(stats.ownerProjects, [{ id: projectId, name: "Projet" }]);
  });
});
