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
import { env } from "@/lib/env";

/**
 * Each user's pipeline, read from the database every time: no copy kept in memory, which the pages, the routes and
 * the worker would each hold on their own and see go stale. The indexing jobs carry the configuration they were
 * enqueued with.
 */
export async function getPipelineConfig(userId: string): Promise<PipelineConfig> {
  const stored = await prisma.pipelineParameters.findUnique({ where: { userId } });

  const parsedParameters = parseParameters(stored?.parameters ?? defaultPipelineParameters);
  const parameters = await withLocalDefaultModels(parsedParameters);

  // Stored once filled in: the default models chosen then stay, the documents indexed with them still match.
  if (!stored || parameters !== parsedParameters) {
    await prisma.pipelineParameters.upsert({
      where: { userId },
      create: { userId, parameters: JSON.stringify(parameters) },
      update: { parameters: JSON.stringify(parameters) },
    });
  }

  return { parameters, capabilities: pipelineCapabilities };
}

/** Returns the configuration saved. */
export async function updatePipelineParameters(userId: string, parameters: unknown): Promise<PipelineConfig> {
  const current = await getPipelineConfig(userId);

  const validatedParameters = parseParameters(parameters);

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

  return { ...current, parameters: validatedParameters };
}

/**
 * Steps never configured use the local Ollama models when synchronized: the default model of the provider
 * for the generation, OLLAMA_EMBEDDING_MODEL for the embedding (both downloaded by docker compose).
 */
async function withLocalDefaultModels(parameters: PipelineParameters): Promise<PipelineParameters> {
  // The shared Ollama local.
  const provider = await prisma.aIProvider.findFirst({
    where: { type: AIProviderType.OLLAMA_LOCAL, userId: null },
    select: { id: true, defaultModel: { select: { name: true } }, models: { select: { name: true } } },
  });

  if (!provider) {
    return parameters;
  }

  const embeddingModel = env.OLLAMA_EMBEDDING_MODEL;

  return withDefaultModels(parameters, {
    providerId: provider.id,
    generationModel: provider.defaultModel?.name,
    embeddingModel: provider.models.some((model) => model.name === embeddingModel) ? embeddingModel : undefined,
  });
}

function parseParameters(parameters: unknown): PipelineParameters {
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
