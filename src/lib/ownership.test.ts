import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

// A database of its own, created by the migrations: set before the modules reading DATABASE_URL are loaded.
const directory = mkdtempSync(path.join(tmpdir(), "bebert-ownership-"));
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.DATABASE_URL = `file:${path.join(directory, "test.db").replaceAll("\\", "/")}`;
execSync("npx prisma migrate deploy", { env: process.env, stdio: "ignore" });

// Loaded in before(): the project compiles to CommonJS, without top-level await.
let prisma: typeof import("@/lib/prisma").prisma;
let conversations: typeof import("@/lib/queries/conversation");
let projects: typeof import("@/lib/queries/project");
let documents: typeof import("@/lib/queries/document");
let scope: typeof import("@/lib/rag/retrieval/document-scope");
let providers: typeof import("@/lib/queries/aiProvider");
let runtime: typeof import("@/lib/pipeline/runtime");
let drive: typeof import("@/lib/google-drive/auth");
let encryption: typeof import("@/lib/encryption");
let documentMutations: typeof import("@/lib/mutations/document");

/** One user with a project, a conversation in it and one outside, a library document and a project document. */
async function seed(name: string) {
  const user = await prisma.user.create({ data: { id: `user-${name}`, name, email: `${name}@example.com` } });
  const project = await prisma.project.create({ data: { userId: user.id, name: "Nouveau projet", documentScope: "ALL" } });
  const document = (suffix: string, ownerProjectId: string | null = null) =>
    prisma.document.create({
      data: {
        userId: user.id, displayName: `${name}-${suffix}.txt`, format: "TXT", checksum: "same-file", sourceType: "LOCAL",
        indexingStatus: "PROCESSED", ownerProjectId,
      },
    });
  const library = await document("library");
  const owned = await prisma.document.create({
    data: {
      userId: user.id, displayName: `${name}-project.txt`, format: "TXT", checksum: `project-${name}`, sourceType: "LOCAL",
      indexingStatus: "PROCESSED", ownerProjectId: project.id,
    },
  });
  const inProject = await prisma.conversation.create({ data: { userId: user.id, projectId: project.id } });
  const outside = await prisma.conversation.create({ data: { userId: user.id } });
  await prisma.message.create({ data: { conversationId: outside.id, role: "USER", content: `question de ${name}` } });

  return { user, project, library, owned, inProject, outside };
}

