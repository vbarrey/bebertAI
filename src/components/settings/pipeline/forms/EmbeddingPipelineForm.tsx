"use client";

import { SaveButton, type SaveStatus } from "@/components/settings/pipeline/SaveButton";
import { useMemo, useState } from "react";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const provider = providers.find(
    (item) => item.id === values.providerId,
  );

  const models = useMemo(
    () => provider?.models ?? [],
    [provider],
  );

  function setProvider(providerId: string) {
    const nextProvider = providers.find(
      (item) => item.id === providerId,
    );

    const currentModelExists = nextProvider?.models.some(
      (model) => model.name === values.modelName,
    );

    setValues({
      ...values,
      providerId,
      modelName: currentModelExists ? values.modelName : "",
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus("saving");
    setError(null);

    try {
      await onSave(values);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setError(
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer les paramètres.",
      );
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Field>
        <FieldLabel>Fournisseur</FieldLabel>

        <Select
          value={values.providerId}
          onValueChange={setProvider}
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
          value={values.modelName}
          onValueChange={(modelName) =>
            setValues({
              ...values,
              modelName,
            })
          }
          disabled={!values.providerId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner un modèle" />
          </SelectTrigger>

          <SelectContent>
            {models.map((model) => (
              <SelectItem key={model.id} value={model.name}>
                {model.displayName ?? model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <FieldDescription>
          Utilisé pour les documents et les questions. Changer de modèle impose de réindexer tous les documents.
        </FieldDescription>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor="pipeline-bm25-k">
            BM25 : saturation (k)
          </FieldLabel>

          <Input
            id="pipeline-bm25-k"
            type="number"
            min={0.1}
            step={0.1}
            value={values.sparse.k}
            onChange={(event) =>
              setValues({ ...values, sparse: { ...values.sparse, k: event.target.valueAsNumber } })
            }
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="pipeline-bm25-b">
            BM25 : longueur (b)
          </FieldLabel>

          <Input
            id="pipeline-bm25-b"
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={values.sparse.b}
            onChange={(event) =>
              setValues({ ...values, sparse: { ...values.sparse, b: event.target.valueAsNumber } })
            }
          />
        </Field>
      </div>

      <FieldDescription>
        Vecteurs lexicaux de la recherche hybride. k : poids d&apos;un mot répété dans un chunk (1,2 par
        défaut). b : pénalité des chunks longs, de 0 (aucune) à 1 (0,75 par défaut).
      </FieldDescription>

      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="pipeline-bm25-ascii-folding">
            Ignorer les accents
          </FieldLabel>

          <FieldDescription>
            « resume » trouve « résumé » dans la recherche lexicale.
          </FieldDescription>
        </FieldContent>

        <Switch
          id="pipeline-bm25-ascii-folding"
          checked={values.sparse.asciiFolding}
          onCheckedChange={(asciiFolding) =>
            setValues({ ...values, sparse: { ...values.sparse, asciiFolding } })
          }
        />
      </Field>

      {error && (
        <p className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <SaveButton status={status} onReset={() => setStatus("idle")} />
      </div>
    </form>
  );
}
