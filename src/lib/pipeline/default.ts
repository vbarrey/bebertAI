import { PipelineParameters } from "./parameters";

// Provider and model of a step never configured.
const UNSET = "...";

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
        providerId: UNSET,
        modelName: UNSET,
        sparse: {
            k: 1.2,
            b: 0.75,
            asciiFolding: true,
        },
    },
    retrieval: {
        topK: 5,
        // Measured with qwen3-embedding: a vague question scores about 0.55 with its passage, so 0.55 kept
        // 1 result out of 5 and 0.35 doubles the pages found without losing any on precise questions.
        scoreThreshold: 0.35,
        neighborChunks: 1,
        hybrid: {
            enabled: true,
            denseLimit: 20,
            sparseLimit: 20,
            rrfK: 60,
            sparseWeight: 1,
            translation: {
                providerId: "",
                modelName: "",
            },
        },
    },
    generation: {
        providerId: UNSET,
        modelName: UNSET,
        temperature: 0.7,
        maxTokens: 1000,
        think: false,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
    },
};

/**
 * Points the embedding and generation steps never configured to the given models of a provider,
 * a model left undefined keeping its step unset. Returns the same parameters when nothing changes.
 */
export function withDefaultModels(
    parameters: PipelineParameters,
    { providerId, embeddingModel, generationModel }: { providerId: string; embeddingModel?: string; generationModel?: string },
): PipelineParameters {
    const embedding = parameters.embedding.providerId === UNSET && embeddingModel;
    const generation = parameters.generation.providerId === UNSET && generationModel;

    if (!embedding && !generation) {
        return parameters;
    }

    return {
        ...parameters,
        embedding: embedding ? { ...parameters.embedding, providerId, modelName: embedding } : parameters.embedding,
        generation: generation ? { ...parameters.generation, providerId, modelName: generation } : parameters.generation,
    };
}
