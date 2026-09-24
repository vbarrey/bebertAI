import { AIProviderClient } from "@/lib/ai/provider";
import { DocumentEmbedder } from "./embedder";

export async function getDocumentEmbedder(
    provider: AIProviderClient,
    modelName: string
): Promise<DocumentEmbedder> {
    const modelInfo = await provider.models();
    const model = modelInfo.find(m => m.name === modelName);

    if(!model) {
        throw new Error(`Model ${modelName} not found in provider ${provider.name}`);
    }

    return new DocumentEmbedder(provider, modelName);
}