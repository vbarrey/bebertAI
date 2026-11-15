/**
 * Imports a .bebert bundle (src/lib/bundle/format.ts) into the library of the job's user: run by the worker.
 *
 * Everything is checked before the first write: the archive (names, sizes, sha256), every line, the order of the
 * chunks and the size of the vectors, then the canaries, embedded again with the user's own model. Then document by
 * document: database first, Qdrant next, the document marked indexed last. A document whose checksum the user
 * already has is skipped: importing the same bundle twice changes nothing, an import cut short is finished by running
 * it again.
 */
import { createReadStream } from "node:fs";
import { copyFile, open, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import { IndexingStatus, JobStatus, type Chunk } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { getPipelineConfig } from "@/lib/pipeline/runtime";
import { getPipelineProvider } from "@/lib/pipeline/config";
import { BM25_LANGUAGES, chunkingSignature, type PipelineParameters } from "@/lib/pipeline/parameters";
import { embeddingQueryText } from "@/lib/rag/embedding/embedder";
import { ensureChunksCollection } from "@/lib/qdrant/collections";
import { deleteDocumentEmbeddings, upsertChunkEmbeddings } from "@/lib/qdrant/points";
import { ensureDocumentStorage, getDocumentFilePath, deleteDocumentFile } from "@/lib/documents/storage";
import { userErrorMessage } from "@/lib/ai/chat/error-message";

import { BundleError, unpackBundle, verifyBundle } from "./archive";
import { CANARY_MIN_COSINE } from "./canary";
import {
    bundleFilePath,
    CANARY_FILE,
    CanarySchema,
    ChunkLineSchema,
    CHUNKS_FILE,
    DocumentLineSchema,
    DOCUMENTS_FILE,
    VECTORS_FILE,
    type BundleManifest,
    type Canary,
    type ChunkLine,
    type DocumentLine,
} from "./format";
import { MAX_BUNDLE_ENTRIES, MAX_BUNDLE_UNPACKED_SIZE } from "./limits";

// Points sent to Qdrant at once.
const UPSERT_BATCH = 128;

export type ImportResult = {
    imported: number;
    // Already in the user's documents (same checksum).
    skipped: number;
    failed: { name: string; error: string }[];
    chunks: number;
    // Imported without their file: opened and reindexed through Google Drive.
    driveAccounts: { email: string; documents: number; connected: boolean }[];
    warnings: string[];
};

function cosine(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i]! * b[i]!;
        normA += a[i]! * a[i]!;
        normB += b[i]! * b[i]!;
    }
    return dot / Math.sqrt(normA * normB);
}

/** The lowest cosine between the bundle's canary vectors and the ones of the importing model; 0 when they cannot match. */
export function canaryAgreement(expected: number[][], actual: number[][]): number {
    if (expected.length !== actual.length) return 0;
    return Math.min(...expected.map((vector, index) => vector.length === actual[index]!.length ? cosine(vector, actual[index]!) : 0));
}

async function* lines(file: string): AsyncGenerator<string> {
    for await (const line of createInterface({ input: createReadStream(file), crlfDelay: Infinity })) {
        if (line.trim()) yield line;
    }
}

