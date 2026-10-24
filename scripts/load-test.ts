/**
 * Load test: users chatting at the same time while another one imports and indexes documents, and a user importing
 * one document right after that big import (does it wait for all of them?). Creates its own users, deletes
 * everything at the end. Needs the app and the indexing worker running.
 *
 * npm run bench:load -- [--url http://localhost:3000] [--users 5] [--documents 20] [--questions 2]
 * Run it with the BETTER_AUTH_SECRET of the app: the sessions it opens are signed with it.
 */
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteChunksCollection } from "@/lib/qdrant/collections";
import { deleteDocumentFile } from "@/lib/documents/storage";

function argument(name: string, fallback: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1]! : fallback;
}

const BASE = argument("url", "http://localhost:3000");
const USERS = Number(argument("users", "5"));
const DOCUMENTS = Number(argument("documents", "20"));
const QUESTIONS = Number(argument("questions", "2"));
const PASSWORD = "load-test-password-1";
const EMAIL = (name: string) => `load-${name}@example.com`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

async function createUser(name: string) {
  await auth.api.createUser({ body: { email: EMAIL(name), password: PASSWORD, name: `Load ${name}`, role: "user" } });
  // Signed in on the server: through HTTP, the sign-in rate limit (3 per 10 s in production) would refuse most users.
  const response = await auth.api.signInEmail({ body: { email: EMAIL(name), password: PASSWORD }, asResponse: true });
  const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL(name) } });
  return { id: user.id, cookie: response.headers.get("set-cookie")!.split(";")[0]! };
}

// Each run its own texts: the embedding cache would skip the embedding model for texts already seen.
const RUN = Date.now().toString(36);

// A few paragraphs of its own: every document has its own checksum and several chunks.
function documentText(owner: string, index: number) {
  return Array.from({ length: 12 }, (_, paragraph) =>
    `Run ${RUN}, document ${index} de ${owner}, paragraphe ${paragraph}. La procédure ${index}-${paragraph} décrit le contrôle du ` +
    `matériel, la vérification des pièces et l'archivage du rapport dans le registre ${index * 100 + paragraph}.`,
  ).join("\n\n");
}

async function importDocuments(cookie: string, owner: string, from: number, count: number): Promise<string[]> {
  const form = new FormData();
  for (let index = from; index < from + count; index++) {
    form.append("files", new Blob([documentText(owner, index)], { type: "text/plain" }), `${owner}-${index}.txt`);
  }
  form.append("indexImmediately", "true");

  const response = await fetch(`${BASE}/api/documents/import`, { method: "POST", body: form, headers: { cookie } });
  const body = await response.json();
  if (!response.ok) throw new Error(`Import ${response.status}: ${JSON.stringify(body)}`);
  return body.importedDocuments.map((document: { id: string }) => document.id);
}

type ChatResult = { firstContent: number | null; total: number; error: string | null };

async function chat(cookie: string, conversationId: string, message: string): Promise<ChatResult> {
  const start = Date.now();
  let firstContent: number | null = null;
  let error: string | null = null;

  try {
    const response = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, message }),
    });
    if (!response.ok || !response.body) return { firstContent, total: Date.now() - start, error: `HTTP ${response.status}` };

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines.filter(Boolean)) {
        const event = JSON.parse(line);
        if (event.type === "content" && firstContent === null) firstContent = Date.now() - start;
        if (event.type === "error") error = event.message;
      }
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }

  return { firstContent, total: Date.now() - start, error };
}

const LOAD_USERS = { email: { startsWith: "load-", endsWith: "@example.com" } };

/** The test users and everything of theirs: stored files, Qdrant collections, rows. Also what an interrupted run left. */
async function removeLoadUsers() {
  for (const user of await prisma.user.findMany({ where: LOAD_USERS, select: { id: true } })) {
    const documents = await prisma.document.findMany({ where: { userId: user.id }, select: { storagePath: true } });
    await Promise.all(documents.map((document) => deleteDocumentFile(document.storagePath)));
    await deleteChunksCollection(user.id);
  }
  await prisma.conversation.deleteMany({ where: { user: LOAD_USERS } });
  await prisma.document.deleteMany({ where: { user: LOAD_USERS } });
  await prisma.user.deleteMany({ where: LOAD_USERS });
}

