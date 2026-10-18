"use client";

import { useState } from "react";

import { Provider } from "@/types/augmented-prisma";

import { ProviderCarousel } from "./provider-carousel";
import { ProviderDetails } from "./provider-details";
import { ScrollArea } from "@/components/ui/scroll-area";

type AISettingsProps = {
  providers: Provider[];
};

export function ProvidersSettings({ providers }: AISettingsProps) {
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    providers[0]?.id ?? null,
  );

  const selectedProvider =
    providers.find((provider) => provider.id === selectedProviderId) ?? null;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <ProviderCarousel
        providers={providers}
        selectedProviderId={selectedProviderId}
        onSelectProvider={setSelectedProviderId}
      />

      <ScrollArea className="min-h-0 flex-1">
        {selectedProvider ? (
          // Keyed: the details of another provider start from its own state.
          <ProviderDetails key={selectedProvider.id} provider={selectedProvider} />
        ) : (
          <EmptyProviderState />
        )}
      </ScrollArea>
    </div>
  );
}

function EmptyProviderState() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <h2 className="font-medium">Aucun fournisseur sélectionné</h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Sélectionnez ou ajoutez un fournisseur pour commencer.
        </p>
      </div>
    </div>
  );
}
