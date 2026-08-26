import { IndexingProgress } from "@/lib/queue/types";
import type { Document, SourceFolder, MimeType } from "@prisma/client";

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

export type DocumentWithSourceFolder = Document & { sourceFolder: SourceFolder};

export interface DocumentExtractor {
  extract(document: DocumentWithSourceFolder): Promise<ExtractedDocument>;
}

export interface DocumentChunker {
  chunk(document: ExtractedDocument): Promise<IndexedChunk[]>; 
}

export class UnsupportedDocumentTypeError extends Error {
  constructor(mimeType: MimeType | null) {
    super(`Unsupported document type: ${mimeType ?? "unknown"}`);
    this.name = "UnsupportedDocumentTypeError";
  }
}

export type IndexingProgressCallback = (
  progress: IndexingProgress,
) => Promise<void>;