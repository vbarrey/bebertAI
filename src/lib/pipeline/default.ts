import { PipelineParameters } from "./parameters";

export const DEFAULT_SYSTEM_PROMPT = `Tu es l'assistant de Bebert AI.
Tu aides l'utilisateur à répondre à ses questions en utilisant les informations disponibles dans la conversation.
Certains messages système peuvent contenir du contexte provenant de la documentation de l'utilisateur. Lorsque ce contexte est fourni, utilise-le comme source d'information pour répondre à la question.
Si le contexte documentaire ne contient pas suffisamment d'informations pour répondre, indique-le plutôt que d'inventer des informations.`;

export const defaultPipelineParameters: PipelineParameters = {
    import: {
        storagePath: "./documents",
    },
    extraction: {
        ocrEnabled: false,
        ocrMinCharsPerPage: 50,
        ocrLanguages: ["fra", "eng"],
    },
    chunking: {
        chunkSize: 300,
        chunkOverlap: 50,
    },
    embedding: {
        providerId: "...",
        modelName: "...",
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
        think: false,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
    },
};