import {
  DocumentChunker,
  ExtractedDocument,
  IndexedChunk,
  ChunkingConfiguration,
} from "../types";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export class RecursiveCharacterChunker implements DocumentChunker {
  private readonly splitter: RecursiveCharacterTextSplitter;

  constructor(options: ChunkingConfiguration) {
    if (options.chunkSize <= 0) {
      throw new Error("[RecursiveChunker] chunkSize must be greater than 0");
    }

    if (options.chunkOverlap < 0) {
      throw new Error("[RecursiveChunker] chunkOverlap cannot be negative");
    }

    if (options.chunkOverlap >= options.chunkSize) {
      throw new Error("[RecursiveChunker] chunkOverlap must be smaller than chunkSize");
    }

    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: options.chunkSize,
      chunkOverlap: options.chunkOverlap,
    });
  }

  async chunk(document: ExtractedDocument): Promise<IndexedChunk[]> {
    const chunks: IndexedChunk[] = [];

    for (const block of document.blocks) {
      const texts = await this.splitter.splitText(block.text);

      for (const text of texts) {
        chunks.push({
          position: chunks.length,
          text,
          pageNumber: block.pageNumber,
          bounds: block.bounds,
        });
      }
    }

    return chunks;
  }
}