describe("ownership: a user sees nothing of another user's", () => {
  let a: Awaited<ReturnType<typeof seed>>;
  let b: Awaited<ReturnType<typeof seed>>;

  before(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    conversations = await import("@/lib/queries/conversation");
    projects = await import("@/lib/queries/project");
    documents = await import("@/lib/queries/document");
    scope = await import("@/lib/rag/retrieval/document-scope");
    providers = await import("@/lib/queries/aiProvider");
    runtime = await import("@/lib/pipeline/runtime");
    drive = await import("@/lib/google-drive/auth");
    encryption = await import("@/lib/encryption");
    documentMutations = await import("@/lib/mutations/document");

    a = await seed("alice");
    b = await seed("bob");
  });

  after(async () => {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  });

  it("same project name and same file for two users", () => {
    assert.equal(a.project.name, b.project.name);
    assert.equal(a.library.checksum, b.library.checksum);
  });

  it("sidebar and project list", async () => {
    const tree = await conversations.getSidebarTree(b.user.id);

    assert.deepEqual(tree.projects.map((project) => project.id), [b.project.id]);
    assert.deepEqual(tree.conversations.map((conversation) => conversation.id), [b.outside.id]);
    assert.deepEqual((await projects.getProjects(b.user.id)).map((project) => project.id), [b.project.id]);
  });

  it("another user's project or conversation by id is not found", async () => {
    assert.equal(await projects.getProjectWithConversations(a.project.id, b.user.id), null);
    assert.equal(await conversations.getConversationWithMessages(a.outside.id, b.user.id), null);
    assert.equal((await conversations.getConversationWithMessages(b.outside.id, b.user.id))?.messages[0]?.content, "question de bob");
  });

  it("documents page and project documents", async () => {
    assert.deepEqual((await documents.getAllDocuments(b.user.id)).map((document) => document.id).sort(), [b.library.id, b.owned.id].sort());

    // Asked for Alice's project, Bob gets none of Alice's documents (the page answers 404 anyway).
    const ofAlicesProject = await documents.getProjectDocuments(a.project.id, b.user.id);
    const alicesIds = [a.library.id, a.owned.id];
    assert.ok([...ofAlicesProject.owned, ...ofAlicesProject.selected, ...ofAlicesProject.library].every((document) => !alicesIds.includes(document.id)));

    // Bob's project can still select Bob's library, never Alice's.
    assert.deepEqual((await documents.getProjectDocuments(b.project.id, b.user.id)).library.map((document) => document.id), [b.library.id]);
  });

  it("the chat searches its owner's documents only", async () => {
    assert.deepEqual(await scope.getSearchableDocumentIds(b.outside.id), [b.library.id]);
    assert.deepEqual((await scope.getSearchableDocumentIds(b.inProject.id)).sort(), [b.library.id, b.owned.id].sort());

    await prisma.project.update({ where: { id: b.project.id }, data: { documentScope: "SELECTION" } });
    assert.deepEqual(await scope.getSearchableDocumentIds(b.inProject.id), [b.owned.id]);
    await prisma.project.update({ where: { id: b.project.id }, data: { documentScope: "ALL" } });

    assert.deepEqual(await scope.getSearchableDocumentIds("unknown"), []);
  });

  it("providers: the user's own and the shared Ollama local, which only the admin manages", async () => {
    const model = { name: "m", enabled: true };
    const shared = await prisma.aIProvider.create({
      data: { type: "OLLAMA_LOCAL", source: "LOCAL", name: "Ollama", configuration: {}, models: { create: model } },
    });
    const alices = await prisma.aIProvider.create({
      data: { userId: a.user.id, type: "ANTHROPIC", source: "REMOTE", name: "Anthropic", configuration: {}, models: { create: model } },
    });

    assert.deepEqual((await providers.getEnableProvidersWithModels(b.user.id)).map((provider) => provider.id), [shared.id]);
    assert.deepEqual((await providers.getEnableProvidersWithModels(a.user.id)).map((provider) => provider.id).sort(), [shared.id, alices.id].sort());

    const asUser = await providers.getProvidersWithModels({ id: b.user.id });
    const asAdmin = await providers.getProvidersWithModels({ id: b.user.id, role: "admin" });
    assert.deepEqual(asUser.map(({ id, manageable }) => ({ id, manageable })), [{ id: shared.id, manageable: false }]);
    assert.deepEqual(asAdmin.map(({ id, manageable }) => ({ id, manageable })), [{ id: shared.id, manageable: true }]);
  });

  it("pipeline: each user's own, on their providers or the shared Ollama only", async () => {
    const shared = await prisma.aIProvider.findFirstOrThrow({ where: { type: "OLLAMA_LOCAL" } });
    const alices = await prisma.aIProvider.findFirstOrThrow({ where: { userId: a.user.id } });

    // A new user starts from the default pipeline on the shared Ollama local.
    const bobs = (await runtime.pipelineRuntime.getConfig(b.user.id)).parameters;
    assert.equal(await prisma.pipelineParameters.count({ where: { userId: b.user.id } }), 1);

    const onAlicesProvider = { ...bobs, generation: { ...bobs.generation, providerId: alices.id, modelName: "m" } };
    await assert.rejects(runtime.pipelineRuntime.updateParameters(b.user.id, onAlicesProvider), /Fournisseur inconnu/);

    const onShared = { ...bobs, generation: { ...bobs.generation, providerId: shared.id, modelName: "m", temperature: 0.2 } };
    await runtime.pipelineRuntime.updateParameters(b.user.id, onShared);
    assert.equal((await runtime.pipelineRuntime.getConfig(b.user.id)).parameters.generation.temperature, 0.2);
    // Alice's pipeline is her own.
    assert.notEqual((await runtime.pipelineRuntime.getConfig(a.user.id)).parameters.generation.temperature, 0.2);
  });

  it("a reindex flag only touches the user's own documents", async () => {
    await documentMutations.flagIndexedDocumentsForReindex(b.user.id);

    assert.ok((await prisma.document.findMany({ where: { userId: b.user.id } })).every((document) => document.indexingStatus === "NEEDREINDEX"));
    assert.ok((await prisma.document.findMany({ where: { userId: a.user.id } })).every((document) => document.indexingStatus === "PROCESSED"));
  });

  it("Google Drive: each user's own connection and token", async () => {
    await prisma.googleDriveConnection.create({
      data: {
        userId: a.user.id, email: "alice@gmail.com", refreshToken: encryption.encryptToken("refresh-alice"),
        accessToken: encryption.encryptToken("access-alice"), expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    assert.equal((await drive.getGoogleDriveConnection(a.user.id))?.email, "alice@gmail.com");
    assert.equal(await drive.getGoogleDriveConnection(b.user.id), null);
    assert.equal(await drive.getGoogleDriveAccessToken(a.user.id), "access-alice");
    await assert.rejects(drive.getGoogleDriveAccessToken(b.user.id), drive.GoogleDriveAuthError);

    // Bob disconnecting leaves Alice's connection.
    await drive.disconnectGoogleDrive(b.user.id);
    assert.equal(await prisma.googleDriveConnection.count(), 1);
  });

  it("a project selection takes the user's own project and documents only", async () => {
    // Alice's document into Bob's project, and Bob's document into Alice's project: both ignored.
    await documentMutations.addToProjectSelection(b.user.id, b.project.id, [a.library.id]);
    await documentMutations.addToProjectSelection(b.user.id, a.project.id, [b.library.id]);
    assert.equal(await prisma.projectDocument.count(), 0);

    await documentMutations.addToProjectSelection(b.user.id, b.project.id, [b.library.id]);
    assert.deepEqual(await prisma.projectDocument.findMany({ select: { projectId: true, documentId: true } }), [
      { projectId: b.project.id, documentId: b.library.id },
    ]);
  });
});
