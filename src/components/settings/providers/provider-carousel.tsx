"use client";

import { Provider } from "@/types/augmented-prisma";
import { cn } from "@/lib/utils";

import { CreateProviderDialog } from "./create-provider-dialog";
import { ProviderSourceIcon } from "./provider-source-icon";
import { ProviderAvatar } from "./provider-avatar";

type ProviderCarouselProps = {
  providers: Provider[];
  selectedProviderId: string | null;
  onSelectProvider: (providerId: string) => void;
};

export function ProviderCarousel({
  providers,
  selectedProviderId,
  onSelectProvider,
}: ProviderCarouselProps) {
  return (
    <section className="border-b px-8 py-6">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">Fournisseurs</h2>

        <p className="text-xs text-muted-foreground">Modèles et connexions</p>
      </div>

      {/* Scrolled sideways, the scroll snapping lands on a card. */}
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
        {providers.map((provider) => {
          const isSelected = provider.id === selectedProviderId;

          return (
            <button
              key={provider.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectProvider(provider.id)}
              className={cn(
                "flex w-64 shrink-0 snap-start items-center gap-3 rounded-lg border p-4 text-left transition-colors",
                isSelected
                  ? "border-primary/40 bg-muted shadow-sm"
                  : "hover:bg-muted/50",
              )}
            >
              <ProviderAvatar providerId={provider.id} className="shrink-0" />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{provider.name}</span>

                  <ProviderSourceIcon source={provider.source} focusable={false} />
                </div>

                <p className="text-xs text-muted-foreground">
                  {provider.models?.length ?? 0} modèle
                  {provider.models?.length !== 1 ? "s" : ""}
                  {!provider.enabled && " · Désactivé"}
                </p>
              </div>

              <div
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  provider.enabled ? "bg-green-500" : "bg-muted-foreground/30",
                )}
              />
            </button>
          );
        })}

        <div className="flex w-64 shrink-0 snap-start items-center">
          <CreateProviderDialog />
        </div>
      </div>
    </section>
  );
}
