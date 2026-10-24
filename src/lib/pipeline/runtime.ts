import { PipelineConfig } from "./config";
import { defaultPipelineParameters, UNSET, withDefaultModels } from "./default";
import { pipelineCapabilities } from "./capabilities";
import { PipelineParametersSchema, PipelineParameters, requiresReindex } from "./parameters";
import { prisma } from "@/lib/prisma";
import { deleteChunksCollection } from "@/lib/qdrant/collections";
import { flagIndexedDocumentsForReindex } from "@/lib/mutations/document";
import { AIProviderType, IndexingStatus } from "@prisma/client";
import { listInstalledOcrLanguages } from "@/lib/rag/indexing/ocr";
import { z } from "zod";
import { usableProviders } from "@/lib/ai/provider-access";

/** Each user's pipeline, cached in this process; the indexing jobs carry the configuration they were enqueued with. */
class PipelineRuntime {
  private configs = new Map<string, PipelineConfig>();

  async getConfig(userId: string): Promise<PipelineConfig> {
    const cached = this.configs.get(userId);
    if (cached) return cached;

    const stored = await prisma.pipelineParameters.findUnique({ where: { userId } });

    const parsedParameters = this.parseParameters(stored?.parameters ?? defaultPipelineParameters);
    const parameters = await this.withLocalDefaultModels(parsedParameters);

    if (!stored || parameters !== parsedParameters) {
      await prisma.pipelineParameters.upsert({
        where: { userId },
        create: { userId, parameters: JSON.stringify(parameters) },
        update: { parameters: JSON.stringify(parameters) },
      });
    }

    const config = { parameters, capabilities: pipelineCapabilities };
    this.configs.set(userId, config);
    return config;
  }

  async updateParameters(userId: string, parameters: unknown) {
    const current = await this.getConfig(userId);

    const validatedParameters = this.parseParameters(parameters);

    // A step on another user's provider would run on their API key.
    const providerIds = [...new Set([
      validatedParameters.embedding.providerId,
      validatedParameters.generation.providerId,
      validatedParameters.retrieval.hybrid.translation.providerId,
    ].filter((providerId) => providerId && providerId !== UNSET))];

    if (await prisma.aIProvider.count({ where: { id: { in: providerIds }, ...usableProviders(userId) } }) !== providerIds.length) {
      throw new Error("Fournisseur inconnu : choisissez l'un de vos fournisseurs ou l'Ollama local.");
    }

    // Checked on save only: stored parameters must still load if a language is removed later.
    const { ocrEnabled, ocrLanguages } = validatedParameters.extraction;

    if (ocrEnabled) {
      const installed = await listInstalledOcrLanguages();
      const missing = ocrLanguages.filter((language) => !installed.includes(language));

      if (missing.length > 0) {
        throw new Error(`Langues OCR non installées pour Tesseract : ${missing.join(", ")}.`);
      }
    }

    const reindex = requiresReindex(current.parameters, validatedParameters);

    if (reindex) {
      // A running job uses the parameters it was enqueued with and would end up indexed with the old ones.
      const indexing = await prisma.document.count({
        where: { userId, indexingStatus: { in: [IndexingStatus.PENDING, IndexingStatus.PROCESSING] } },
      });

      if (indexing > 0) {
        throw new Error(`${indexing} document(s) en cours d'indexation : attendez la fin avant de modifier ces paramètres.`);
      }

      // Every vector of the user is stale, including leftovers of failed runs; the worker recreates their
      // collection with the new embedding dimension. The other users' collections are not touched.
      await deleteChunksCollection(userId);
    }

    await prisma.$transaction([
      prisma.pipelineParameters.update({
        where: { userId },
        data: {
          parameters: JSON.stringify(validatedParameters),
        },
      }),
      ...(reindex
        ? [flagIndexedDocumentsForReindex(userId)]
        : []),
    ]);

    this.configs.set(userId, { ...current, parameters: validatedParameters });
  }

  /**
   * Steps never configured use the local Ollama models when synchronized: the default model of the provider
   * for the generation, OLLAMA_EMBEDDING_MODEL for the embedding (both downloaded by docker compose).
   */
  private async withLocalDefaultModels(parameters: PipelineParameters): Promise<PipelineParameters> {
    // The shared Ollama local.
    const provider = await prisma.aIProvider.findFirst({
      where: { type: AIProviderType.OLLAMA_LOCAL, userId: null },
      select: { id: true, defaultModel: { select: { name: true } }, models: { select: { name: true } } },
    });

    if (!provider) {
      return parameters;
    }

    const embeddingModel = process.env.OLLAMA_EMBEDDING_MODEL;

    return withDefaultModels(parameters, {
      providerId: provider.id,
      generationModel: provider.defaultModel?.name,
      embeddingModel: provider.models.some((model) => model.name === embeddingModel) ? embeddingModel : undefined,
    });
  }

  private parseParameters(parameters: unknown): PipelineParameters {
    try {
      const rawParameters =
        typeof parameters === "string" ? JSON.parse(parameters) : parameters;

      return PipelineParametersSchema.parse(rawParameters);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("Unable to parse pipeline parameters JSON.", {
          cause: error,
        });
      }

      if (error instanceof z.ZodError) {
        throw new Error("Unable to validate pipeline parameters.", {
          cause: error,
        });
      }

      throw new Error("Unexpected error while parsing pipeline parameters.", {
        cause: error,
      });
    }
  }
}

const globalForPipeline = globalThis as unknown as {
    pipelineRuntime: PipelineRuntime | undefined;
};

export const pipelineRuntime =
    globalForPipeline.pipelineRuntime ??
    new PipelineRuntime();

if (process.env.NODE_ENV !== "production") {
    globalForPipeline.pipelineRuntime = pipelineRuntime;
}