"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AIProviderType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { aiProviderRegistry } from "@/lib/ai/registry";
import { OllamaCloudProvider } from "@/lib/ai/ollama-cloud/provider";
import { OLLAMA_CLOUD_HOST } from "@/lib/ai/ollama-cloud/config";
import { createProviderClient, loadProvider, syncProviderModels } from "@/lib/ai/provider-factory";

const OllamaCloudProviderSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis."),
  host: z.url("Adresse invalide.").trim().default(OLLAMA_CLOUD_HOST),
  apiKey: z.string().trim().min(1, "La clé API est requise."),
  defaultModel: z.string().trim().optional().transform((model) => model || undefined),
});

export type CreateOllamaCloudProviderInput = z.input<typeof OllamaCloudProviderSchema>;

/**
 * Creates an Ollama Cloud provider once its API key is accepted, then registers it and stores its models.
 */
export async function createOllamaCloudProvider(
  input: CreateOllamaCloudProviderInput,
): Promise<{ error: string } | undefined> {
  const parsed = OllamaCloudProviderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(" ") };
  }

  const { name, ...configuration } = parsed.data;

  try {
    await new OllamaCloudProvider("", name, configuration).checkApiKey();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible de joindre Ollama Cloud." };
  }

  const provider = await prisma.aIProvider.create({
    data: { type: AIProviderType.OLLAMA_CLOUD, name, configuration },
  });

  const client = createProviderClient(provider);
  aiProviderRegistry.register(client);
  await syncProviderModels(provider, client);

  revalidatePath("/settings", "layout");
}

/**
 * Lists the models of the provider again, with whether they need usage credits.
 */
export async function synchronizeProviderModels(providerId: string): Promise<{ error: string } | undefined> {
  const provider = await prisma.aIProvider.findUnique({ where: { id: providerId } });
  if (!provider) {
    return { error: "Fournisseur introuvable." };
  }

  try {
    const client = aiProviderRegistry.get(providerId) ?? (await loadProvider(providerId))!;
    await syncProviderModels(provider, client);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Synchronisation impossible." };
  }

  revalidatePath("/settings", "layout");
}
