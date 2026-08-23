import { ChunkingConfiguration, DocumentChunker } from "./types";
import { RecursiveCharacterChunker } from "./chunkers/RecursiveChunker";

export function getDocumentChunker(): DocumentChunker {

    const defaultConfig: ChunkingConfiguration = {chunkSize: 300, chunkOverlap: 50};

    return new RecursiveCharacterChunker(defaultConfig);
}