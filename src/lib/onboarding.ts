import "server-only";

import { prisma } from "@/lib/prisma";
import { getPipelineProvider } from "@/lib/pipeline/config";
import { getPipelineConfig, updatePipelineParameters } from "@/lib/pipeline/runtime";
import { getSetupStatus, isSetupComplete } from "@/lib/pipeline/setup";

export type StepChoice = { providerId: string; modelName: string };

const markOnboarded = (userId: string) =>
  prisma.user.update({ where: { id: userId }, data: { onboardedAt: new Date() } });

/** A user already set up is marked onboarded and never sent to the welcome page. */
export async function needsOnboarding(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { onboardedAt: true } });
  if (user.onboardedAt) return false;

  if (isSetupComplete(await getSetupStatus(userId))) {
    await markOnboarded(userId);
    return false;
  }
  return true;
}

export async function completeOnboarding(userId: string, choice: { generation: StepChoice; embedding: StepChoice }) {
  await getPipelineProvider(choice.generation, "génération");
  await getPipelineProvider(choice.embedding, "embedding");

  const { parameters } = await getPipelineConfig(userId);
  await updatePipelineParameters(userId, {
    ...parameters,
    generation: { ...parameters.generation, ...choice.generation },
    embedding: { ...parameters.embedding, ...choice.embedding },
  });
  await markOnboarded(userId);
}

export async function skipOnboarding(userId: string) {
  await markOnboarded(userId);
}
