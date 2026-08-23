import { ChunkingConfiguration, DocumentChunker } from "./types";
import { RecursiveCharacterChunker } from "./chunkers/RecursiveChunker";

export function getDocumentChunker(): DocumentChunker {

    const defaultConfig: ChunkingConfiguration = {chunkSize: 1000, chunkOverlap: 200};

    return new RecursiveCharacterChunker(defaultConfig);
}