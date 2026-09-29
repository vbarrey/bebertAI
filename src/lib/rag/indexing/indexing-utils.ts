import { ExtractedBlock } from "../types";
import path from "node:path";
import type { Document } from "@prisma/client";
import os from "node:os";

export function getDocumentPath(
    document: Document
): string {
    return path.join(
        os.tmpdir(),
        process.env["TMP_FILE_REPO"] ?? "bebert-ai-file-repo",
        document.filename,
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