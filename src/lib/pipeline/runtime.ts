import { PipelineConfig } from "./config";
import { defaultPipelineParameters, withDefaultModels } from "./default";
import { pipelineCapabilities } from "./capabilities";
import { PipelineParametersSchema, PipelineParameters, requiresReindex } from "./parameters";
import { prisma } from "@/lib/prisma";
import { deleteChunksCollection } from "@/lib/qdrant/collections";
import { flagIndexedDocumentsForReindex } from "@/lib/mutations/document";
import { AIProviderType, IndexingStatus } from "@prisma/client";
import { listInstalledOcrLanguages } from "@/lib/rag/indexing/ocr";
import { z } from "zod";

class PipelineRuntime {
  private config: PipelineConfig | null = null;

  async initialize() {
    if(this.config) return;

    const storedParameters = await prisma.pipelineParameters.findUnique({
      where: { id: 1 },
    });

    if (!storedParameters) {
      console.log("No parameters stored in database - using default parameters");
    }

    const parsedParameters = this.parseParameters(storedParameters?.parameters ?? defaultPipelineParameters);
    const pipelineParameters = await this.withLocalDefaultModels(parsedParameters);

    if (!storedParameters || pipelineParameters !== parsedParameters) {
      await prisma.pipelineParameters.upsert({
        where: { id: 1 },
        create: { id: 1, parameters: JSON.stringify(pipelineParameters) },
        update: { parameters: JSON.stringify(pipelineParameters) },
      });
    }

    this.config = {
      parameters: pipelineParameters,
      capabilities: pipelineCapabilities,
    };
  }

  async getConfig(): Promise<PipelineConfig> {
    if (!this.config){
      await this.initialize();
    }
      
    return this.config!;
  }

  async updateParameters(parameters: unknown) {
    if(!this.config) await this.initialize();

    const validatedParameters = this.parseParameters(parameters);

    // Checked on save only: stored parameters must still load if a language is removed later.
    const { ocrEnabled, ocrLanguages } = validatedParameters.extraction;

    if (ocrEnabled) {
      const installed = await listInstalledOcrLanguages();
      const missing = ocrLanguages.filter((language) => !installed.includes(language));

      if (missing.length > 0) {
        throw new Error(`Langues OCR non installées pour Tesseract : ${missing.join(", ")}.`);
      }
    }

    const reindex = requiresReindex(this.config!.parameters, validatedParameters);

    if (reindex) {
      // A running job uses the parameters it was enqueued with and would end up indexed with the old ones.
      const indexing = await prisma.document.count({
        where: { indexingStatus: { in: [IndexingStatus.PENDING, IndexingStatus.PROCESSING] } },
      });

      if (indexing > 0) {
        throw new Error(`${indexing} document(s) en cours d'indexation : attendez la fin avant de modifier ces paramètres.`);
      }

      // Every vector is stale, including leftovers of failed runs; the worker recreates the collection
      // with the new embedding dimension.
      await deleteChunksCollection();
    }

    await prisma.$transaction([
      prisma.pipelineParameters.update({
        where: { id: 1 },
        data: {
          parameters: JSON.stringify(validatedParameters),
        },
      }),
      ...(reindex
        ? [flagIndexedDocumentsForReindex()]
        : []),
    ]);

    this.config = {
      ...(await this.getConfig()),
      parameters: validatedParameters,
    };
  }

  /**
   * Steps never configured use the local Ollama models when synchronized: the default model of the provider
   * for the generation, OLLAMA_EMBEDDING_MODEL for the embedding (both downloaded by docker compose).
   */
  private async withLocalDefaultModels(parameters: PipelineParameters): Promise<PipelineParameters> {
    const provider = await prisma.aIProvider.findFirst({
      where: { type: AIProviderType.OLLAMA_LOCAL },
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