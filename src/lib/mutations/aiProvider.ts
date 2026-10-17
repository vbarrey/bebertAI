"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AIProviderType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { aiProviderRegistry } from "@/lib/ai/registry";
import { OllamaCloudProvider } from "@/lib/ai/ollama-cloud/provider";
import { AnthropicProvider } from "@/lib/ai/anthropic/provider";
import { OLLAMA_CLOUD_HOST } from "@/lib/ai/ollama-cloud/config";
import { createProviderClient, loadProvider, syncProviderModels } from "@/lib/ai/provider-factory";

const ApiKeyProviderSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis."),
  // Ollama Cloud only.
  host: z.url("Adresse invalide.").trim().default(OLLAMA_CLOUD_HOST),
  apiKey: z.string().trim().min(1, "La clé API est requise."),
  defaultModel: z.string().trim().optional().transform((model) => model || undefined),
});

export type ApiKeyProviderType = typeof AIProviderType.OLLAMA_CLOUD | typeof AIProviderType.ANTHROPIC;
export type CreateApiKeyProviderInput = z.input<typeof ApiKeyProviderSchema>;

/**
 * Creates a provider reached with an API key once the key is accepted, then registers it and stores its models.
 */
export async function createApiKeyProvider(
  type: ApiKeyProviderType,
  input: CreateApiKeyProviderInput,
): Promise<{ error: string } | undefined> {
  const parsed = ApiKeyProviderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(" ") };
  }

  const { name, host, ...credentials } = parsed.data;
  const configuration = type === AIProviderType.OLLAMA_CLOUD ? { host, ...credentials } : credentials;

  try {
    const client = type === AIProviderType.OLLAMA_CLOUD
      ? new OllamaCloudProvider("", name, { host, ...credentials })
      : new AnthropicProvider("", name, credentials);
    await client.checkApiKey();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible de joindre le fournisseur." };
  }

  const provider = await prisma.aIProvider.create({
    data: { type, name, configuration },
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
