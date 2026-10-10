import { z } from "zod";

const ImportParametersSchema = z.object({
    storagePath: z.string().min(1),
});

// Tesseract language code (fra, deu, deu_latf...): the format alone keeps it safe as a CLI argument.
export const OcrLanguageSchema = z.string().regex(/^[a-z]{3}(_[a-z]+)*$/, "Code de langue OCR invalide");

// Languages of the BM25 sparse vectors (Qdrant Snowball names): one named vector per language in the collection.
export const BM25_LANGUAGES = ["french", "english", "russian", "german"] as const;

export const Bm25LanguageSchema = z.enum(BM25_LANGUAGES);

export type Bm25Language = z.infer<typeof Bm25LanguageSchema>;

// Defaults keep parameters stored before these fields existed valid.
export const ExtractionParametersSchema = z.object({
    ocrEnabled: z.boolean(),
    // A PDF page whose native text has fewer letters/digits than this is OCRed.
    ocrMinCharsPerPage: z.number().int().nonnegative().default(50),
    ocrLanguages: z.array(OcrLanguageSchema).min(1).default(["fra", "eng"]),
    // Used when the document text is too short to detect its language (an image indexed from its name).
    fallbackLanguage: Bm25LanguageSchema.default("french"),
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
        // BM25 of the lexical search: changing these requires reindexing the documents.
        sparse: z.object({
            k: z.number().positive().default(1.2),
            b: z.number().min(0).max(1).default(0.75),
            // "resume" finds "résumé": users often type without accents.
            asciiFolding: z.boolean().default(true),
        }).prefault({}),
    }),
);

const RetrievalParametersSchema = z.object({
    topK: z.number().int().positive(),
    // Applied to the semantic search only: fused RRF scores are ranks, not similarities.
    scoreThreshold: z.number().min(0).max(1),
    // Chunks added before and after each result: a list cut by the chunker continues in the next chunk.
    neighborChunks: z.number().int().min(0).max(5).default(1),
    // Semantic and lexical (BM25) results fused by RRF; the query is translated into each BM25 language.
    hybrid: z.object({
        enabled: z.boolean().default(true),
        denseLimit: z.number().int().positive().default(20),
        sparseLimit: z.number().int().positive().default(20),
        rrfK: z.number().int().positive().default(60),
        // RRF weight of each lexical result list, the semantic one weighing 1.
        sparseWeight: z.number().nonnegative().default(1),
        // Empty: the generation model translates the query.
        translation: z.object({
            providerId: z.string().default(""),
            modelName: z.string().default(""),
        }).prefault({}),
    }).prefault({}),
});

const GenerationParametersSchema = z.object({
    providerId: z.string().min(1),
    modelName: z.string().min(1),
    temperature: z.number().min(0),
    maxTokens: z.number().int().positive(),
    // Reasoning models think before answering and the thoughts count in maxTokens.
    think: z.boolean().default(false),
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

// Steps whose output is stored in the index: changing them makes the indexed documents stale.
export const REINDEX_STEPS = ["extraction", "chunking", "embedding"] as const satisfies readonly (keyof PipelineParameters)[];

export function requiresReindex(previous: PipelineParameters, next: PipelineParameters): boolean {
    return REINDEX_STEPS.some((step) => JSON.stringify(previous[step]) !== JSON.stringify(next[step]));
}