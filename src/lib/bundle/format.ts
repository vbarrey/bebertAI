/**
 * The .bebert bundle: indexed documents moved from one BebertAI to another (a machine indexing with Ollama, the web
 * instance searching with DeepInfra), or from one user to another. A gzipped tar of:
 *
 *   manifest.json     what the bundle holds and how it was embedded (BundleManifestSchema), sha256 of the others
 *   canary.json       queries and their vectors: the importing side embeds them again to compare (CanarySchema)
 *   documents.ndjson  one document per line (DocumentLineSchema)
 *   chunks.ndjson     one chunk per line, grouped by document (ChunkLineSchema)
 *   vectors.f32       the dense vector of each chunk line, in the same order: float32 little-endian, dimension floats
 *   files/<sha256>    the original files, named by their checksum
 *
 * Nothing derived: the BM25 vectors are computed again by Qdrant from the texts, the ids are new on import.
 * Everything read from a bundle is untrusted: the names are a fixed list, every line goes through these schemas.
 */
import { z } from "zod";

import { DocumentFormatSchema } from "@/lib/documents/format";

export const BUNDLE_FORMAT_VERSION = 1;
export const BUNDLE_EXTENSION = ".bebert";

export const MANIFEST_FILE = "manifest.json";
export const CANARY_FILE = "canary.json";
export const DOCUMENTS_FILE = "documents.ndjson";
export const CHUNKS_FILE = "chunks.ndjson";
export const VECTORS_FILE = "vectors.f32";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

/** The archive path of an original file. */
export function bundleFilePath(checksum: string): string {
    return `files/${checksum}`;
}

/** The only names a bundle may hold: anything else is refused before being written anywhere. */
export function isBundleEntryName(name: string): boolean {
    return [MANIFEST_FILE, CANARY_FILE, DOCUMENTS_FILE, CHUNKS_FILE, VECTORS_FILE].includes(name)
        || /^files\/[a-f0-9]{64}$/.test(name);
}

export const BundleManifestSchema = z.object({
    formatVersion: z.literal(BUNDLE_FORMAT_VERSION),
    appVersion: z.string(),
    exportedAt: z.iso.datetime(),
    // What was chosen in the export dialog, to show on import.
    selection: z.object({
        kind: z.enum(["documents", "library", "project", "all"]),
        label: z.string().max(200),
    }),
    // local: the files of the local documents; local+drive: the Drive files too, downloaded at the export.
    filesIncluded: z.enum(["local", "local+drive"]),
    counts: z.object({
        documents: z.number().int().nonnegative(),
        chunks: z.number().int().nonnegative(),
        files: z.number().int().nonnegative(),
    }),
    // The pipeline of the exporting user. The canaries, not these names, decide whether the vectors fit.
    embedding: z.object({
        providerType: z.string(),
        model: z.string(),
        dimension: z.number().int().positive().max(16384),
    }),
    sparse: z.object({ k: z.number().positive(), b: z.number().min(0).max(1), asciiFolding: z.boolean() }),
    chunking: z.object({ chunkSize: z.number().int().positive(), chunkOverlap: z.number().int().nonnegative() }),
    // The Google accounts of the Drive documents without their file: the one to connect to open them.
    driveAccounts: z.array(z.object({ email: z.string(), documents: z.number().int().positive() })),
    // Of every other entry, manifest excluded.
    sha256: z.record(z.string().refine(isBundleEntryName), Sha256Schema),
});

export type BundleManifest = z.infer<typeof BundleManifestSchema>;

export const CanarySchema = z.object({
    texts: z.array(z.string().min(1)).min(1).max(100),
    // Embedded as queries (embeddingQueryText), in the order of the texts.
    vectors: z.array(z.array(z.number())),
}).refine(({ texts, vectors }) => texts.length === vectors.length, { message: "Un vecteur par texte canari." });

export type Canary = z.infer<typeof CanarySchema>;

export const DocumentLineSchema = z.object({
    // Its identity: a document already known to the importing user (same checksum) is skipped.
    checksum: Sha256Schema,
    displayName: z.string().min(1).max(500),
    format: DocumentFormatSchema,
    fileSize: z.number().int().nonnegative().nullable(),
    language: z.string().max(50).nullable(),
    sourceType: z.enum(["LOCAL", "GOOGLE_DRIVE"]),
    // The Drive file id.
    sourceRef: z.string().max(200).nullable(),
    driveAccount: z.string().max(320).nullable(),
    // Its original file in the bundle, files/<checksum>; null for a Drive document exported without its file.
    file: z.string().refine((path) => /^files\/[a-f0-9]{64}$/.test(path)).nullable(),
}).refine(
    // Local documents always come with their file: there is nowhere else to get it from.
    (document) => document.sourceType === "GOOGLE_DRIVE" ? document.file !== null || document.sourceRef !== null : document.file !== null,
    { message: "Document sans fichier ni lien Drive." },
);

export type DocumentLine = z.infer<typeof DocumentLineSchema>;

const Coordinate = z.number().finite().nullable();

export const ChunkLineSchema = z.object({
    // The checksum of its document.
    document: Sha256Schema,
    position: z.number().int().nonnegative(),
    text: z.string(),
    pageNumber: z.number().int().nullable(),
    language: z.string().max(50).nullable(),
    x: Coordinate,
    y: Coordinate,
    width: Coordinate,
    height: Coordinate,
});

export type ChunkLine = z.infer<typeof ChunkLineSchema>;

/** One vector as stored in vectors.f32. */
export function vectorBytes(vector: number[]): Buffer {
    const bytes = Buffer.alloc(vector.length * 4);
    vector.forEach((value, index) => bytes.writeFloatLE(value, index * 4));
    return bytes;
}
