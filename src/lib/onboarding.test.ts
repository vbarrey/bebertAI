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
let onboarding: typeof import("@/lib/onboarding");

before(async () => {
  ({ prisma } = await import("@/lib/prisma"));
  runtime = await import("@/lib/pipeline/runtime");
  setup = await import("@/lib/pipeline/setup");
  onboarding = await import("@/lib/onboarding");
  await prisma.user.create({ data: { id: "user-bob", name: "bob", email: "bob@example.com" } });
});

after(async () => {
  await prisma.$disconnect();
  rmSync(directory, { recursive: true, force: true });
});

describe("setup status", () => {
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

describe("onboarding", () => {
  const ownModels = async (userId: string) => {
    const provider = await prisma.aIProvider.create({
      data: {
        userId, name: "Cloud", type: "OLLAMA_CLOUD", source: "REMOTE",
        configuration: { apiKey: "key" },
        models: { create: [{ name: "g" }, { name: "e" }] },
      },
    });
    return { generation: { providerId: provider.id, modelName: "g" }, embedding: { providerId: provider.id, modelName: "e" } };
  };

  it("needsOnboarding: a new user without setup goes to the welcome page until they postpone it", async () => {
    const carol = await prisma.user.create({ data: { id: "user-carol", name: "carol", email: "carol@example.com" } });
    assert.equal(await onboarding.needsOnboarding(carol.id), true);
    await onboarding.skipOnboarding(carol.id);
    assert.equal(await onboarding.needsOnboarding(carol.id), false);
  });

  it("needsOnboarding marks a configured user as onboarded", async () => {
    // Bob is configured by the setup tests, whose last one disables "e": enabled again so this test does not depend on it.
    await prisma.aIModel.updateMany({ where: { name: "e" }, data: { enabled: true } });
    assert.equal(await onboarding.needsOnboarding("user-bob"), false);
    assert.ok((await prisma.user.findUniqueOrThrow({ where: { id: "user-bob" } })).onboardedAt);
  });

  it("completeOnboarding sets both steps on the user's own models only", async () => {
    // Dave has no documents: choosing his embedding model does not need Qdrant.
    const dave = await prisma.user.create({ data: { id: "user-dave", name: "dave", email: "dave@example.com" } });
    const bobs = await ownModels("user-bob");
    const daves = await ownModels(dave.id);
    await assert.rejects(onboarding.completeOnboarding(dave.id, bobs), /Fournisseur inconnu/);
    await onboarding.completeOnboarding(dave.id, daves);
    const { parameters } = await runtime.getPipelineConfig(dave.id);
    assert.deepEqual([parameters.generation.modelName, parameters.embedding.modelName], ["g", "e"]);
    assert.equal(await onboarding.needsOnboarding(dave.id), false);
  });
});

describe("pipeline save with a provider gone", () => {
  it("a step left on a deleted provider does not block saving the others", async () => {
    const erin = await prisma.user.create({ data: { id: "user-erin", name: "erin", email: "erin@example.com" } });
    const provider = await prisma.aIProvider.create({
      data: {
        userId: erin.id, name: "Cloud", type: "OLLAMA_CLOUD", source: "REMOTE",
        configuration: { apiKey: "key" },
        models: { create: [{ name: "g" }] },
      },
    });
    const config = await runtime.getPipelineConfig(erin.id);
    config.parameters.embedding = { ...config.parameters.embedding, providerId: "deleted-provider", modelName: "e" };
    await prisma.pipelineParameters.update({ where: { userId: erin.id }, data: { parameters: JSON.stringify(config.parameters) } });

    const parameters = { ...config.parameters, generation: { ...config.parameters.generation, providerId: provider.id, modelName: "g" } };
    const saved = await runtime.updatePipelineParameters(erin.id, parameters);
    assert.equal(saved.parameters.generation.providerId, provider.id);
  });

  it("a step on another user's provider is still refused", async () => {
    const bobs = await prisma.aIProvider.findFirstOrThrow({ where: { userId: "user-bob" } });
    const { parameters } = await runtime.getPipelineConfig("user-erin");
    const onBobs = { ...parameters, generation: { ...parameters.generation, providerId: bobs.id, modelName: "g" } };
    await assert.rejects(runtime.updatePipelineParameters("user-erin", onBobs), /Fournisseur inconnu/);
  });
});
