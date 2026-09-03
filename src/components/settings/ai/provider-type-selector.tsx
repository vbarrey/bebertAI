"use client";

import { useState } from "react";

import { AIProviderType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  onSelect: (type: AIProviderType) => void;
};

export function ProviderTypeSelector({
  onSelect,
}: Props) {
  const [type, setType] =
    useState<AIProviderType | null>(null);

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-2">
        <Label>Type de fournisseur</Label>

        <Select
          defaultValue={type ?? undefined}
          onValueChange={(value) =>
            setType(value as AIProviderType)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Choisir un fournisseur" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="OLLAMA">
              Ollama
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end">
        <Button
          disabled={!type}
          onClick={() => {
            if (type) {
              onSelect(type);
            }
          }}
        >
          Continuer
        </Button>
      </div>
    </div>
  );
}