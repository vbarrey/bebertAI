import { AIProviderClient } from "@/lib/ai/provider";
import { DocumentEmbedder } from "./embedder";
import { prisma } from "@/lib/prisma";

export async function getDocumentEmbedder(
    provider: AIProviderClient,
    modelId: string
): Promise<DocumentEmbedder> {
    const modelInfo = await prisma.aIModel.findUnique({ where: { id: modelId }, select: {name: true}});
    if(!modelInfo) {
        throw new Error(`Model ${modelId} not found in database`);
    }

    const hasModel = await provider.hasModel(modelInfo.name);

    if(!hasModel) {
        throw new Error(`Model ${modelInfo.name} not found in provider ${provider.name}`);
    }
    return new DocumentEmbedder(provider, modelInfo.name);
}