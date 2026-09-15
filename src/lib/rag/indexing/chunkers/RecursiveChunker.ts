import {
  DocumentChunker,
  ExtractedDocument,
  IndexedChunk
} from "../types";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ChunkingParameters } from "@/lib/pipeline/parameters";

export class RecursiveCharacterChunker implements DocumentChunker {
  private readonly splitter: RecursiveCharacterTextSplitter;

  constructor(parameters: ChunkingParameters) {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: parameters.chunkSize,
      chunkOverlap: parameters.chunkOverlap,
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
