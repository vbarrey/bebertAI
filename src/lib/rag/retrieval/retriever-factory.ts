import { AIProviderClient } from "@/lib/ai/provider";
import { DocumentRetriever } from "./retriever";

export async function getDocumentRetriever(
    provider: AIProviderClient,
    modelName: string
): Promise<DocumentRetriever> {
    const modelInfo = await provider.models();
    const model = modelInfo.find(m => m.name === modelName);

    if(!model) {
        throw new Error(`Model ${modelName} not found in provider ${provider.name}`);
    }

    return new DocumentRetriever(provider, modelName);
}