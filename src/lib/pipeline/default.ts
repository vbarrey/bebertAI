import { PipelineParameters } from "./parameters";

export const defaultPipelineParameters: PipelineParameters = {
    import: {
        storagePath: "./documents",
    },
    extraction: {
        ocrEnabled: false,
    },
    chunking: {
        chunkSize: 300,
        chunkOverlap: 50,
    },
    embedding: {
        document: {
            providerId: "...",
            modelId: "...",
        },
        request: {
            providerId: "...",
            modelId: "...",
        },
    },
    retrieval: {
        topK: 5,
        scoreThreshold: 0.7,
    },
    generation: {
        providerId: "...",
        modelId: "...",
        temperature: 0.7,
        maxTokens: 1000,
        systemPrompt: "...",
    },
};