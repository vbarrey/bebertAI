"use client";

import { useRef, useState } from "react";
import { FileJson, Pencil, Upload } from "lucide-react";
import type { Prisma } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ProviderConfigurationCardProps = {
  configuration: Prisma.JsonValue | null;
  onConfigurationChange: (configuration: Prisma.JsonValue) => void;
};

export function ProviderConfigurationCard({
  configuration,
  onConfigurationChange,
}: ProviderConfigurationCardProps) {
  const [open, setOpen] = useState(false);

  const [configurationValue, setConfigurationValue] = useState(
    formatConfiguration(configuration),
  );

  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleOpenChange(open: boolean) {
    setOpen(open);

    if (open) {
      setConfigurationValue(formatConfiguration(configuration));

      setError(null);
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const content = await file.text();

      const parsedConfiguration = JSON.parse(content);

      setConfigurationValue(JSON.stringify(parsedConfiguration, null, 2));

      setError(null);
    } catch {
      setError("Le fichier sélectionné ne contient pas un JSON valide.");
    } finally {
      event.target.value = "";
    }
  }

  function handleSave() {
    try {
      const parsedConfiguration = JSON.parse(
        configurationValue,
      ) as Prisma.JsonValue;

      console.log("Provider configuration:", parsedConfiguration);

      // TODO: Appel API / mutation

      setError(null);
      setOpen(false);
      onConfigurationChange(parsedConfiguration);
    } catch (error) {
        console.log(error)
      if (typeof error == "object" && error instanceof SyntaxError)
        setError(`La configuration JSON est invalide. ${error.cause}`);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-sm">Configuration</CardTitle>

            <CardDescription>
              Paramètres utilisés pour configurer ce fournisseur.
            </CardDescription>
          </div>

          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Pencil className="size-3.5" />
            Modifier
          </Button>
        </CardHeader>

        <CardContent>
          <ConfigurationDisplay configuration={configuration} />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configuration du fournisseur</DialogTitle>

            <DialogDescription>
              Modifiez directement la configuration ou importez un fichier JSON.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="provider-configuration">Configuration JSON</Label>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleImportClick}
              >
                <Upload className="size-3.5" />
                Importer
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <Textarea
              id="provider-configuration"
              value={configurationValue}
              onChange={(event) => {
                setConfigurationValue(event.target.value);
                setError(null);
              }}
              className="min-h-80 resize-none font-mono text-xs"
              spellCheck={false}
            />

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>

            <Button onClick={handleSave}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type ConfigurationDisplayProps = {
  configuration: Prisma.JsonValue | null;
};

function ConfigurationDisplay({ configuration }: ConfigurationDisplayProps) {
  if (configuration === null) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <FileJson className="mb-3 size-8 text-muted-foreground" />

        <p className="text-sm text-muted-foreground">
          Aucune configuration définie.
        </p>
      </div>
    );
  }

  if (typeof configuration === "object" && !Array.isArray(configuration)) {
    const entries = Object.entries(configuration);

    return (
      <div className="divide-y rounded-lg border">
        {entries.map(([key, value]) => (
          <ConfigurationItem
            key={key}
            label={formatKey(key)}
            value={value ?? {}}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <ConfigurationValue value={configuration} />
    </div>
  );
}

type ConfigurationItemProps = {
  label: string;
  value: Prisma.JsonValue;
};

function ConfigurationItem({ label, value }: ConfigurationItemProps) {
  return (
    <div className="flex items-center justify-between gap-6 px-4 py-3">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>

      <ConfigurationValue value={value} />
    </div>
  );
}

function ConfigurationValue({ value }: { value: Prisma.JsonValue }) {
  if (value === null) {
    return <span className="text-sm text-muted-foreground">Non défini</span>;
  }

  if (typeof value === "boolean") {
    return (
      <span className="text-sm font-medium">
        {value ? "Activé" : "Désactivé"}
      </span>
    );
  }

  if (typeof value === "string" || typeof value === "number") {
    return (
      <span className="max-w-md truncate text-right font-mono text-sm">
        {String(value)}
      </span>
    );
  }

  return (
    <span className="max-w-md truncate text-right font-mono text-xs text-muted-foreground">
      {JSON.stringify(value)}
    </span>
  );
}

function formatConfiguration(configuration: Prisma.JsonValue | null) {
  return JSON.stringify(configuration ?? {}, null, 2);
}

function formatKey(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}
