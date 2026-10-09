import type { Document } from "@prisma/client";

export type ExtractedBlock = {
  text: string;
  pageNumber?: number;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type ExtractedDocument = {
  blocks: ExtractedBlock[];
  language?: string;
};

export type IndexedChunk = {
  position: number;
  text: string;
  pageNumber?: number;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type ChunkingConfiguration = {
  chunkSize: number;
  chunkOverlap: number;
};

// Reports long extraction work (OCR pages), current out of total.
export type ExtractionProgress = (current: number, total: number) => Promise<void> | void;

export interface DocumentExtractor {
  extract(document: Document, onProgress?: ExtractionProgress): Promise<ExtractedDocument>;
}

export interface DocumentChunker {
  chunk(document: ExtractedDocument): Promise<IndexedChunk[]>; 
}

export class UnsupportedDocumentTypeError extends Error {
  constructor(mimeType: string) {
    super(`Unsupported document type: ${mimeType ?? "unknown"}`);
    this.name = "UnsupportedDocumentTypeError";
  }
}