import { DocumentFormat } from "../documents/format";

export type PipelineCapabilities = {
  import: ImportCapabilities;
  extraction: ExtractionCapabilities;
  chunking: ChunkingCapabilities;
  embedding: EmbeddingCapabilities;
  retrieval: RetrievalCapabilities;
  generation: GenerationCapabilities;
};

export const pipelineCapabilities: PipelineCapabilities = {
  // PNG/JPEG are only readable through OCR.
  import: { supportedFormat: ["PDF", "TXT", "DOCX", "PNG", "JPEG"] },
  extraction: {
    extractors: ["PDF", "TXT", "DOCX", "PNG", "JPEG"],
  },
  chunking: { strategies: ["recursive"] },
  embedding: {},
  retrieval: {},
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
type RetrievalCapabilities = unknown;
type GenerationCapabilities = unknown;
