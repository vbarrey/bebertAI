

import { Model } from "@/types/augmented-prisma";

import { ModelListItem } from "./model-list-item";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

type ModelListProps = {
  models: Model[];
};

export function ModelList({ models }: ModelListProps) {
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null);

  if (models.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Aucun modèle synchronisé.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="p-3 h-[56vh] border rounded-lg">
      {models.map((model) => (
        <ModelListItem
          key={model.id}
          model={model}
          expanded={expandedModelId === model.id}
          onExpandedChange={(expanded) => {
            setExpandedModelId(expanded ? model.id : null);
          }}
        />
      ))}
    </ScrollArea>
  );
}
