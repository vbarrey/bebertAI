import "server-only";

import { prisma } from "@/lib/prisma";
import { UNSET } from "@/lib/pipeline/default";

type Step = { providerId?: string; modelName?: string };

/**
 * Deletes a provider of the user with its models. The pipeline steps on it are unset, so the setup warning asks for a
 * new choice instead of naming a provider gone; the conversations on its models fall back to the pipeline's model.
 * The vectors stay: choosing another embedding model reindexes the documents, like any change of model.
 * Returns false when the user has no such provider.
 */
export async function removeProvider(userId: string, providerId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const provider = await tx.aIProvider.findFirst({ where: { id: providerId, userId }, select: { id: true } });
    if (!provider) return false;

    const stored = await tx.pipelineParameters.findUnique({ where: { userId } });
    if (stored) {
      const parameters = JSON.parse(stored.parameters);
      const unset = (step: Step | undefined, value: string) => {
        if (step?.providerId === providerId) Object.assign(step, { providerId: value, modelName: value });
      };
      unset(parameters.generation, UNSET);
      unset(parameters.embedding, UNSET);
      // The translation is optional: "" turns it off.
      unset(parameters.retrieval?.hybrid?.translation, "");
      await tx.pipelineParameters.update({ where: { userId }, data: { parameters: JSON.stringify(parameters) } });
    }

    await tx.aIProvider.delete({ where: { id: providerId } });
    return true;
  });
}
