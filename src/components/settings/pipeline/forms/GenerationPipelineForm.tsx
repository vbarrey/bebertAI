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
import { Textarea } from "@/components/ui/textarea";

import type { PipelineParameters } from "@/lib/pipeline/parameters";

type GenerationParameters = PipelineParameters["generation"];

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
  initialValues: GenerationParameters;
  providers: readonly Provider[];
  onSave: (values: GenerationParameters) => Promise<void>;
};

export function GenerationPipelineForm({
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
      </Field>

      <Field>
        <FieldLabel htmlFor="pipeline-temperature">
          Température
        </FieldLabel>

        <Input
          id="pipeline-temperature"
          type="number"
          min={0}
          step={0.1}
          value={values.temperature}
          onChange={(event) =>
            setValues({
              ...values,
              temperature: event.target.valueAsNumber,
            })
          }
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="pipeline-max-tokens">
          Nombre maximal de tokens
        </FieldLabel>

        <Input
          id="pipeline-max-tokens"
          type="number"
          min={1}
          step={1}
          value={values.maxTokens}
          onChange={(event) =>
            setValues({
              ...values,
              maxTokens: event.target.valueAsNumber,
            })
          }
        />
      </Field>

      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="pipeline-think">
            Réflexion
          </FieldLabel>

          <FieldDescription>
            Laisse les modèles de raisonnement réfléchir avant de répondre.
            La réflexion est comptée dans le nombre maximal de tokens.
          </FieldDescription>
        </FieldContent>

        <Switch
          id="pipeline-think"
          checked={values.think}
          onCheckedChange={(think) =>
            setValues({
              ...values,
              think,
            })
          }
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="pipeline-system-prompt">
          Prompt système
        </FieldLabel>

        <Textarea
          id="pipeline-system-prompt"
          value={values.systemPrompt}
          onChange={(event) =>
            setValues({
              ...values,
              systemPrompt: event.target.value,
            })
          }
        />

        <FieldDescription>
          Instructions utilisées comme contexte système lors de la génération.
        </FieldDescription>
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