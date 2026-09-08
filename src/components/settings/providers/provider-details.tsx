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

import { ProviderConfigurationCard } from "./provider-config-card";

type ProviderDetailsProps = {
  provider: Provider;
};

export function ProviderDetails({ provider }: ProviderDetailsProps) {
  const [isRefreshing, setRefreshing] = useState<boolean>(false);
  const [configuration, setConfiguration] = useState<Prisma.JsonValue>(provider.configuration);

  const refreshProviderModels = async () => {
    setRefreshing(true);
    await new Promise<void>((resolve) => {
      setTimeout(
        () => {
          resolve();
        },
        1000 * (Math.random() * 5),
      );
    }); // TODO : make api fetch
    setRefreshing(false);
  };

  const handleEnableSwitchChange = async (enabled: boolean) => {
    console.log("Provider enbaled =>", enabled); // TODO : make api fetch
  };

  return (
    <div className="mx-auto max-w-4xl p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {provider.name}
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
                  checked={provider.enabled}
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

          <Button variant="outline" size="lg" onClick={refreshProviderModels}>
            <RefreshSpinnerCustom isRefreshing={isRefreshing} />
            Synchroniser
          </Button>
        </div>

        <div className="mt-4">
          <ModelList models={provider.models ?? []} />
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
