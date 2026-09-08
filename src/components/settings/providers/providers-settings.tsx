"use client";

import { useState } from "react";

import { Provider } from "@/types/augmented-prisma";

import { ProviderList } from "./provider-list";
import { ProviderDetails } from "./provider-details";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

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
    <ResizablePanelGroup>
      <ResizablePanel className="flex" defaultSize="20%">
        <ProviderList
          providers={providers}
          selectedProviderId={selectedProviderId}
          onSelectProvider={setSelectedProviderId}
        />
      </ResizablePanel>
      <ResizableHandle withHandle={true} />
      <ResizablePanel>
        <ScrollArea className="min-w-0 flex-1 h-[100vh]">
          {selectedProvider ? (
            <ProviderDetails provider={selectedProvider} />
          ) : (
            <EmptyProviderState />
          )}
        </ScrollArea>
      </ResizablePanel>
    </ResizablePanelGroup>
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
