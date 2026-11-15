/**
 * Writes the .bebert bundle of an export job (src/lib/bundle/format.ts): run by the worker, the job row tells the
 * progress. Streamed document by document: a big corpus never sits in memory.
 */
import { once } from "node:events";
import { copyFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { createWriteStream, type WriteStream } from "node:fs";
import path from "node:path";
import { JobStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { qdrant } from "@/lib/qdrant/client";
import { chunksCollection } from "@/lib/qdrant/collections";
import { getQdrantPointId } from "@/lib/qdrant/ids";
import { getPipelineConfig } from "@/lib/pipeline/runtime";
import { getPipelineProvider } from "@/lib/pipeline/config";
import { embeddingQueryText } from "@/lib/rag/embedding/embedder";
import { getDocumentFilePath, withDocumentFile } from "@/lib/documents/storage";
import { userErrorMessage } from "@/lib/ai/chat/error-message";

import { packBundle, sha256File } from "./archive";
import {
    BUNDLE_EXTENSION,
    BUNDLE_FORMAT_VERSION,
    bundleFilePath,
    CANARY_FILE,
    CHUNKS_FILE,
    DOCUMENTS_FILE,
    MANIFEST_FILE,
    VECTORS_FILE,
    vectorBytes,
    type BundleManifest,
    type ChunkLine,
    type DocumentLine,
} from "./format";
import { CANARY_TEXTS } from "./canary";
import { ExportParametersSchema, exportedWhere } from "./selection";

// Points asked to Qdrant at once.
const RETRIEVE_BATCH = 256;

const APP_VERSION = process.env.npm_package_version ?? "unknown";

export type ExportResult = {
    documents: number;
    chunks: number;
    files: number;
    // Drive documents asked with their file whose download failed: exported with their link only.
    driveDownloadFailures: string[];
};

async function write(stream: WriteStream, data: string | Buffer) {
    if (!stream.write(data)) await once(stream, "drain");
}

async function close(stream: WriteStream) {
    stream.end();
    await once(stream, "finish");
}

/** The dense vectors of the chunks, in their order, from the owner's collection. */
async function chunkVectors(userId: string, chunkIds: string[]): Promise<number[][]> {
    const vectors: number[][] = [];

    for (let start = 0; start < chunkIds.length; start += RETRIEVE_BATCH) {
        const ids = chunkIds.slice(start, start + RETRIEVE_BATCH).map(getQdrantPointId);
        const points = await qdrant.retrieve(chunksCollection(userId), { ids, with_vector: [""], with_payload: false });
        const byId = new Map(points.map((point) => [String(point.id), point.vector]));

        for (const id of ids) {
            const vector = byId.get(id);
            // The unnamed dense vector, alone or under its empty name.
            const dense = Array.isArray(vector) ? vector : (vector as Record<string, unknown> | undefined)?.[""];
            if (!Array.isArray(dense) || typeof dense[0] !== "number") {
                throw new Error("Des vecteurs manquent dans Qdrant pour un document indexé : réindexez-le avant de l'exporter.");
            }
            vectors.push(dense as number[]);
        }
    }

    return vectors;
}

export function exportArchivePath(jobId: string): string {
    return path.join(/*turbopackIgnore: true*/ env.BUNDLES_PATH, `${jobId}${BUNDLE_EXTENSION}`);
}

/** Runs the export job: writes its bundle, then marks it completed with its file, or failed with the reason. */
export async function runExportJob(jobId: string): Promise<void> {
    const job = await prisma.bundleJob.findUniqueOrThrow({ where: { id: jobId } });
    const { selection, files } = ExportParametersSchema.parse(job.parameters);
    const directory = path.join(/*turbopackIgnore: true*/ env.BUNDLES_PATH, jobId);
    const archive = exportArchivePath(jobId);

    await prisma.bundleJob.update({ where: { id: jobId }, data: { status: JobStatus.RUNNING } });

    try {
        await rm(directory, { recursive: true, force: true });
        await mkdir(path.join(directory, "files"), { recursive: true });

        const { parameters } = await getPipelineConfig(job.userId);
        const provider = await getPipelineProvider(parameters.embedding, "embedding");

        // Embedded first: a provider out of reach stops the export before the long part.
        const canaryVectors = await provider.embed({
            model: parameters.embedding.modelName,
            input: CANARY_TEXTS.map((text) => embeddingQueryText(parameters.embedding.modelName, text)),
            inputType: "query",
        });
        await writeFile(path.join(directory, CANARY_FILE), JSON.stringify({ texts: CANARY_TEXTS, vectors: canaryVectors }));

        const documents = await prisma.document.findMany({ where: exportedWhere(job.userId, selection), orderBy: { createdAt: "asc" } });
        const documentLines = createWriteStream(path.join(directory, DOCUMENTS_FILE));
        const chunkLines = createWriteStream(path.join(directory, CHUNKS_FILE));
        const vectors = createWriteStream(path.join(directory, VECTORS_FILE));

        const result: ExportResult = { documents: documents.length, chunks: 0, files: 0, driveDownloadFailures: [] };
        const includedFiles: string[] = [];
        const driveAccounts = new Map<string, number>();
        const dimension = canaryVectors[0]!.length;

        for (const [index, document] of documents.entries()) {
            let file: string | null = null;

            if (document.sourceType === "LOCAL") {
                if (!document.storagePath) throw new Error(`« ${document.displayName} » n'a pas de fichier : impossible de l'exporter.`);
                await copyFile(getDocumentFilePath(document.storagePath), path.join(directory, bundleFilePath(document.checksum))).catch(() => {
                    throw new Error(`Le fichier de « ${document.displayName} » est introuvable sur le disque : impossible de l'exporter.`);
                });
                file = bundleFilePath(document.checksum);
            } else if (files === "local+drive") {
                try {
                    await withDocumentFile(document, (filePath) => copyFile(filePath, path.join(directory, bundleFilePath(document.checksum))));
                    file = bundleFilePath(document.checksum);
                } catch {
                    result.driveDownloadFailures.push(document.displayName);
                }
            }
            if (file) includedFiles.push(file);

            // Opened through the link: the account to connect is told on import.
            if (!file && document.driveAccountEmail) {
                driveAccounts.set(document.driveAccountEmail, (driveAccounts.get(document.driveAccountEmail) ?? 0) + 1);
            }

            const line: DocumentLine = {
                checksum: document.checksum,
                displayName: document.displayName,
                format: document.format as DocumentLine["format"],
                fileSize: document.fileSize,
                language: document.language,
                sourceType: document.sourceType as DocumentLine["sourceType"],
                sourceRef: document.sourceRef,
                driveAccount: document.driveAccountEmail,
                file,
            };
            await write(documentLines, JSON.stringify(line) + "\n");

            const chunks = await prisma.chunk.findMany({ where: { documentId: document.id }, orderBy: { position: "asc" } });
            const chunkVectorsOfDocument = await chunkVectors(job.userId, chunks.map(({ id }) => id));

            for (const [chunkIndex, chunk] of chunks.entries()) {
                const vector = chunkVectorsOfDocument[chunkIndex]!;
                if (vector.length !== dimension) {
                    throw new Error(`« ${document.displayName} » a des vecteurs de dimension ${vector.length}, le modèle actuel ${dimension} : réindexez-le.`);
                }
                const { position, text, pageNumber, language, x, y, width, height } = chunk;
                const chunkLine: ChunkLine = { document: document.checksum, position, text, pageNumber, language, x, y, width, height };
                await write(chunkLines, JSON.stringify(chunkLine) + "\n");
                await write(vectors, vectorBytes(vector));
            }
            result.chunks += chunks.length;

            const progress = Math.round(((index + 1) / documents.length) * 90);
            if (progress !== job.progress) {
                job.progress = progress;
                await prisma.bundleJob.update({ where: { id: jobId }, data: { progress } });
            }
        }

        await Promise.all([close(documentLines), close(chunkLines), close(vectors)]);
        result.files = includedFiles.length;

        const sha256: Record<string, string> = {};
        for (const name of [CANARY_FILE, DOCUMENTS_FILE, CHUNKS_FILE, VECTORS_FILE, ...includedFiles]) {
            sha256[name] = await sha256File(path.join(directory, name));
        }

        const manifest: BundleManifest = {
            formatVersion: BUNDLE_FORMAT_VERSION,
            appVersion: APP_VERSION,
            exportedAt: new Date().toISOString(),
            selection: { kind: selection.kind, label: job.label },
            filesIncluded: files,
            counts: { documents: result.documents, chunks: result.chunks, files: result.files },
            embedding: { providerType: (await prisma.aIProvider.findUniqueOrThrow({ where: { id: parameters.embedding.providerId } })).type, model: parameters.embedding.modelName, dimension },
            sparse: parameters.embedding.sparse,
            chunking: parameters.chunking,
            driveAccounts: [...driveAccounts].map(([email, count]) => ({ email, documents: count })),
            sha256,
        };
        await writeFile(path.join(directory, MANIFEST_FILE), JSON.stringify(manifest, null, 2));

        await packBundle(directory, archive);
        const { size } = await stat(archive);

        await prisma.bundleJob.update({
            where: { id: jobId },
            data: { status: JobStatus.COMPLETED, progress: 100, filePath: archive, fileSize: size, result, finishedAt: new Date() },
        });
    } catch (error) {
        await rm(archive, { force: true });
        await prisma.bundleJob.update({
            where: { id: jobId },
            data: { status: JobStatus.FAILED, errorMessage: error instanceof Error ? userErrorMessage(error) : String(error), finishedAt: new Date() },
        });
        throw error;
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}
