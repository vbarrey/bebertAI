import { z } from "zod";

const ImportParametersSchema = z.object({
    storagePath: z.string().min(1),
});

const ExtractionParametersSchema = z.object({
    ocrEnabled: z.boolean(),
});

const ChunkingParametersSchema = z.object({
    chunkSize: z.number().int().positive(),
    chunkOverlap: z.number().int().nonnegative(),
}).refine(
    ({ chunkSize, chunkOverlap }) => chunkOverlap < chunkSize,
    {
        message: "chunkOverlap must be smaller than chunkSize",
        path: ["chunkOverlap"],
    }
);

export type ChunkingParameters = z.infer<typeof ChunkingParametersSchema>;

// Documents and queries must share one model: vectors from different models are not comparable.
const EmbeddingParametersSchema = z.preprocess(
    // Parameters stored before the merge had { document, request }: keep the document model, the one the vectors were built with.
    (value) => value && typeof value === "object" && "document" in value ? value.document : value,
    z.object({
        providerId: z.string().min(1),
        modelName: z.string().min(1),
    }),
);

const RetrievalParametersSchema = z.object({
    topK: z.number().int().positive(),
    scoreThreshold: z.number().min(0).max(1),
});

const GenerationParametersSchema = z.object({
    providerId: z.string().min(1),
    modelName: z.string().min(1),
    temperature: z.number().min(0),
    maxTokens: z.number().int().positive(),
    systemPrompt: z.string(),
});

export const PipelineParametersSchema = z.object({
    import: ImportParametersSchema,
    extraction: ExtractionParametersSchema,
    chunking: ChunkingParametersSchema,
    embedding: EmbeddingParametersSchema,
    retrieval: RetrievalParametersSchema,
    generation: GenerationParametersSchema,
});

export type PipelineParameters = z.infer<typeof PipelineParametersSchema>;