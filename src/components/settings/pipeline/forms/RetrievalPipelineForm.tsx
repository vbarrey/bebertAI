"use client";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useState } from "react";

import type { PipelineParameters } from "@/lib/pipeline/parameters";

type RetrievalParameters = PipelineParameters["retrieval"];

type Props = {
  initialValues: RetrievalParameters;
  onSave: (values: RetrievalParameters) => Promise<void>;
};

export function RetrievalPipelineForm({
  initialValues,
  onSave,
}: Props) {
  const [values, setValues] = useState(initialValues);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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