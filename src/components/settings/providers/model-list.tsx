"use client";

import { useState } from "react";
import { Search, Star } from "lucide-react";

import { Capability, Model } from "@/types/augmented-prisma";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";

import { ModelListItem, capabilityLabels } from "./model-list-item";

type ModelListProps = {
  models: Model[];
  removable: boolean;
  // False: the models are shown without their controls.
  manageable: boolean;
};

export function ModelList({ models, removable, manageable }: ModelListProps) {
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  if (models.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Aucun modèle synchronisé.
        </p>
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  // A model shown has every capability picked, and the search in its name or its display name.
  const shownModels = models
    .filter(
      (model) =>
        (!favoritesOnly || model.favorite) &&
        (!query || [model.name, model.displayName].some((name) => name?.toLowerCase().includes(query))) &&
        capabilities.every((capability) => model.capabilities?.some((item) => item.name === capability)),
    )
    .sort((a, b) => costRank(a) - costRank(b) || a.name.localeCompare(b.name));

  function toggleCapability(capability: Capability) {
    setCapabilities((current) =>
      current.includes(capability) ? current.filter((item) => item !== capability) : [...current, capability],
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="min-w-48 flex-1">
          <InputGroupAddon>
            <Search className="size-4" />
          </InputGroupAddon>

          <InputGroupInput
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un modèle"
            aria-label="Rechercher un modèle par son nom"
          />
        </InputGroup>

        <Button
          variant={favoritesOnly ? "default" : "outline"}
          size="icon-sm"
          aria-pressed={favoritesOnly}
          aria-label="Favoris uniquement"
          onClick={() => setFavoritesOnly(!favoritesOnly)}
        >
          <Star className={favoritesOnly ? "fill-current" : undefined} />
        </Button>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par capacité">
          {Object.values(Capability).map((capability) => {
            const active = capabilities.includes(capability);

            return (
              <Button
                key={capability}
                variant={active ? "default" : "outline"}
                size="sm"
                aria-pressed={active}
                onClick={() => toggleCapability(capability)}
              >
                {capabilityLabels[capability]}
              </Button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {shownModels.length} modèle{shownModels.length !== 1 ? "s" : ""} sur {models.length}
      </p>

      <ScrollArea className="p-3 h-[56vh] border rounded-lg">
        {shownModels.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Aucun modèle ne correspond à la recherche.
          </p>
        ) : (
          shownModels.map((model) => (
            <ModelListItem
              key={model.id}
              model={model}
              removable={removable}
              manageable={manageable}
              expanded={expandedModelId === model.id}
              onExpandedChange={(expanded) => {
                setExpandedModelId(expanded ? model.id : null);
              }}
            />
          ))
        )}
      </ScrollArea>
    </div>
  );
}

// The free models first, then the paid ones, then the ones whose cost is unknown.
function costRank(model: Model): number {
  return model.requiresCredits === false ? 0 : model.requiresCredits ? 1 : 2;
}
