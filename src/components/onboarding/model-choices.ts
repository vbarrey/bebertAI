import type { Capability, Provider } from "@/types/augmented-prisma";

export type ModelChoice = { providerId: string; providerName: string; modelName: string; label: string };

/** The enabled models with the capability, of the enabled providers. */
export function modelChoices(providers: Provider[], capability: Capability): ModelChoice[] {
  return providers
    .filter((provider) => provider.enabled)
    .flatMap((provider) =>
      (provider.models ?? [])
        .filter((model) => model.enabled && model.capabilities?.some((c) => c.name === capability))
        .map((model) => ({
          providerId: provider.id,
          providerName: provider.name,
          modelName: model.name,
          label: model.displayName || model.name,
        })),
    );
}
