"use client";

import { SaveButton, type SaveStatus } from "@/components/settings/pipeline/SaveButton";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

import type { PipelineParameters } from "@/lib/pipeline/parameters";

type RetrievalParameters = PipelineParameters["retrieval"];

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
  initialValues: RetrievalParameters;
  providers: readonly Provider[];
  onSave: (values: RetrievalParameters) => Promise<void>;
};

// Select value of the default: an empty translation model means the conversation model.
const CONVERSATION_MODEL = "conversation";
const SEPARATOR = "|";

export function RetrievalPipelineForm({
  initialValues,
  providers,
  onSave,
}: Props) {
  const [values, setValues] = useState(initialValues);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const { translation } = values.hybrid;
  const translationValue = translation.providerId && translation.modelName
    ? `${translation.providerId}${SEPARATOR}${translation.modelName}`
    : CONVERSATION_MODEL;

  function setTranslation(value: string) {
    // Provider ids never hold the separator, model names (qwen3:0.6b) may hold other punctuation.
    const index = value.indexOf(SEPARATOR);
    const next = value === CONVERSATION_MODEL
      ? { providerId: "", modelName: "" }
      : { providerId: value.slice(0, index), modelName: value.slice(index + SEPARATOR.length) };

    setValues({ ...values, hybrid: { ...values.hybrid, translation: next } });
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
        <FieldLabel htmlFor="pipeline-top-k">
          Nombre de résultats
        </FieldLabel>

        <Input
          id="pipeline-top-k"
          type="number"
          min={1}
          step={1}
          value={values.topK}
          onChange={(event) =>
            setValues({
              ...values,
              topK: event.target.valueAsNumber,
            })
          }
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="pipeline-score-threshold">
          Seuil de score
        </FieldLabel>

        <Input
          id="pipeline-score-threshold"
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={values.scoreThreshold}
          onChange={(event) =>
            setValues({
              ...values,
              scoreThreshold: event.target.valueAsNumber,
            })
          }
        />

        <FieldDescription>
          Score minimal requis pour conserver un résultat.
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor="pipeline-neighbor-chunks">
          Chunks voisins
        </FieldLabel>

        <Input
          id="pipeline-neighbor-chunks"
          type="number"
          min={0}
          max={5}
          step={1}
          value={values.neighborChunks}
          onChange={(event) =>
            setValues({
              ...values,
              neighborChunks: event.target.valueAsNumber,
            })
          }
        />

        <FieldDescription>
          Nombre de chunks ajoutés avant et après chaque résultat, pour que le
          modèle lise la suite d&apos;une liste ou d&apos;un paragraphe coupé.
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel>Modèle de traduction</FieldLabel>

        <Select value={translationValue} onValueChange={setTranslation}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value={CONVERSATION_MODEL}>
              Modèle de la conversation
            </SelectItem>

            {providers.map((provider) => (
              <SelectGroup key={provider.id}>
                <SelectSeparator />
                <SelectLabel>{provider.name}</SelectLabel>

                {provider.models.map((model) => (
                  <SelectItem key={model.id} value={`${provider.id}${SEPARATOR}${model.name}`}>
                    {model.displayName ?? model.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        <FieldDescription>
          Traduit la question en français, anglais, russe et allemand pour la recherche lexicale. Un petit
          modèle multilingue suffit, mais s&apos;il ne tient pas en mémoire à côté du modèle de conversation,
          Ollama recharge ce dernier à chaque question.
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