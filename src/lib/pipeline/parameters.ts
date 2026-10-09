import { z } from "zod";

const ImportParametersSchema = z.object({
    storagePath: z.string().min(1),
});

// Tesseract language code (fra, deu, deu_latf...): the format alone keeps it safe as a CLI argument.
export const OcrLanguageSchema = z.string().regex(/^[a-z]{3}(_[a-z]+)*$/, "Code de langue OCR invalide");

// Defaults keep parameters stored before these fields existed valid.
export const ExtractionParametersSchema = z.object({
    ocrEnabled: z.boolean(),
    // A PDF page whose native text has fewer letters/digits than this is OCRed.
    ocrMinCharsPerPage: z.number().int().nonnegative().default(50),
    ocrLanguages: z.array(OcrLanguageSchema).min(1).default(["fra", "eng"]),
});

export type ExtractionParameters = z.infer<typeof ExtractionParametersSchema>;

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