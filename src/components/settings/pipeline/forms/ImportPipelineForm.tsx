"use client";

import { SaveButton, type SaveStatus } from "@/components/settings/pipeline/SaveButton";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useState } from "react";

import type { PipelineParameters } from "@/lib/pipeline/parameters";

type ImportParameters = PipelineParameters["import"];

type Props = {
  initialValues: ImportParameters;
  onSave: (values: ImportParameters) => Promise<void>;
};

export function ImportPipelineForm({
  initialValues,
  onSave,
}: Props) {
  const [values, setValues] = useState(initialValues);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

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
        <FieldLabel htmlFor="pipeline-storage-path">
          Dossier de stockage
        </FieldLabel>

        <Input
          id="pipeline-storage-path"
          value={values.storagePath}
          onChange={(event) =>
            setValues({
              ...values,
              storagePath: event.target.value,
            })
          }
        />

        <FieldDescription>
          Dossier dans lequel les documents importés sont stockés.
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