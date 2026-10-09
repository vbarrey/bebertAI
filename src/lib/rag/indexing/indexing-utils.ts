import type { Document } from "@prisma/client";

import { ExtractedBlock } from "../types";
import { getDocumentFilePath } from "@/lib/documents/storage";

export function getDocumentPath(
    document: Document,
): string {
    if (!document.storagePath) {
        throw new Error(
            `Document ${document.id} has no storage path.`,
        );
    }

    return getDocumentFilePath(
        document.storagePath,
    );
}

export function splitTextIntoBlocks(
    text: string,
): ExtractedBlock[] {
    return text
        .split(/\r?\n\s*\r?\n/)
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text) => ({
            text,
        }));
}
// Text metadata read from an image file, as [label, value].
export type ImageMetadata = [label: string, value: string][];

/**
 * Images are indexed from their name and human-written metadata only (no OCR, no vision):
 * a single block that the chunker and the embedder handle like any text.
 */
export function buildImageBlocks(
    fileName: string,
    metadata: ImageMetadata,
): ExtractedBlock[] {
    const name = fileName
        .replace(/\.[^.]+$/, "")
        .replace(/[_\-.\s]+/g, " ")
        .trim();

    const lines = [`Image : ${name || fileName}`, `Fichier : ${fileName}`];
    const seen = new Set<string>();

    for (const [label, rawValue] of metadata) {
        const value = rawValue.replace(/\0/g, "").trim();

        // Windows copies the title into several fields.
        if (value && !seen.has(value)) {
            seen.add(value);
            lines.push(`${label} : ${value}`);
        }
    }

    return [{ text: lines.join("\n") }];
}
