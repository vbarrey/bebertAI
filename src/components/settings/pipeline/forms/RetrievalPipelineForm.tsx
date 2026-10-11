"use client";

import { SaveButton, type SaveStatus } from "@/components/settings/pipeline/SaveButton";
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

  const { hybrid } = values;
  const { translation } = hybrid;

  function setHybrid(patch: Partial<RetrievalParameters["hybrid"]>) {
    setValues({ ...values, hybrid: { ...hybrid, ...patch } });
  }
  const translationValue = translation.providerId && translation.modelName
    ? `${translation.providerId}${SEPARATOR}${translation.modelName}`
    : CONVERSATION_MODEL;

  function setTranslation(value: string) {
    // Provider ids never hold the separator, model names (qwen3:0.6b) may hold other punctuation.
    const index = value.indexOf(SEPARATOR);
    const next = value === CONVERSATION_MODEL
      ? { providerId: "", modelName: "" }
      : { providerId: value.slice(0, index), modelName: value.slice(index + SEPARATOR.length) };

    setHybrid({ translation: next });
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
          Seuil sémantique
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
          Similarité minimale d&apos;un résultat de la recherche sémantique. Les résultats de la recherche
          lexicale n&apos;y sont pas soumis.
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

      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="pipeline-hybrid">
            Recherche hybride
          </FieldLabel>

          <FieldDescription>
            Ajoute à la recherche sémantique une recherche lexicale (BM25) sur les mots de la question,
            traduite dans chaque langue des documents. Retrouve les références, noms et termes exacts.
          </FieldDescription>
        </FieldContent>

        <Switch
          id="pipeline-hybrid"
          checked={hybrid.enabled}
          onCheckedChange={(enabled) => setHybrid({ enabled })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor="pipeline-dense-limit">
            Candidats sémantiques
          </FieldLabel>

          <Input
            id="pipeline-dense-limit"
            type="number"
            min={1}
            step={1}
            disabled={!hybrid.enabled}
            value={hybrid.denseLimit}
            onChange={(event) => setHybrid({ denseLimit: event.target.valueAsNumber })}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="pipeline-sparse-limit">
            Candidats lexicaux
          </FieldLabel>

          <Input
            id="pipeline-sparse-limit"
            type="number"
            min={1}
            step={1}
            disabled={!hybrid.enabled}
            value={hybrid.sparseLimit}
            onChange={(event) => setHybrid({ sparseLimit: event.target.valueAsNumber })}
          />
        </Field>
      </div>

      <FieldDescription>
        Résultats de chaque recherche avant la fusion, qui garde les meilleurs selon le nombre de résultats.
      </FieldDescription>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor="pipeline-sparse-weight">
            Poids lexical
          </FieldLabel>

          <Input
            id="pipeline-sparse-weight"
            type="number"
            min={0}
            step={0.1}
            disabled={!hybrid.enabled}
            value={hybrid.sparseWeight}
            onChange={(event) => setHybrid({ sparseWeight: event.target.valueAsNumber })}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="pipeline-rrf-k">
            Constante RRF (k)
          </FieldLabel>

          <Input
            id="pipeline-rrf-k"
            type="number"
            min={1}
            step={1}
            disabled={!hybrid.enabled}
            value={hybrid.rrfK}
            onChange={(event) => setHybrid({ rrfK: event.target.valueAsNumber })}
          />
        </Field>
      </div>

      <FieldDescription>
        Poids de la recherche lexicale dans la fusion, la recherche sémantique pesant 1 (0 la désactive).
        Plus k est petit, plus les premiers résultats de chaque recherche l&apos;emportent.
      </FieldDescription>

      <Field>
        <FieldLabel>Modèle de traduction</FieldLabel>

        <Select value={translationValue} onValueChange={setTranslation} disabled={!hybrid.enabled}>
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