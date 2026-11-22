/**
 * Indexing throughput: imports the files of a folder for a test user, as the import does, and times the worker until
 * every document is indexed, sampling the CPU, the GPU (nvidia-smi) and, with --ping, how fast the app answers.
 * Deletes everything at the end, the embeddings it cached included: the next run embeds as much.
 *
 *   npm run bench:throughput -- --dir "C:\docs\bench" --label avant [--ping http://localhost:3000]
 *   npm run bench:throughput -- --compare
 *
 * Needs Redis, Qdrant and the indexing worker running (only one worker: stop `npm run dev`, start `npm run
 * start:worker` from the version to measure). The test user indexes with the first admin's pipeline and providers.
 * Results: bench-results/<label>.json.
 */
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { cpus } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { calculateFileChecksum } from "@/lib/documents/checksum";
import { getDocumentFormat } from "@/lib/documents/format";
import { importDocuments, type DocumentToImport } from "@/lib/documents/import";
import { deleteDocumentFile, storeDocumentFile } from "@/lib/documents/storage";
import { pipelineCapabilities } from "@/lib/pipeline/capabilities";
import { PipelineParametersSchema } from "@/lib/pipeline/parameters";
import { prisma } from "@/lib/prisma";
import { getIndexingQueue } from "@/lib/queue/indexing";
import { deleteChunksCollection } from "@/lib/qdrant/collections";
import { embeddingCacheKey } from "@/lib/rag/embedding/embedder";

const execFileAsync = promisify(execFile);
const RESULTS = "bench-results";
const EMAIL = "bench-throughput@example.com";
const TIMEOUT_MS = 2 * 60 * 60_000;

function argument(name: string): string | undefined {
    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1] : undefined;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const mean = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN);
const percentile = (values: number[], p: number) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * p)] ?? NaN;
const share = (values: number[], test: (value: number) => boolean) => (values.length ? values.filter(test).length / values.length : NaN);

type Result = {
    label: string;
    date: string;
    documents: number;
    failed: number;
    chunks: number;
    // Chunk texts already embedded before the run (the user's library): not embedded again.
    cachedBefore: number;
    seconds: number;
    cpu: { mean: number; idleShare: number };
    gpu: { mean: number; idleShare: number } | null;
    ping: { p50: number; p95: number } | null;
};

/** Busy share of every core since the previous call, 0 to 100. */
function cpuSampler() {
    const totals = () => cpus().reduce(
        (sum, cpu) => {
            const { idle, ...busy } = cpu.times;
            return { idle: sum.idle + idle, all: sum.all + idle + Object.values(busy).reduce((a, b) => a + b, 0) };
        },
        { idle: 0, all: 0 },
    );
    let previous = totals();

    return () => {
        const current = totals();
        const all = current.all - previous.all;
        const busy = all - (current.idle - previous.idle);
        previous = current;
        return all > 0 ? (busy / all) * 100 : 0;
    };
}

/** GPU utilization in percent, null without nvidia-smi. */
async function gpuUtilization(): Promise<number | null> {
    try {
        const { stdout } = await execFileAsync("nvidia-smi", ["--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"], { windowsHide: true });
        return Number(stdout.trim().split(/\r?\n/)[0]);
    } catch {
        return null;
    }
}

async function pingMs(url: string): Promise<number> {
    const start = performance.now();
    await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30_000) }).then((response) => response.arrayBuffer()).catch(() => undefined);
    return performance.now() - start;
}

/** The test user and everything of theirs, the embeddings cached since `since` included. Also what an interrupted run left. */
async function removeBenchUser(modelName: string | null, since: Date | null) {
    const user = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
    if (!user) return;

    const documents = await prisma.document.findMany({ where: { userId: user.id }, select: { storagePath: true, chunks: { select: { text: true } } } });

    if (modelName) {
        const keys = documents.flatMap((document) => document.chunks.map((chunk) => embeddingCacheKey(modelName, chunk.text)));
        for (let index = 0; index < keys.length; index += 500) {
            await prisma.embeddingCache.deleteMany({ where: { key: { in: keys.slice(index, index + 500) }, ...(since && { createdAt: { gte: since } }) } });
        }
    }

    await Promise.all(documents.map((document) => deleteDocumentFile(document.storagePath)));
    await deleteChunksCollection(user.id).catch(() => undefined);
    await prisma.document.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
}

async function compare() {
    const files = (await readdir(RESULTS).catch(() => [])).filter((name) => name.endsWith(".json"));
    const results: Result[] = await Promise.all(files.map(async (name) => JSON.parse(await readFile(path.join(RESULTS, name), "utf8"))));
    const percent = (value: number) => (Number.isNaN(value) ? "-" : `${Math.round(value)} %`);

    console.table(Object.fromEntries(results.sort((a, b) => a.date.localeCompare(b.date)).map((result) => [result.label, {
        documents: `${result.documents - result.failed}/${result.documents}`,
        chunks: result.chunks,
        durée: `${result.seconds.toFixed(0)} s`,
        "docs/min": ((result.documents - result.failed) / (result.seconds / 60)).toFixed(1),
        "CPU moyen": percent(result.cpu.mean),
        "CPU < 30 %": percent(result.cpu.idleShare * 100),
        "GPU moyen": result.gpu ? percent(result.gpu.mean) : "-",
        "GPU < 10 %": result.gpu ? percent(result.gpu.idleShare * 100) : "-",
        "app p95": result.ping ? `${Math.round(result.ping.p95)} ms` : "-",
    }])));
}

