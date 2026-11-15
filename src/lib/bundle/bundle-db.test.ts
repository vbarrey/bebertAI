import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

// A database of its own, created by the migrations: set before the modules reading DATABASE_URL are loaded.
const directory = mkdtempSync(path.join(tmpdir(), "bebert-bundle-db-"));
process.env.DATABASE_URL = `file:${path.join(directory, "test.db").replaceAll("\\", "/")}`;
execSync("npx prisma migrate deploy", { env: process.env, stdio: "ignore" });

// Loaded in before(): the project compiles to CommonJS, without top-level await.
let prisma: typeof import("@/lib/prisma").prisma;
let selection: typeof import("./selection");
let worker: typeof import("@/workers/bundle");
let importer: typeof import("./import");

before(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    selection = await import("./selection");
    worker = await import("@/workers/bundle");
    importer = await import("./import");
});

after(async () => {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
});

describe("export selection", () => {
    const ids: Record<string, string> = {};

    before(async () => {
        for (const name of ["alice", "bob"]) {
            await prisma.user.create({ data: { id: name, name, email: `${name}@example.com` } });
        }
        const project = await prisma.project.create({ data: { userId: "alice", name: "Moteurs" } });
        const document = async (key: string, data: { ownerProjectId?: string; indexingStatus?: "PROCESSED" | "NEEDREINDEX"; userId?: string }) => {
            const created = await prisma.document.create({
                data: { userId: "alice", displayName: key, format: "TXT", checksum: key, sourceType: "LOCAL", indexingStatus: "PROCESSED", ...data },
            });
            ids[key] = created.id;
        };
        await document("library", {});
        await document("selected", {});
        await document("stale", { indexingStatus: "NEEDREINDEX" });
        await document("own", { ownerProjectId: project.id });
        await document("bob", { userId: "bob" });
        await prisma.projectDocument.create({ data: { projectId: project.id, documentId: ids.selected! } });
        ids.project = project.id;
    });

    const exported = async (where: Parameters<typeof selection.exportedWhere>[1], userId = "alice") =>
        (await prisma.document.findMany({ where: selection.exportedWhere(userId, where), select: { displayName: true } }))
            .map(({ displayName }) => displayName).sort();

    it("exports the indexed documents of the chosen scope", async () => {
        assert.deepEqual(await exported({ kind: "library" }), ["library", "selected"]);
        assert.deepEqual(await exported({ kind: "project", projectId: ids.project! }), ["own", "selected"]);
        assert.deepEqual(await exported({ kind: "all" }), ["library", "own", "selected"]);
    });

    it("never exports another user's documents, even picked by id", async () => {
        assert.deepEqual(await exported({ kind: "documents", documentIds: [ids.library!, ids.bob!] }), ["library"]);
        assert.deepEqual(await exported({ kind: "project", projectId: ids.project! }, "bob"), []);
    });
});

describe("bundle cleanup", () => {
    it("deletes the bundle files older than a day, keeping their jobs", async () => {
        const file = (name: string) => {
            const filePath = path.join(directory, name);
            writeFileSync(filePath, "bundle");
            return filePath;
        };
        const job = (filePath: string, createdAt: Date) => prisma.bundleJob.create({
            data: { userId: "alice", kind: "EXPORT", status: "COMPLETED", label: "Tout", parameters: {}, filePath, createdAt },
        });
        const now = new Date("2026-11-16T12:00:00Z");
        const old = await job(file("old.bebert"), new Date("2026-11-15T11:00:00Z"));
        const recent = await job(file("recent.bebert"), new Date("2026-11-15T13:00:00Z"));

        await worker.deleteExpiredBundles(now);

        assert.equal(existsSync(path.join(directory, "old.bebert")), false);
        assert.equal((await prisma.bundleJob.findUniqueOrThrow({ where: { id: old.id } })).filePath, null);
        assert.equal(existsSync(path.join(directory, "recent.bebert")), true);
        assert.notEqual((await prisma.bundleJob.findUniqueOrThrow({ where: { id: recent.id } })).filePath, null);
    });
});

describe("canary agreement", () => {
    it("is the lowest cosine between the bundle's vectors and the importing model's", () => {
        assert.equal(importer.canaryAgreement([[1, 0], [0, 2]], [[2, 0], [0, 1]]), 1);
        assert.ok(Math.abs(importer.canaryAgreement([[1, 0], [1, 0]], [[1, 0], [1, 1]]) - Math.SQRT1_2) < 1e-9);
    });

    it("is 0 for vectors of another dimension or another count", () => {
        assert.equal(importer.canaryAgreement([[1, 0]], [[1, 0, 0]]), 0);
        assert.equal(importer.canaryAgreement([[1, 0]], [[1, 0], [1, 0]]), 0);
    });
});
