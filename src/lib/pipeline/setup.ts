import "server-only";

import { cache } from "react";

import { usableProviders } from "@/lib/ai/provider-access";
import { prisma } from "@/lib/prisma";
import { getPipelineProvider } from "./config";
import { getPipelineConfig } from "./runtime";

/** For each step, null when it can run, otherwise why it cannot (the message of getPipelineProvider). */
export type SetupStatus = { providerCount: number; generation: string | null; embedding: string | null };

async function stepProblem(step: { providerId: string; modelName: string }, name: string) {
  try {
    await getPipelineProvider(step, name);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Once per request: React `cache` memoizes during a render only, so outside one (the tests) each call reads fresh data. */
export const getSetupStatus = cache(async (userId: string): Promise<SetupStatus> => {
  const [providerCount, { parameters }] = await Promise.all([
    prisma.aIProvider.count({ where: usableProviders(userId) }),
    getPipelineConfig(userId),
  ]);

  const [generation, embedding] = await Promise.all([
    stepProblem(parameters.generation, "génération"),
    stepProblem(parameters.embedding, "embedding"),
  ]);

  return { providerCount, generation, embedding };
});

export function isSetupComplete(status: SetupStatus) {
  return status.providerCount > 0 && !status.generation && !status.embedding;
}
