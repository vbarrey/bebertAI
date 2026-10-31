import { PipelineConfig } from "./config";
import { defaultPipelineParameters, UNSET } from "./default";
import { pipelineCapabilities } from "./capabilities";
import { PipelineParametersSchema, PipelineParameters, requiresReindex } from "./parameters";
import { prisma } from "@/lib/prisma";
import { deleteChunksCollection } from "@/lib/qdrant/collections";
import { flagIndexedDocumentsForReindex } from "@/lib/mutations/document";
import { IndexingStatus } from "@prisma/client";
import { listInstalledOcrLanguages } from "@/lib/rag/indexing/ocr";
import { z } from "zod";
import { usableProviders } from "@/lib/ai/provider-access";

/**
 * Each user's pipeline, read from the database every time: no copy kept in memory, which the pages, the routes and
 * the worker would each hold on their own and see go stale. The indexing jobs carry the configuration they were
 * enqueued with.
 */
export async function getPipelineConfig(userId: string): Promise<PipelineConfig> {
  const stored = await prisma.pipelineParameters.findUnique({ where: { userId } });

  const parameters = parseParameters(stored?.parameters ?? defaultPipelineParameters);

  // Stored from the first read: a new pipeline starts with its generation and embedding steps unset.
  if (!stored) {
    // An upsert: two first reads at once (the page and a route) would create it twice.
    await prisma.pipelineParameters.upsert({
      where: { userId },
      create: { userId, parameters: JSON.stringify(parameters) },
      update: {},
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
    throw new Error("Fournisseur inconnu : choisissez l'un de vos fournisseurs.");
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
