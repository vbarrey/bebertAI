"use client";

import { Provider } from "@/types/augmented-prisma";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { ModelList } from "./model-list";

import { Prisma } from "@prisma/client";

import { toast } from "sonner";

import { setProviderEnabled, synchronizeProviderModels } from "@/lib/mutations/aiProvider";

import { ProviderConfigurationCard } from "./provider-config-card";
import { ProviderSourceIcon } from "./provider-source-icon";

type ProviderDetailsProps = {
  provider: Provider;
};

export function ProviderDetails({ provider }: ProviderDetailsProps) {
  const [isRefreshing, setRefreshing] = useState<boolean>(false);
  const [configuration, setConfiguration] = useState<Prisma.JsonValue>(provider.configuration);

  const refreshProviderModels = async () => {
    setRefreshing(true);
    try {
      const result = await synchronizeProviderModels(provider.id);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Modèles synchronisés.");
      }
    } catch {
      toast.error("Synchronisation impossible.");
    } finally {
      setRefreshing(false);
    }
  };

  const [enabled, setEnabled] = useState(provider.enabled);

  // Shown at once, put back when the change fails.
  const handleEnableSwitchChange = async (next: boolean) => {
    setEnabled(next);
    try {
      await setProviderEnabled(provider.id, next);
    } catch {
      setEnabled(!next);
      toast.error("Impossible de modifier l'activation du fournisseur.");
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-8">
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {provider.name}

          <ProviderSourceIcon source={provider.source} className="[&_svg]:size-5" />
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Configuration du fournisseur et des modèles disponibles.
        </p>
      </header>

      <section>
        <h2 className="text-sm font-medium">Configuration</h2>

        <div className="flex w-full gap-4 flex-col">
          <Card className="mt-4">
            <CardHeader>
              <div className="flex items-center justify-between gap-6">
                <div className="space-y-1">
                  <CardTitle className="text-sm">Fournisseur activé</CardTitle>

                  <CardDescription>
                    Autoriser l&apos;utilisation de ce fournisseur.
                  </CardDescription>
                </div>

                <Switch
                  checked={enabled}
                  onCheckedChange={handleEnableSwitchChange}
                />
              </div>
            </CardHeader>
          </Card>

          <ProviderConfigurationCard configuration={configuration} onConfigurationChange={setConfiguration}/>
        </div>
      </section>

      <Separator className="my-8" />

      <section>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium">Modèles</h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Modèles disponibles pour {provider.name}.
            </p>
          </div>

          <Button variant="outline" size="lg" onClick={refreshProviderModels} disabled={isRefreshing}>
            <RefreshSpinnerCustom isRefreshing={isRefreshing} />
            Synchroniser
          </Button>
        </div>

        <div className="mt-4">
          {/* A remote provider lists the models it serves: they cannot be deleted. */}
          <ModelList models={provider.models ?? []} removable={provider.source === "LOCAL"} />
        </div>
      </section>
    </div>
  );
}

function RefreshSpinner({
  className,
  spin,
  ...props
}: React.ComponentProps<"svg"> & { spin: boolean }) {
  return (
    <RefreshCw
      role="status"
      aria-label="Refreshing"
      className={cn("size-4", className, spin ? "animate-spin" : "")}
      {...props}
    />
  );
}

function RefreshSpinnerCustom(props: { isRefreshing: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <RefreshSpinner spin={props.isRefreshing} />
    </div>
  );
}
