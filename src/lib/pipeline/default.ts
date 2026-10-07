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
            modelName: "...",
        },
        request: {
            providerId: "...",
            modelName: "...",
        },
    },
    retrieval: {
        topK: 5,
        scoreThreshold: 0.7,
    },
    generation: {
        providerId: "...",
        modelName: "...",
        temperature: 0.7,
        maxTokens: 1000,
        systemPrompt: "...",
    },
};