function parseLine<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, line: string, where: string): T {
    let json: unknown;
    try {
        json = JSON.parse(line);
    } catch {
        throw new BundleError(`${where} : ligne illisible.`);
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new BundleError(`${where} : ligne invalide.`);
    return parsed.data;
}

/** Every document line, checked against the manifest and its files. */
async function readDocuments(directory: string, manifest: BundleManifest): Promise<DocumentLine[]> {
    const documents: DocumentLine[] = [];
    const checksums = new Set<string>();

    for await (const line of lines(path.join(directory, DOCUMENTS_FILE))) {
        const document = parseLine(DocumentLineSchema, line, `Document ${documents.length + 1}`);
        if (checksums.has(document.checksum)) throw new BundleError(`Document en double dans le paquet : ${document.displayName}`);
        // Its file must be the one the checksum names: a file cannot pass for another document.
        if (document.file && (document.file !== bundleFilePath(document.checksum) || manifest.sha256[document.file] !== document.checksum)) {
            throw new BundleError(`Le fichier de « ${document.displayName} » ne correspond pas à son empreinte.`);
        }
        checksums.add(document.checksum);
        documents.push(document);
    }

    if (documents.length !== manifest.counts.documents) {
        throw new BundleError(`Le paquet annonce ${manifest.counts.documents} documents et en contient ${documents.length}.`);
    }
    return documents;
}

/** Checks that the chunks come grouped by document, in the order of the documents, as many as announced. */
async function checkChunks(directory: string, manifest: BundleManifest, documents: DocumentLine[]): Promise<void> {
    const order = new Map(documents.map((document, index) => [document.checksum, index]));
    let current = -1;
    let count = 0;

    for await (const line of lines(path.join(directory, CHUNKS_FILE))) {
        const chunk = parseLine(ChunkLineSchema, line, `Chunk ${count + 1}`);
        const index = order.get(chunk.document);
        if (index === undefined) throw new BundleError(`Chunk ${count + 1} : document inconnu du paquet.`);
        if (index < current) throw new BundleError(`Chunk ${count + 1} : les chunks ne sont pas groupés par document.`);
        current = index;
        count++;
    }

    if (count !== manifest.counts.chunks) {
        throw new BundleError(`Le paquet annonce ${manifest.counts.chunks} chunks et en contient ${count}.`);
    }
    const { size } = await stat(path.join(directory, VECTORS_FILE));
    if (size !== count * manifest.embedding.dimension * 4) {
        throw new BundleError("Le fichier des vecteurs n'a pas la taille attendue pour ces chunks.");
    }
}

/** The chunks of each document in turn, each with its vector read alongside. */
async function* documentChunks(directory: string, dimension: number): AsyncGenerator<{ checksum: string; chunks: { line: ChunkLine; vector: number[] }[] }> {
    const vectors = await open(path.join(directory, VECTORS_FILE));
    const buffer = Buffer.alloc(dimension * 4);
    let position = 0;
    let group: { checksum: string; chunks: { line: ChunkLine; vector: number[] }[] } | null = null;

    try {
        for await (const text of lines(path.join(directory, CHUNKS_FILE))) {
            const line = ChunkLineSchema.parse(JSON.parse(text));
            await vectors.read(buffer, 0, buffer.length, position);
            position += buffer.length;
            const vector = Array.from({ length: dimension }, (_, i) => buffer.readFloatLE(i * 4));

            if (group && group.checksum !== line.document) {
                yield group;
                group = null;
            }
            group ??= { checksum: line.document, chunks: [] };
            group.chunks.push({ line, vector });
        }
        if (group) yield group;
    } finally {
        await vectors.close();
    }
}

/** Stops the import when the user's model does not give the bundle's vectors: its searches would find nothing. */
async function checkCanaries(canary: Canary, manifest: BundleManifest, parameters: PipelineParameters): Promise<void> {
    const { embedding } = parameters;
    const provider = await getPipelineProvider(embedding, "embedding");
    const actual = await provider.embed({
        model: embedding.modelName,
        input: canary.texts.map((text) => embeddingQueryText(embedding.modelName, text)),
        inputType: "query",
    });
    const agreement = canaryAgreement(canary.vectors, actual);

    if (agreement < CANARY_MIN_COSINE) {
        throw new BundleError(
            `Ce paquet a été encodé avec le modèle « ${manifest.embedding.model} » (${manifest.embedding.providerType}, dimension ` +
            `${manifest.embedding.dimension}) ; votre modèle d'embedding « ${embedding.modelName} » donne d'autres vecteurs ` +
            `(${actual[0]?.length ?? 0} dimensions, similarité ${agreement.toFixed(3)} sous ${CANARY_MIN_COSINE}). Choisissez un ` +
            `modèle équivalent dans Réglages > Pipeline, puis importez de nouveau.`,
        );
    }
}

function differences(manifest: BundleManifest, parameters: PipelineParameters): string[] {
    const warnings: string[] = [];
    const { chunkSize, chunkOverlap } = parameters.chunking;
    if (manifest.chunking.chunkSize !== chunkSize || manifest.chunking.chunkOverlap !== chunkOverlap) {
        warnings.push(`Découpage différent du vôtre (${manifest.chunking.chunkSize}/${manifest.chunking.chunkOverlap} contre ${chunkSize}/${chunkOverlap}) : les documents importés gardent le leur.`);
    }
    return warnings;
}

/** Writes one document of the bundle; throws with the reason after undoing what it wrote. */
async function importDocument(
    userId: string,
    directory: string,
    document: DocumentLine,
    chunks: { line: ChunkLine; vector: number[] }[],
    parameters: PipelineParameters,
    // How the bundle's chunks were made (chunkingSignature).
    chunkedWith: string,
): Promise<void> {
    const id = randomUUID();
    const storagePath = document.file ? id : null;

    try {
        if (document.file) {
            await ensureDocumentStorage();
            await copyFile(path.join(directory, document.file), getDocumentFilePath(id));
        }

        // Its file in the bundle: a document of this server now, whatever its source was.
        const fromDrive = !document.file && document.sourceType === "GOOGLE_DRIVE";
        const rows: Chunk[] = chunks.map(({ line }) => ({
            id: randomUUID(),
            documentId: id,
            position: line.position,
            text: line.text,
            pageNumber: line.pageNumber,
            // Only a known BM25 language: Qdrant refuses another one.
            language: BM25_LANGUAGES.includes(line.language as never) ? line.language : null,
            x: line.x,
            y: line.y,
            width: line.width,
            height: line.height,
        }));

        await prisma.$transaction(async (tx) => {
            await tx.document.create({
                data: {
                    id,
                    userId,
                    displayName: document.displayName,
                    format: document.format,
                    fileSize: document.fileSize,
                    checksum: document.checksum,
                    language: document.language,
                    sourceType: fromDrive ? "GOOGLE_DRIVE" : "LOCAL",
                    sourceRef: fromDrive ? document.sourceRef : null,
                    driveAccountEmail: document.driveAccount,
                    storagePath,
                    chunkedWith,
                    // Out of the searches until its vectors are in Qdrant.
                    indexingStatus: IndexingStatus.PROCESSING,
                },
            });
            await tx.chunk.createMany({ data: rows });
        });

        for (let start = 0; start < rows.length; start += UPSERT_BATCH) {
            const batch = rows.slice(start, start + UPSERT_BATCH);
            await upsertChunkEmbeddings(
                userId,
                batch,
                batch.map((row, index) => ({ chunkId: row.id, documentId: id, embedding: chunks[start + index]!.vector })),
                parameters.embedding.sparse,
                parameters.chunking.chunkSize,
            );
        }

        await prisma.document.update({ where: { id }, data: { indexingStatus: IndexingStatus.PROCESSED, indexedAt: new Date() } });
    } catch (error) {
        await deleteDocumentEmbeddings(userId, id).catch(() => undefined);
        await prisma.document.deleteMany({ where: { id } });
        await deleteDocumentFile(storagePath);
        throw error;
    }
}

/** Runs the import job: marks it completed with what was imported, or failed with the reason. */
export async function runImportJob(jobId: string): Promise<void> {
    const job = await prisma.bundleJob.findUniqueOrThrow({ where: { id: jobId } });
    const directory = path.join(/*turbopackIgnore: true*/ env.BUNDLES_PATH, jobId);

    await prisma.bundleJob.update({ where: { id: jobId }, data: { status: JobStatus.RUNNING } });

    try {
        if (!job.filePath) throw new BundleError("Le paquet envoyé n'est plus sur le serveur : envoyez-le de nouveau.");

        await rm(directory, { recursive: true, force: true });
        await unpackBundle(job.filePath, directory, { maxBytes: MAX_BUNDLE_UNPACKED_SIZE, maxEntries: MAX_BUNDLE_ENTRIES });
        const manifest = await verifyBundle(directory);
        const documents = await readDocuments(directory, manifest);
        await checkChunks(directory, manifest, documents);
        const canary = parseLine(CanarySchema, await readFile(path.join(directory, CANARY_FILE), "utf8"), "Canaris");

        const { parameters } = await getPipelineConfig(job.userId);
        await checkCanaries(canary, manifest, parameters);
        await ensureChunksCollection(job.userId, manifest.embedding.dimension);

        const result: ImportResult = { imported: 0, skipped: 0, failed: [], chunks: 0, driveAccounts: [], warnings: differences(manifest, parameters) };
        const byChecksum = new Map(documents.map((document) => [document.checksum, document]));
        const chunkedWith = chunkingSignature(manifest);
        const known = new Set((await prisma.document.findMany({
            where: { userId: job.userId, checksum: { in: documents.map(({ checksum }) => checksum) } },
            select: { checksum: true },
        })).map(({ checksum }) => checksum));
        const driveAccounts = new Map<string, number>();
        let done = 0;

        const finish = async (document: DocumentLine, chunkCount: number, write: () => Promise<void>) => {
            if (known.has(document.checksum)) {
                result.skipped++;
            } else {
                try {
                    await write();
                    known.add(document.checksum);
                    result.imported++;
                    result.chunks += chunkCount;
                    if (!document.file && document.driveAccount) {
                        driveAccounts.set(document.driveAccount, (driveAccounts.get(document.driveAccount) ?? 0) + 1);
                    }
                } catch (error) {
                    result.failed.push({ name: document.displayName, error: error instanceof Error ? userErrorMessage(error) : String(error) });
                }
            }
            done += chunkCount;
            const progress = Math.round((done / Math.max(1, manifest.counts.chunks)) * 100);
            await prisma.bundleJob.update({ where: { id: jobId }, data: { progress } });
        };

        const withChunks = new Set<string>();
        for await (const { checksum, chunks } of documentChunks(directory, manifest.embedding.dimension)) {
            const document = byChecksum.get(checksum)!;
            withChunks.add(checksum);
            await finish(document, chunks.length, () => importDocument(job.userId, directory, document, chunks, parameters, chunkedWith));
        }
        // Indexed without any text (an empty page): imported too, with no chunk.
        for (const document of documents.filter(({ checksum }) => !withChunks.has(checksum))) {
            await finish(document, 0, () => importDocument(job.userId, directory, document, [], parameters, chunkedWith));
        }

        const connection = await prisma.googleDriveConnection.findUnique({ where: { userId: job.userId }, select: { email: true } });
        result.driveAccounts = [...driveAccounts].map(([email, count]) => ({ email, documents: count, connected: connection?.email === email }));

        await prisma.bundleJob.update({
            where: { id: jobId },
            data: { status: JobStatus.COMPLETED, progress: 100, result, finishedAt: new Date() },
        });
    } catch (error) {
        await prisma.bundleJob.update({
            where: { id: jobId },
            data: { status: JobStatus.FAILED, errorMessage: error instanceof Error ? userErrorMessage(error) : String(error), finishedAt: new Date() },
        });
        throw error;
    } finally {
        // The bundle is not kept: sent again, it is imported again (the documents already there skipped).
        await rm(directory, { recursive: true, force: true });
        if (job.filePath) await rm(job.filePath, { force: true });
        await prisma.bundleJob.update({ where: { id: jobId }, data: { filePath: null } });
    }
}
