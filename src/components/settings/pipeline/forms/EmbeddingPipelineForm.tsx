"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { PipelineParameters } from "@/lib/pipeline/parameters";

type EmbeddingParameters = PipelineParameters["embedding"];

type Provider = {
  id: string;
  name: string;
  models: {
    id: string;
    name: string;
    displayName: string | null;
  }[];
};

type Props = {
  initialValues: EmbeddingParameters;
  providers: readonly Provider[];
  onSave: (values: EmbeddingParameters) => Promise<void>;
};

export function EmbeddingPipelineForm({
  initialValues,
  providers,
  onSave,
}: Props) {
  const [values, setValues] = useState(initialValues);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const documentProvider = providers.find(
    (provider) => provider.id === values.document.providerId,
  );

  const requestProvider = providers.find(
    (provider) => provider.id === values.request.providerId,
  );

  const documentModels = useMemo(
    () => documentProvider?.models ?? [],
    [documentProvider],
  );

  const requestModels = useMemo(
    () => requestProvider?.models ?? [],
    [requestProvider],
  );

  function setDocumentProvider(providerId: string) {
    const provider = providers.find(
      (item) => item.id === providerId,
    );

    const currentModelExists = provider?.models.some(
      (model) => model.id === values.document.modelName,
    );

    setValues({
      ...values,
      document: {
        ...values.document,
        providerId,
        modelName: currentModelExists
          ? values.document.modelName
          : "",
      },
    });
  }

  function setRequestProvider(providerId: string) {
    const provider = providers.find(
      (item) => item.id === providerId,
    );

    const currentModelExists = provider?.models.some(
      (model) => model.name === values.request.modelName,
    );

    setValues({
      ...values,
      request: {
        ...values.request,
        providerId,
        modelName: currentModelExists
          ? values.request.modelName
          : "",
      },
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setError(null);

    try {
      await onSave(values);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer les paramètres.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-medium">
            Embedding des documents
          </h3>

          <p className="text-sm text-muted-foreground">
            Modèle utilisé pour vectoriser les documents.
          </p>
        </div>

        <Field>
          <FieldLabel>Fournisseur</FieldLabel>

          <Select
            value={values.document.providerId}
            onValueChange={setDocumentProvider}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un fournisseur" />
            </SelectTrigger>

            <SelectContent>
              {providers.map((provider) => (
                <SelectItem
                  key={provider.id}
                  value={provider.id}
                >
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Modèle</FieldLabel>

          <Select
            value={values.document.modelName}
            onValueChange={(modelName) =>
              setValues({
                ...values,
                document: {
                  ...values.document,
                  modelName,
                },
              })
            }
            disabled={!values.document.providerId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un modèle" />
            </SelectTrigger>

            <SelectContent>
              {documentModels.map((model) => (
                <SelectItem key={model.id} value={model.name}>
                  {model.displayName ?? model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-medium">
            Embedding des requêtes
          </h3>

          <p className="text-sm text-muted-foreground">
            Modèle utilisé pour vectoriser les questions utilisateur.
          </p>
        </div>

        <Field>
          <FieldLabel>Fournisseur</FieldLabel>

          <Select
            value={values.request.providerId}
            onValueChange={setRequestProvider}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un fournisseur" />
            </SelectTrigger>

            <SelectContent>
              {providers.map((provider) => (
                <SelectItem
                  key={provider.id}
                  value={provider.id}
                >
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Modèle</FieldLabel>

          <Select
            value={values.request.modelName}
            onValueChange={(modelName) =>
              setValues({
                ...values,
                request: {
                  ...values.request,
                  modelName,
                },
              })
            }
            disabled={!values.request.providerId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un modèle" />
            </SelectTrigger>

            <SelectContent>
              {requestModels.map((model) => (
                <SelectItem key={model.id} value={model.name}>
                  {model.displayName ?? model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </section>

      {error && (
        <p className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}