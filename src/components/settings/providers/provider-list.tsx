"use client";

import { Provider } from "@/types/augmented-prisma";
import { Bot } from "lucide-react";

import { CreateProviderDialog } from "./create-provider-dialog";
import { cn } from "@/lib/utils";

type ProviderListProps = {
  providers: Provider[];
  selectedProviderId: string | null;
  onSelectProvider: (providerId: string) => void;
};

export function ProviderList({
  providers,
  selectedProviderId,
  onSelectProvider,
}: ProviderListProps) {
  return (
    <aside className="flex w-72 shrink-0 flex-col w-full min-w-20">
      <div className="flex items-center justify-between border-b px-4 py-4">
        <div>
          <h2 className="text-sm font-semibold">
            Fournisseurs
          </h2>

          <p className="text-xs text-muted-foreground">
            Modèles et connexions
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-1 p-2">
        {providers.map((provider) => {
          const isSelected =
            provider.id === selectedProviderId;

          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => onSelectProvider(provider.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors",
                isSelected
                  ? "bg-muted"
                  : "hover:bg-muted/50",
              )}
            >
              <Bot className="size-4 text-muted-foreground" />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {provider.name}
                  </span>

                  {!provider.enabled && (
                    <span className="text-xs text-muted-foreground">
                      Désactivé
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  {provider.models?.length} modèle
                  {provider.models?.length !== 1 ? "s" : ""}
                </p>
              </div>

              <div
                className={cn(
                  "size-2 rounded-full",
                  provider.enabled
                    ? "bg-green-500"
                    : "bg-muted-foreground/30",
                )}
              />
            </button>
          );
        })}
      </div>

      <div className="border-t p-3">
        <CreateProviderDialog />
      </div>
    </aside>
  );
}