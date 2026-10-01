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

type ChunkingParameters = PipelineParameters["chunking"];

type Props = {
  initialValues: ChunkingParameters;
  onSave: (values: ChunkingParameters) => Promise<void>;
};

export function ChunkingPipelineForm({
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
        <FieldLabel htmlFor="pipeline-chunk-size">
          Taille des segments
        </FieldLabel>

        <Input
          id="pipeline-chunk-size"
          type="number"
          min={1}
          step={1}
          value={values.chunkSize}
          onChange={(event) =>
            setValues({
              ...values,
              chunkSize: event.target.valueAsNumber,
            })
          }
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="pipeline-chunk-overlap">
          Chevauchement des segments
        </FieldLabel>

        <Input
          id="pipeline-chunk-overlap"
          type="number"
          min={0}
          step={1}
          value={values.chunkOverlap}
          onChange={(event) =>
            setValues({
              ...values,
              chunkOverlap: event.target.valueAsNumber,
            })
          }
        />

        <FieldDescription>
          Doit rester inférieur à la taille des segments.
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