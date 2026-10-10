import { DocumentFormat } from "../documents/format";
import { BM25_LANGUAGES, Bm25Language } from "./parameters";

export type PipelineCapabilities = {
  import: ImportCapabilities;
  extraction: ExtractionCapabilities;
  chunking: ChunkingCapabilities;
  embedding: EmbeddingCapabilities;
  retrieval: RetrievalCapabilities;
  generation: GenerationCapabilities;
};

export const pipelineCapabilities: PipelineCapabilities = {
  // PNG/JPEG are indexed from their name and text metadata, not their pixels.
  import: { supportedFormat: ["PDF", "TXT", "DOCX", "PNG", "JPEG"] },
  extraction: {
    extractors: ["PDF", "TXT", "DOCX", "PNG", "JPEG"],
  },
  chunking: { strategies: ["recursive"] },
  embedding: {},
  retrieval: { bm25Languages: BM25_LANGUAGES },
  generation: {},
};

type ImportCapabilities = {
  supportedFormat: readonly DocumentFormat[];
};

export type ExtractorId = DocumentFormat;

type ExtractionCapabilities = {
  extractors: readonly ExtractorId[];
};

type ChunkingCapabilities = {
  strategies: readonly string[];
};

type EmbeddingCapabilities = unknown;
type RetrievalCapabilities = {
  bm25Languages: readonly Bm25Language[];
};
type GenerationCapabilities = unknown;
