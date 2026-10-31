"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Capability } from "@prisma/client";

import { prisma } from "@/lib/prisma";
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
  // The models of the user's own providers.
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
  // The models of the user's own providers.
  const manageable = { provider: manageableProviders(user) };
  await prisma.aIModel.updateMany({ where: { id: modelId, ...manageable }, data: { favorite } });
  revalidatePath("/settings", "layout");
}

// Same as a disabled provider, for one of its models.
export async function setModelEnabled(modelId: string, enabled: boolean): Promise<void> {
  const user = await requireUser();
  // The models of the user's own providers.
  const manageable = { provider: manageableProviders(user) };
  await prisma.aIModel.updateMany({ where: { id: modelId, ...manageable }, data: { enabled } });
  revalidatePath("/", "layout");
}

