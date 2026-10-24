"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AIProviderSource, AIProviderType, Capability } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { aiProviderRegistry } from "@/lib/ai/registry";
import { loadProvider } from "@/lib/ai/provider-factory";
import { OllamaRequestError } from "@/lib/ai/ollama-local/errors";
import { isOllamaLocalDefaultModel } from "@/lib/ai/ollama-local/config";
import { pipelineRuntime } from "@/lib/pipeline/runtime";
import { requireUser } from "@/lib/session";
import { manageableProviders } from "@/lib/ai/provider-access";


const ModelUpdateSchema = z.object({
  displayName: z.string().trim().transform((value) => value || null),
  description: z.string().trim().transform((value) => value || null),
  capabilities: z.array(z.enum(Capability)),
});

export type ModelUpdateInput = z.input<typeof ModelUpdateSchema>;

export async function updateModel(modelId: string, input: ModelUpdateInput): Promise<{ error: string } | undefined> {
  const user = await requireUser();
  // The models of the providers the user can manage (the shared Ollama local: the admin).
  const manageable = { provider: manageableProviders(user) };
  if (!(await prisma.aIModel.count({ where: { id: modelId, ...manageable } }))) {
    return { error: "Modèle introuvable." };
  }

  const parsed = ModelUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Modification invalide." };
  }

  const { capabilities, ...fields } = parsed.data;

  await prisma.$transaction([
    // The capability rows are shared by the models: created by the first model that has one.
    ...capabilities.map((name) =>
      prisma.aIModelCapability.upsert({ where: { name }, create: { name }, update: {} }),
    ),
    prisma.aIModel.update({
      where: { id: modelId },
      data: { ...fields, capabilities: { set: capabilities.map((name) => ({ name })) } },
    }),
  ]);

  revalidatePath("/settings", "layout");
}

export async function setModelFavorite(modelId: string, favorite: boolean): Promise<void> {
  const user = await requireUser();
  // The models of the providers the user can manage (the shared Ollama local: the admin).
  const manageable = { provider: manageableProviders(user) };
  await prisma.aIModel.updateMany({ where: { id: modelId, ...manageable }, data: { favorite } });
  revalidatePath("/settings", "layout");
}

// Same as a disabled provider, for one of its models.
export async function setModelEnabled(modelId: string, enabled: boolean): Promise<void> {
  const user = await requireUser();
  // The models of the providers the user can manage (the shared Ollama local: the admin).
  const manageable = { provider: manageableProviders(user) };
  await prisma.aIModel.updateMany({ where: { id: modelId, ...manageable }, data: { enabled } });
  revalidatePath("/", "layout");
}

/**
 * Deletes a model of a local provider from the provider itself, then from the app: a model only removed from
 * the app would come back with the next synchronization. The conversations that used it keep going with the
 * pipeline model.
 */
export async function deleteModel(modelId: string): Promise<{ error: string } | undefined> {
  const user = await requireUser();
  // The models of the providers the user can manage (the shared Ollama local: the admin).
  const manageable = { provider: manageableProviders(user) };
  const model = await prisma.aIModel.findFirst({ where: { id: modelId, ...manageable }, include: { provider: true } });
  if (!model) {
    return { error: "Modèle introuvable." };
  }

  // A remote provider lists the models it serves: they cannot be deleted.
  if (model.provider.source === AIProviderSource.REMOTE) {
    return { error: "Les modèles d'un fournisseur distant ne peuvent pas être supprimés." };
  }

  if (model.provider.type === AIProviderType.OLLAMA_LOCAL && isOllamaLocalDefaultModel(model.name)) {
    return { error: "Ce modèle est un modèle par défaut défini dans le .env (génération ou embedding) : il ne peut pas être supprimé." };
  }

  const { parameters } = await pipelineRuntime.getConfig();
  const steps = [
    ["génération", parameters.generation],
    ["embedding", parameters.embedding],
    ["traduction", parameters.retrieval.hybrid.translation],
  ] as const;
  const usedBy = steps
    .filter(([, step]) => step.providerId === model.providerId && step.modelName === model.name)
    .map(([name]) => name);

  if (usedBy.length > 0) {
    return { error: `Ce modèle est utilisé par le pipeline (${usedBy.join(", ")}) : choisissez-en un autre dans Réglages > Pipeline avant de le supprimer.` };
  }

  try {
    const client = aiProviderRegistry.get(model.providerId) ?? (await loadProvider(model.providerId));
    await client?.remove?.(model.name);
  } catch (error) {
    // Already gone from Ollama: only the app still lists it.
    if (!(error instanceof OllamaRequestError && error.status === 404)) {
      return { error: error instanceof Error ? error.message : "Suppression impossible." };
    }
  }

  await prisma.aIModel.delete({ where: { id: modelId } });

  revalidatePath("/settings", "layout");
}
