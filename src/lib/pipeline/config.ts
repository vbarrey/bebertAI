import { AIProviderClient } from "@/lib/ai/provider";
import { createProviderClient } from "@/lib/ai/provider-factory";
import { prisma } from "@/lib/prisma";
import { PipelineCapabilities } from "./capabilities";
import { PipelineParameters } from "./parameters"

export type PipelineConfig = {
    parameters: PipelineParameters; // Stored in Prisma database - Contains parameters that can be tunes for each steps of the pipeline (size of chunks, models for embedding or generating etc...)
    capabilities: PipelineCapabilities; // Derived from app itself - Contains all that the app capabilities, the things it could do for each step (supported document types, chunking strategy etc...)
}

/**
 * The client of the provider configured for a pipeline step, built from the database at each call: a provider
 * created or changed since the start of this process is the one used. With an explicit error when the pipeline was
 * never configured (default "..." placeholders) or points to an unknown provider.
 */
export async function getPipelineProvider(
    { providerId, modelName }: { providerId: string; modelName: string },
    step: string,
): Promise<AIProviderClient> {
    const stored = await prisma.aIProvider.findUnique({
        where: { id: providerId },
        include: { models: { where: { name: modelName }, select: { enabled: true } } },
    });

    if (!stored) {
        throw new Error(
            `Pipeline non configuré pour l'étape « ${step} » : provider "${providerId}" inconnu (modèle "${modelName}"). ` +
            `Configurez-le dans Réglages > Pipeline.`,
        );
    }

    // Disabled in the settings: kept by the pipeline or a conversation that picked it before.
    if (!stored.enabled) {
        throw new Error(`Le fournisseur « ${stored.name} » (étape « ${step} ») est désactivé : activez-le dans Réglages > Fournisseurs, ou choisissez-en un autre.`);
    }

    if (stored.models[0] && !stored.models[0].enabled) {
        throw new Error(`Le modèle « ${modelName} » (étape « ${step} ») est désactivé : activez-le dans Réglages > Fournisseurs, ou choisissez-en un autre.`);
    }

    return createProviderClient(stored);
}
