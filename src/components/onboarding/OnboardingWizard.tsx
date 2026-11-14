"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TruncatedText } from "@/components/ui/truncated-text";
import { capabilityLabels } from "@/components/settings/providers/model-list-item";
import { ProviderTypeSelector } from "@/components/settings/providers/provider-type-selector";
import { ApiKeyProviderForm } from "@/components/settings/providers/provider-form/api-key-provider";
import { ProviderInfoDialog } from "@/components/settings/providers/provider-info-dialog";

import type { ApiKeyProviderType } from "@/lib/mutations/aiProvider";
import { synchronizeProviderModels } from "@/lib/mutations/aiProvider";
import { finishOnboarding, postponeOnboarding } from "@/lib/mutations/onboarding";
import type { Provider } from "@/types/augmented-prisma";

import { modelChoices, type ModelChoice } from "./model-choices";

const choiceKey = (choice: ModelChoice) => `${choice.providerId}/${choice.modelName}`;

// The capabilities the enabled models of a provider bring.
const providerCapabilities = (provider: Provider) => [
  ...new Set(
    (provider.models ?? [])
      .filter((model) => model.enabled)
      .flatMap((model) => model.capabilities?.map((capability) => capability.name) ?? []),
  ),
];

export function OnboardingWizard({ providers }: { providers: Provider[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Adding a provider: null while closed, "select" while the type is chosen, then the form of the type.
  const [adding, setAdding] = useState<ApiKeyProviderType | "select" | null>(null);
  const [synchronizing, setSynchronizing] = useState<string | null>(null);

  const generationChoices = modelChoices(providers, "GENERATION");
  const embeddingChoices = modelChoices(providers, "EMBEDDING");
  const [generationKey, setGenerationKey] = useState<string>();
  const [embeddingKey, setEmbeddingKey] = useState<string>();
  // The first model of each list is preselected, also once the list fills after an addition.
  const generation = generationChoices.find((choice) => choiceKey(choice) === generationKey) ?? generationChoices[0];
  const embedding = embeddingChoices.find((choice) => choiceKey(choice) === embeddingKey) ?? embeddingChoices[0];

  const [error, setError] = useState<string>();

  async function synchronize(providerId: string) {
    setSynchronizing(providerId);
    try {
      const result = await synchronizeProviderModels(providerId);

      if (result?.error) toast.error(result.error);
      else router.refresh();
    } catch {
      toast.error("Impossible de synchroniser les modèles.");
    } finally {
      setSynchronizing(null);
    }
  }

  function start() {
    if (!generation || !embedding) return;

    setError(undefined);
    startTransition(async () => {
      const result = await finishOnboarding({
        generation: { providerId: generation.providerId, modelName: generation.modelName },
        embedding: { providerId: embedding.providerId, modelName: embedding.modelName },
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <TooltipProvider>
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Bienvenue</CardTitle>

          <CardDescription>
            Bebert AI s&apos;appuie sur des fournisseurs d&apos;IA : ajoutez vos clés API, puis choisissez le modèle qui
            répond à vos questions et celui qui indexe vos documents.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-sm font-medium">Vos fournisseurs</h2>

            {providers.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {providers.map((provider) => {
                  const capabilities = providerCapabilities(provider);

                  return (
                    <li key={provider.id} className="flex flex-wrap items-center gap-2 p-3">
                      <div className="min-w-0 flex-1">
                        <TruncatedText className="text-sm">{provider.name}</TruncatedText>
                        {provider.description && (
                          <TruncatedText className="text-xs text-muted-foreground">{provider.description}</TruncatedText>
                        )}
                      </div>

                      {provider.models?.length ? (
                        capabilities.map((capability) => (
                          <Badge key={capability} variant="secondary">
                            {capabilityLabels[capability]}
                          </Badge>
                        ))
                      ) : (
                        <>
                          <span className="text-xs text-muted-foreground">Aucun modèle</span>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => synchronize(provider.id)}
                            disabled={synchronizing !== null}
                          >
                            {synchronizing === provider.id ? <Spinner /> : <RefreshCw className="size-4" />}
                            Synchroniser
                          </Button>
                        </>
                      )}

                      <ProviderInfoDialog provider={provider}>
                        <Button size="icon-sm" variant="ghost" aria-label={`Détails de « ${provider.name} »`}>
                          <Pencil className="size-4" />
                        </Button>
                      </ProviderInfoDialog>
                    </li>
                  );
                })}
              </ul>
            )}

            {adding === null && (
              <Button className="w-full" variant="outline" onClick={() => setAdding("select")}>
                <Plus className="size-4" />
                Ajouter un fournisseur
              </Button>
            )}

            {adding === "select" && <ProviderTypeSelector onSelect={setAdding} />}

            {adding !== null && adding !== "select" && (
              <div className="rounded-lg border p-4">
                <ApiKeyProviderForm
                  key={adding}
                  type={adding}
                  onBack={() => setAdding("select")}
                  onSuccess={() => {
                    setAdding(null);
                    router.refresh();
                  }}
                />
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-medium">Vos modèles</h2>

            <ModelSelect
              id="generation-model"
              label="Génération"
              empty="Ajoutez Anthropic ou Ollama Cloud pour la génération."
              choices={generationChoices}
              value={generation}
              onChange={setGenerationKey}
            />

            <ModelSelect
              id="embedding-model"
              label="Embedding"
              empty="Ajoutez Voyage AI ou Google Gemini pour l'embedding."
              choices={embeddingChoices}
              value={embedding}
              onChange={setEmbeddingKey}
            />
          </section>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>

        <CardFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            className="w-full sm:w-auto"
            disabled={pending}
            onClick={() => startTransition(() => postponeOnboarding())}
          >
            Configurer plus tard
          </Button>

          <Button className="w-full sm:w-auto" disabled={pending || !generation || !embedding} onClick={start}>
            {pending && <Spinner />}
            Commencer
          </Button>
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
}

type ModelSelectProps = {
  id: string;
  label: string;
  empty: string;
  choices: ModelChoice[];
  value: ModelChoice | undefined;
  onChange: (key: string) => void;
};

function ModelSelect({ id, label, empty, choices, value, onChange }: ModelSelectProps) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>

      <Select value={value ? choiceKey(value) : ""} onValueChange={onChange} disabled={choices.length === 0}>
        <SelectTrigger id={id} className="w-full min-w-0">
          <SelectValue placeholder="Aucun modèle">{value?.label}</SelectValue>
        </SelectTrigger>

        <SelectContent>
          {choices.map((choice) => (
            <SelectItem key={choiceKey(choice)} value={choiceKey(choice)}>
              {choice.label}
              <span className="text-muted-foreground">{choice.providerName}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {choices.length === 0 && <FieldDescription>{empty}</FieldDescription>}
    </Field>
  );
}
