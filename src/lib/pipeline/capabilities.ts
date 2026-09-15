import { DocumentFormat } from "./formats";

export type PipelineCapabilities = {
  import: ImportCapabilities;
  extraction: ExtractionCapabilities;
  chunking: ChunkingCapabilities;
  embedding: EmbeddingCapabilities;
  retrieval: RetrievalCapabilities;
  generation: GenerationCapabilities;
};

export const pipelineCapabilities: PipelineCapabilities = {
  import: { supportedFormat: ["PDF", "TXT", "DOCX"] },
  extraction: { extractors: ["PDF", "TXT", "DOCX"] },
  chunking: { strategies: ["recursive"] },
  embedding: {},
  retrieval: {},
  generation: {},
};

type ImportCapabilities = {
  supportedFormat: readonly DocumentFormat[];
};

export type ExtractorId = "PDF" | "TXT" | "DOCX";

type ExtractionCapabilities = {
  extractors: readonly ExtractorId[];
};

type ChunkingCapabilities = {
  strategies: readonly string[];
};

type EmbeddingCapabilities = unknown;
type RetrievalCapabilities = unknown;
type GenerationCapabilities = unknown;