async function main() {
  await removeLoadUsers();

  console.log(`Load test on ${BASE}: ${USERS} users chatting (${QUESTIONS} questions each), ${DOCUMENTS} documents indexed meanwhile.\n`);

  const importer = await createUser("importer");
  const chatters = await Promise.all(Array.from({ length: USERS }, (_, index) => createUser(`chat-${index}`)));
  const latecomer = chatters[0]!;
  const conversations = await Promise.all(
    chatters.map((user) => prisma.conversation.create({ data: { userId: user.id }, select: { id: true } })),
  );

  const start = Date.now();
  const bigImport = await importDocuments(importer.cookie, "importer", 0, DOCUMENTS);
  // Right after the big import: is this one indexed after all of it?
  const [lateDocument] = await importDocuments(latecomer.cookie, "latecomer", 0, 1);
  console.log(`Imports queued in ${seconds(Date.now() - start)}.`);

  const chats = (await Promise.all(chatters.map(async (user, index) => {
    const results: ChatResult[] = [];
    for (let question = 0; question < QUESTIONS; question++) {
      results.push(await chat(user.cookie, conversations[index]!.id, `Question ${question} : résume en une phrase ce que tu sais faire.`));
    }
    return results;
  }))).flat();
  const chatsDone = Date.now();

  // Indexing done: every document processed or failed; the order the late document came in.
  const documents = [...bigImport, lateDocument!];
  let lateRank: number | null = null;
  for (;;) {
    const states = await prisma.document.findMany({ where: { id: { in: documents } }, select: { id: true, indexingStatus: true, indexedAt: true } });
    const done = states.filter((state) => state.indexingStatus === "PROCESSED" || state.indexingStatus === "FAILED");
    const late = states.find((state) => state.id === lateDocument);
    if (lateRank === null && late?.indexingStatus === "PROCESSED" && late.indexedAt) {
      lateRank = states.filter((state) => state.id !== lateDocument && state.indexedAt && state.indexedAt <= late.indexedAt!).length;
    }
    if (done.length === documents.length || Date.now() - start > 30 * 60_000) break;
    await sleep(2000);
  }
  const indexingDone = Date.now();

  const jobs = await prisma.indexingJob.findMany({ where: { documentId: { in: documents } }, select: { status: true, errorMessage: true } });
  const failedJobs = jobs.filter((job) => job.status === "FAILED");
  const answered = chats.filter((result) => !result.error && result.firstContent !== null);
  const errors = chats.filter((result) => result.error);
  const locked = [...errors.map((result) => result.error!), ...failedJobs.map((job) => job.errorMessage ?? "")]
    .filter((message) => /SQLITE_BUSY|database is locked|timed out/i.test(message));

  console.log(`\nChat: ${answered.length}/${chats.length} answered, ${errors.length} errors, all done in ${seconds(chatsDone - start)}`);
  console.log(`  first content: median ${seconds(median(answered.map((r) => r.firstContent!)))}, max ${seconds(Math.max(0, ...answered.map((r) => r.firstContent!)))}`);
  console.log(`  full answer:   median ${seconds(median(answered.map((r) => r.total)))}, max ${seconds(Math.max(0, ...answered.map((r) => r.total)))}`);
  for (const message of [...new Set(errors.map((result) => result.error))]) console.log(`  error: ${message}`);
  console.log(`Indexing: ${documents.length - failedJobs.length}/${documents.length} processed in ${seconds(indexingDone - start)}, ${failedJobs.length} failed`);
  for (const message of [...new Set(failedJobs.map((job) => job.errorMessage))]) console.log(`  failure: ${message}`);
  console.log(`  late single document indexed after ${lateRank ?? "?"} of the ${DOCUMENTS} big-import documents`);
  console.log(`Database locked errors: ${locked.length}`);

  console.log("\nCleaning up...");
  await removeLoadUsers();
  console.log("Done.");
}

main().catch((error) => console.error(error)).finally(() => prisma.$disconnect());
