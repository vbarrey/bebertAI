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