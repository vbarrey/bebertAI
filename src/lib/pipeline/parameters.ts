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

const EmbeddingParametersSchema = z.object({
    document: z.object({
        providerId: z.string().min(1),
        modelId: z.string().min(1),
    }),
    request: z.object({
        providerId: z.string().min(1),
        modelId: z.string().min(1),
    }),
});

const RetrievalParametersSchema = z.object({
    topK: z.number().int().positive(),
    scoreThreshold: z.number().min(0).max(1),
});

const GenerationParametersSchema = z.object({
    providerId: z.string().min(1),
    modelId: z.string().min(1),
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