async function main() {
    if (process.argv.includes("--compare")) return compare();

    const dir = argument("dir");
    const label = argument("label");
    const pingUrl = argument("ping");
    if (!dir || !label) throw new Error('Usage: npm run bench:throughput -- --dir <dossier> --label <nom> [--ping http://localhost:3000]');

    // The first admin's pipeline, as in bench:indexing.
    const admin = await prisma.pipelineParameters.findFirstOrThrow({ where: { user: { role: "admin" } }, orderBy: { user: { createdAt: "asc" } } });
    const modelName = PipelineParametersSchema.parse(JSON.parse(admin.parameters)).embedding.modelName;

    await removeBenchUser(modelName, null);

    const paths = (await readdir(dir, { recursive: true, withFileTypes: true }))
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(entry.parentPath, entry.name));
    const files: (DocumentToImport & { data: Buffer })[] = [];
    const checksums = new Set<string>();

    for (const filePath of paths) {
        const format = getDocumentFormat(path.basename(filePath), "");
        if (!format || !pipelineCapabilities.import.supportedFormat.includes(format)) continue;

        const checksum = await calculateFileChecksum(filePath);
        if (checksums.has(checksum)) continue;
        checksums.add(checksum);

        const data = await readFile(filePath);
        const id = randomUUID();
        files.push({ id, storagePath: id, displayName: path.basename(filePath), format, checksum, fileSize: data.length, sourceType: "LOCAL", sourceRef: null, data });
    }

    if (files.length === 0) throw new Error(`Aucun fichier pris en charge dans ${dir}.`);

    const user = await prisma.user.create({ data: { id: randomUUID(), name: "Bench throughput", email: EMAIL, role: "user" } });
    await prisma.pipelineParameters.create({ data: { userId: user.id, parameters: admin.parameters } });
    for (const file of files) await storeDocumentFile(file.id, file.data);

    console.log(`${label}: ${files.length} documents (${(files.reduce((sum, file) => sum + file.fileSize, 0) / 1024 / 1024).toFixed(1)} Mo), ${cpus().length} cœurs.`);

    const startedAt = new Date();
    const start = performance.now();
    const { createdJobIds } = await importDocuments(user.id, files, new Map(), true);

    const sampleCpu = cpuSampler();
    const cpuSamples: number[] = [];
    const gpuSamples: number[] = [];
    const pingSamples: number[] = [];
    let jobs: { status: string; errorMessage: string | null }[] = [];

    for (;;) {
        await sleep(1000);
        cpuSamples.push(sampleCpu());
        const gpu = await gpuUtilization();
        if (gpu !== null) gpuSamples.push(gpu);
        if (pingUrl) pingSamples.push(await pingMs(pingUrl));

        jobs = await prisma.indexingJob.findMany({ where: { id: { in: createdJobIds } }, select: { status: true, errorMessage: true } });
        const done = jobs.filter((job) => ["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)).length;
        process.stdout.write(`\r  ${done}/${jobs.length} indexés · ${((performance.now() - start) / 1000).toFixed(0)} s · CPU ${Math.round(cpuSamples.at(-1)!)} %${gpu !== null ? ` · GPU ${gpu} %` : ""}   `);

        if (done === jobs.length) break;
        if (performance.now() - start > TIMEOUT_MS) throw new Error("Plus de 2 h : le worker tourne-t-il ?");
    }

    const seconds = (performance.now() - start) / 1000;
    const failed = jobs.filter((job) => job.status !== "COMPLETED");
    const chunks = await prisma.chunk.findMany({ where: { document: { userId: user.id } }, select: { text: true } });
    const keys = [...new Set(chunks.map((chunk) => embeddingCacheKey(modelName, chunk.text)))];
    let cachedBefore = 0;
    for (let index = 0; index < keys.length; index += 500) {
        cachedBefore += await prisma.embeddingCache.count({ where: { key: { in: keys.slice(index, index + 500) }, createdAt: { lt: startedAt } } });
    }

    const result: Result = {
        label,
        date: new Date().toISOString(),
        documents: jobs.length,
        failed: failed.length,
        chunks: chunks.length,
        cachedBefore,
        seconds,
        cpu: { mean: mean(cpuSamples), idleShare: share(cpuSamples, (value) => value < 30) },
        gpu: gpuSamples.length ? { mean: mean(gpuSamples), idleShare: share(gpuSamples, (value) => value < 10) } : null,
        ping: pingSamples.length ? { p50: percentile(pingSamples, 0.5), p95: percentile(pingSamples, 0.95) } : null,
    };

    console.log("\n");
    for (const message of new Set(failed.map((job) => job.errorMessage))) console.log(`  échec : ${message}`);
    if (cachedBefore > 0) console.log(`  ${cachedBefore} chunks déjà en cache avant le test (votre bibliothèque) : pas embeddés.`);

    await mkdir(RESULTS, { recursive: true });
    await writeFile(path.join(RESULTS, `${label}.json`), JSON.stringify(result, null, 2));

    console.log("Nettoyage…");
    await removeBenchUser(modelName, startedAt);
    await compare();
}

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    // The connections opened (queue, Qdrant, keep-alive) would keep the script running.
    .finally(async () => {
        await Promise.allSettled([prisma.$disconnect(), getIndexingQueue().close()]);
        process.exit();
    });
