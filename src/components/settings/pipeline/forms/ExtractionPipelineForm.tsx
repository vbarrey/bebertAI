"use client";

import { SaveButton, type SaveStatus } from "@/components/settings/pipeline/SaveButton";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

import type { PipelineParameters } from "@/lib/pipeline/parameters";

type ExtractionParameters = PipelineParameters["extraction"];

type Props = {
  initialValues: ExtractionParameters;
  onSave: (values: ExtractionParameters) => Promise<void>;
};

export function ExtractionPipelineForm({
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
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="pipeline-ocr">
            OCR
          </FieldLabel>

          <FieldDescription>
            Active la reconnaissance optique de caractères pendant
            l&apos;extraction.
          </FieldDescription>
        </FieldContent>

        <Switch
          id="pipeline-ocr"
          checked={values.ocrEnabled}
          onCheckedChange={(ocrEnabled) =>
            setValues({
              ...values,
              ocrEnabled,
            })
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