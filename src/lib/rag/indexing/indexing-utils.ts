import { ExtractedBlock } from "./types";
import path from "node:path";
import type { Document, SourceFolder } from "@prisma/client";

export function getDocumentPath(
    document: Document & { sourceFolder: SourceFolder },
): string {
    return path.join(
        document.sourceFolder.path,
        document.relativePath,
    );
}

export function splitTextIntoBlocks(text: string): ExtractedBlock[] {
    return text
        .split(/\r?\n\s*\r?\n/)
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text) => ({
            text,
        }));
}