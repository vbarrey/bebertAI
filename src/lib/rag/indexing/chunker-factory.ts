import { DocumentChunker } from "../types";
import { RecursiveCharacterChunker } from "./chunkers/RecursiveChunker";
import { ChunkingParameters } from "@/lib/pipeline/parameters";

export function getDocumentChunker(chunkerConfig: ChunkingParameters): DocumentChunker {
    return new RecursiveCharacterChunker(chunkerConfig);
}