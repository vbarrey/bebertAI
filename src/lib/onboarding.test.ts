import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

// A database of its own, created by the migrations: set before the modules reading DATABASE_URL are loaded.
const directory = mkdtempSync(path.join(tmpdir(), "bebert-onboarding-"));
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.DATABASE_URL = `file:${path.join(directory, "test.db").replaceAll("\\", "/")}`;
execSync("npx prisma migrate deploy", { env: process.env, stdio: "ignore" });

// Loaded in before(): the project compiles to CommonJS, without top-level await.
let prisma: typeof import("@/lib/prisma").prisma;
let runtime: typeof import("@/lib/pipeline/runtime");
let setup: typeof import("@/lib/pipeline/setup");

describe("setup status", () => {
  before(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    runtime = await import("@/lib/pipeline/runtime");
    setup = await import("@/lib/pipeline/setup");
    await prisma.user.create({ data: { id: "user-bob", name: "bob", email: "bob@example.com" } });
  });

  after(async () => {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  });

  it("a new user has no provider and both steps unset", async () => {
    const status = await setup.getSetupStatus("user-bob");
    assert.equal(status.providerCount, 0);
    assert.match(status.generation!, /Pipeline non configuré/);
    assert.match(status.embedding!, /Pipeline non configuré/);
    assert.equal(setup.isSetupComplete(status), false);
  });

  it("is complete once both steps are on usable models", async () => {
    const provider = await prisma.aIProvider.create({
      data: {
        userId: "user-bob", name: "Cloud", type: "OLLAMA_CLOUD", source: "REMOTE",
        configuration: { apiKey: "key" },
        models: { create: [{ name: "g" }, { name: "e" }] },
      },
    });
    const config = await runtime.getPipelineConfig("user-bob");
    config.parameters.generation = { ...config.parameters.generation, providerId: provider.id, modelName: "g" };
    config.parameters.embedding = { ...config.parameters.embedding, providerId: provider.id, modelName: "e" };
    await prisma.pipelineParameters.update({ where: { userId: "user-bob" }, data: { parameters: JSON.stringify(config.parameters) } });

    const status = await setup.getSetupStatus("user-bob");
    assert.deepEqual(status, { providerCount: 1, generation: null, embedding: null });
    assert.equal(setup.isSetupComplete(status), true);
  });

  it("gives the reason of each broken step", async () => {
    await prisma.aIModel.updateMany({ where: { name: "e" }, data: { enabled: false } });
    const status = await setup.getSetupStatus("user-bob");
    assert.equal(status.generation, null);
    assert.match(status.embedding!, /est désactivé/);
    assert.equal(setup.isSetupComplete(status), false);
  });
});
