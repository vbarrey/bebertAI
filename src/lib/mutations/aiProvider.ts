"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AIProviderSource, AIProviderType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { aiProviderRegistry } from "@/lib/ai/registry";
import { OllamaCloudProvider } from "@/lib/ai/ollama-cloud/provider";
import { AnthropicProvider } from "@/lib/ai/anthropic/provider";
import { VoyageProvider } from "@/lib/ai/voyage/provider";
import { GoogleProvider } from "@/lib/ai/google/provider";
import { OLLAMA_CLOUD_HOST } from "@/lib/ai/ollama-cloud/config";
import { createProviderClient, loadProvider, syncProviderModels } from "@/lib/ai/provider-factory";

const ApiKeyProviderSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis."),
  // Ollama Cloud only.
  host: z.url("Adresse invalide.").trim().default(OLLAMA_CLOUD_HOST),
  apiKey: z.string().trim().min(1, "La clé API est requise."),
  defaultModel: z.string().trim().optional().transform((model) => model || undefined),
});

export type ApiKeyProviderType = typeof AIProviderType.OLLAMA_CLOUD | typeof AIProviderType.ANTHROPIC | typeof AIProviderType.VOYAGE | typeof AIProviderType.GOOGLE;
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
      : type === AIProviderType.ANTHROPIC
        ? new AnthropicProvider("", name, credentials)
        : type === AIProviderType.VOYAGE
          ? new VoyageProvider("", name, credentials)
          : new GoogleProvider("", name, credentials);
    await client.checkApiKey();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible de joindre le fournisseur." };
  }

  // The causes shown in the form: a thrown error only reaches it as a generic failure.
  let provider;
  try {
    provider = await prisma.aIProvider.create({
      // Every provider reached with an API key runs its models remotely.
      data: { type, source: AIProviderSource.REMOTE, name, configuration },
    });
  } catch (error) {
    console.error("Provider creation failed:", error);
    return { error: `Création impossible : ${errorMessage(error)}` };
  }

  try {
    const client = createProviderClient(provider);
    aiProviderRegistry.register(client);
    await syncProviderModels(provider, client);
  } catch (error) {
    console.error("Provider model synchronization failed:", error);
    return { error: `Fournisseur créé, mais ses modèles n'ont pas pu être synchronisés : ${errorMessage(error)}. Réessayez avec « Synchroniser ».` };
  } finally {
    revalidatePath("/settings", "layout");
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

/**
 * A disabled provider is no longer offered by the pipeline settings and the chat model selector, and the
 * steps still set on it fail with a message saying so.
 */
export async function setProviderEnabled(providerId: string, enabled: boolean): Promise<void> {
  await prisma.aIProvider.update({ where: { id: providerId }, data: { enabled } });
  revalidatePath("/", "layout");
}
