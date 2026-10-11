import {
  DocumentChunker,
  ExtractedDocument,
  IndexedChunk
} from "../../types";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ChunkingParameters } from "@/lib/pipeline/parameters";
import { countMeaningfulChars } from "../text";

// Fewer letters and digits than this: a cover title or a stray OCR glyph ("RENAULI", "v"), whose embedding is so
// generic that it ranks high for any question. Measured on the indexed documents, real chunks have 58 or more.
const MIN_CHUNK_MEANINGFUL_CHARS = 20;

/**
 * Merges the chunks too short to stand alone into the next one (into the previous one at the end of the document),
 * so their text is kept without a chunk of its own. A document that is short as a whole stays one chunk.
 */
export function mergeShortChunks(chunks: IndexedChunk[]): IndexedChunk[] {
  const merged: IndexedChunk[] = [];
  let pending: IndexedChunk | null = null;

  for (const chunk of chunks) {
    // The short text joins the next chunk, which keeps its own page and bounds.
    const current: IndexedChunk = pending ?{ ...chunk, text: `${pending.text}\n\n${chunk.text}` } : chunk;

    if (countMeaningfulChars(current.text) < MIN_CHUNK_MEANINGFUL_CHARS) {
      // Keeps the page and bounds of the first short chunk, used if the whole document is short.
      pending = { ...(pending ?? chunk), text: current.text };
      continue;
    }

    merged.push(current);
    pending = null;
  }

  if (pending) {
    const last = merged.pop();
    merged.push(last ? { ...last, text: `${last.text}\n\n${pending.text}` } : pending);
  }

  return merged.map((chunk, position) => ({ ...chunk, position }));
}

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

    return mergeShortChunks(chunks);
  }
}
