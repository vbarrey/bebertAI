"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { AIProviderType } from "@prisma/client";

import { ProviderTypeSelector } from "./provider-type-selector";
import { OllamaProviderForm } from "./provider-form/ollama-local";

export function CreateProviderDialog() {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<AIProviderType | null>(null);

  function handleOpenChange(open: boolean) {
    setOpen(open);

    if (!open) {
      setSelectedType(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="outline">
          <Plus className="size-4" />
          Ajouter un fournisseur
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {selectedType
              ? `Configurer ${selectedType}`
              : "Ajouter un fournisseur"}
          </DialogTitle>

          <DialogDescription>
            {selectedType
              ? "Configurez votre fournisseur."
              : "Choisissez le type de fournisseur à ajouter."}
          </DialogDescription>
        </DialogHeader>

        {selectedType === null ? (
          <ProviderTypeSelector onSelect={setSelectedType} />
        ) : (
          <OllamaProviderForm
            onBack={() => setSelectedType(null)}
            onSuccess={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
