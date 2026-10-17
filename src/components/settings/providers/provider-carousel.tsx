"use client";

import { useRef } from "react";
import { Bot, ChevronLeft, ChevronRight } from "lucide-react";

import { Provider } from "@/types/augmented-prisma";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CreateProviderDialog } from "./create-provider-dialog";
import { ProviderSourceIcon } from "./provider-source-icon";

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
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Most of a screen of cards at a time, the scroll snapping lands on a card.
  function scroll(direction: -1 | 1) {
    const track = trackRef.current;
    track?.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <section className="border-b px-8 py-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Fournisseurs</h2>

          <p className="text-xs text-muted-foreground">Modèles et connexions</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => scroll(-1)} aria-label="Fournisseurs précédents">
            <ChevronLeft className="size-4" />
          </Button>

          <Button variant="outline" size="icon" onClick={() => scroll(1)} aria-label="Fournisseurs suivants">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
      >
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
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <Bot className="size-4 text-muted-foreground" />
              </div>

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
