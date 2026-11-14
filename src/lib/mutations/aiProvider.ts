"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AIProviderSource, AIProviderType, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { OllamaCloudProvider } from "@/lib/ai/ollama-cloud/provider";
import { AnthropicProvider } from "@/lib/ai/anthropic/provider";
import { VoyageProvider } from "@/lib/ai/voyage/provider";
import { GoogleProvider } from "@/lib/ai/google/provider";
import { OLLAMA_CLOUD_HOST } from "@/lib/ai/ollama-cloud/config";
import { createProviderClient, syncProviderModels } from "@/lib/ai/provider-factory";
import { requireUser } from "@/lib/session";
import { encryptApiKey, manageableProviders } from "@/lib/ai/provider-access";
import { removeProvider } from "@/lib/ai/provider-removal";

const NameSchema = z.string().trim().min(1, "Le nom est requis.").max(100, "Nom trop long (100 caractères au plus).");
// Optional: an empty comment is stored as null.
const DescriptionSchema = z.string().trim().max(500, "Commentaire trop long (500 caractères au plus).").optional()
  .transform((description) => description || null);

const ApiKeyProviderSchema = z.object({
  name: NameSchema,
  description: DescriptionSchema,
  // Ollama Cloud only.
  host: z.url("Adresse invalide.").trim().default(OLLAMA_CLOUD_HOST),
  apiKey: z.string().trim().min(1, "La clé API est requise."),
  defaultModel: z.string().trim().optional().transform((model) => model || undefined),
});

const API_KEY_PROVIDER_TYPES = [AIProviderType.OLLAMA_CLOUD, AIProviderType.ANTHROPIC, AIProviderType.VOYAGE, AIProviderType.GOOGLE] as const;

export type ApiKeyProviderType = (typeof API_KEY_PROVIDER_TYPES)[number];
export type CreateApiKeyProviderInput = z.input<typeof ApiKeyProviderSchema>;

/**
 * Creates a provider reached with an API key once the key is accepted, then stores its models.
 */
export async function createApiKeyProvider(
  type: ApiKeyProviderType,
  input: CreateApiKeyProviderInput,
): Promise<{ error: string } | undefined> {
  const user = await requireUser();
  // A server action takes any value: only the provider types reached with an API key are created here.
  if (!API_KEY_PROVIDER_TYPES.includes(type)) {
    return { error: "Ce type de fournisseur ne peut pas être créé." };
  }

  const parsed = ApiKeyProviderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(" ") };
  }

  const { name, description, host, ...credentials } = parsed.data;
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
      data: { userId: user.id, type, source: AIProviderSource.REMOTE, name, description, configuration: encryptApiKey(configuration) },
    });
  } catch (error) {
    // The database error repeats the data sent, the API key included: it stays in the server logs.
    console.error("Provider creation failed:", error);
    return { error: "Création impossible : le fournisseur n'a pas pu être enregistré (détail dans les journaux du serveur)." };
  }

  try {
    await syncProviderModels(provider, createProviderClient(provider));
  } catch (error) {
    console.error("Provider model synchronization failed:", error);
    return { error: `Fournisseur créé, mais ses modèles n'ont pas pu être synchronisés : ${errorMessage(error)}. Réessayez avec « Synchroniser ».` };
  } finally {
    revalidatePath("/settings", "layout");
    // The welcome page lists the provider too, with its « Synchroniser » button when its models failed.
    revalidatePath("/bienvenue");
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Lists the models of the provider again, with whether they need usage credits.
 */
export async function synchronizeProviderModels(providerId: string): Promise<{ error: string } | undefined> {
  const user = await requireUser();
  const provider = await prisma.aIProvider.findFirst({ where: { id: providerId, ...manageableProviders(user) } });
  if (!provider) {
    return { error: "Fournisseur introuvable." };
  }

  try {
    await syncProviderModels(provider, createProviderClient(provider));
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
  const user = await requireUser();
  await prisma.aIProvider.updateMany({ where: { id: providerId, ...manageableProviders(user) }, data: { enabled } });
  revalidatePath("/", "layout");
}

const ProviderDetailsSchema = z.object({
  name: NameSchema,
  description: DescriptionSchema,
  // Empty: the stored key is kept.
  apiKey: z.string().trim().optional().transform((apiKey) => apiKey || undefined),
});

/**
 * Renames a provider of the user, changes the comment that tells it apart, or replaces its API key once the
 * provider accepts the new one.
 */
export async function updateProviderDetails(
  providerId: string,
  input: z.input<typeof ProviderDetailsSchema>,
): Promise<{ error: string } | undefined> {
  const user = await requireUser();
  const parsed = ProviderDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(" ") };
  }

  const provider = await prisma.aIProvider.findFirst({ where: { id: providerId, ...manageableProviders(user) } });
  if (!provider) {
    return { error: "Fournisseur introuvable." };
  }

  const { apiKey, ...details } = parsed.data;
  let configuration: Prisma.InputJsonValue | undefined;
  if (apiKey) {
    const stored = provider.configuration as Prisma.JsonObject;
    try {
      // A key without the "enc:" mark reaches the client as it is.
      await createProviderClient({ ...provider, configuration: { ...stored, apiKey } }).checkApiKey();
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Impossible de joindre le fournisseur." };
    }
    configuration = encryptApiKey({ ...stored, apiKey });
  }

  await prisma.aIProvider.update({ where: { id: provider.id }, data: { ...details, configuration } });
  // Its name shows in the settings, the welcome page, the setup warning and the chat model selector.
  revalidatePath("/", "layout");
}

/** Deletes a provider of the user with its models; the pipeline steps on it are to be chosen again. */
export async function deleteProvider(providerId: string): Promise<{ error: string } | undefined> {
  const user = await requireUser();
  if (!(await removeProvider(user.id, providerId))) {
    return { error: "Fournisseur introuvable." };
  }
  revalidatePath("/", "layout");
}
