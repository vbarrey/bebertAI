import { isPermanentDriveError } from "@/lib/google-drive/client";

/**
 * The document's chunks were made with the pipeline's extraction and chunking: only their embedding is redone. A
 * change of embedding model (or of BM25) costs the embedding alone, without the file nor the OCR.
 */
export function reusesChunks(document: { chunkedWith: string | null }, chunkCount: number, signature: string): boolean {
    return chunkCount > 0 && document.chunkedWith === signature;
}

/**
 * The file cannot be read any more (Drive account disconnected, file deleted or no longer shared): the chunks the
 * document already has are embedded again rather than leaving it out of the search.
 */
export function keepsChunksWithoutFile(chunkCount: number, error: unknown): boolean {
    return chunkCount > 0 && isPermanentDriveError(error);
}

export const KEPT_CHUNKS_WARNING =
    "Fichier Google Drive inaccessible : le document garde son ancien découpage, seul son embedding a été refait. " +
    "Reconnectez le compte Drive d'origine puis réindexez-le pour appliquer le nouveau découpage.";
