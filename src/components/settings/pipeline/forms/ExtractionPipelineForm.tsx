"use client";

import { SaveButton, type SaveStatus } from "@/components/settings/pipeline/SaveButton";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

import type { ExtractionParameters } from "@/lib/pipeline/parameters";

type Props = {
  initialValues: ExtractionParameters;
  // Installed in Tesseract, read at page load.
  ocrLanguages: readonly string[];
  onSave: (values: ExtractionParameters) => Promise<void>;
};

// Other installed languages are shown by their Tesseract code.
const LANGUAGE_LABELS: Record<string, string> = {
  fra: "Français",
  eng: "Anglais",
  deu: "Allemand",
  rus: "Russe",
};

export function ExtractionPipelineForm({
  initialValues,
  ocrLanguages,
  onSave,
}: Props) {
  const [values, setValues] = useState(initialValues);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Selected but no longer installed languages stay visible so they can be unchecked.
  const languages = [...new Set([...ocrLanguages, ...values.ocrLanguages])];

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
            Active la reconnaissance optique de caractères (Tesseract)
            pour les images et les pages PDF sans texte exploitable.
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

      <Field>
        <FieldLabel htmlFor="pipeline-ocr-min-chars">
          Seuil de détection
        </FieldLabel>

        <Input
          id="pipeline-ocr-min-chars"
          type="number"
          min={0}
          step={1}
          disabled={!values.ocrEnabled}
          value={values.ocrMinCharsPerPage}
          onChange={(event) =>
            setValues({
              ...values,
              ocrMinCharsPerPage: event.target.valueAsNumber,
            })
          }
        />

        <FieldDescription>
          Une page PDF contenant moins de lettres ou chiffres que ce seuil
          est traitée par OCR.
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel>Langues OCR</FieldLabel>

        {ocrLanguages.length === 0 && (
          <FieldDescription>
            Tesseract est introuvable ou aucune langue n&apos;est installée
            (voir README, section OCR).
          </FieldDescription>
        )}

        <div className="flex flex-wrap gap-4">
          {languages.map((language) => (
            <label key={language} className="flex items-center gap-2 text-sm">
              <Checkbox
                disabled={!values.ocrEnabled}
                checked={values.ocrLanguages.includes(language)}
                onCheckedChange={(checked) =>
                  setValues({
                    ...values,
                    ocrLanguages: checked
                      ? [...values.ocrLanguages, language]
                      : values.ocrLanguages.filter((l) => l !== language),
                  })
                }
              />
              {LANGUAGE_LABELS[language] ?? language}
              {!ocrLanguages.includes(language) && (
                <span className="text-destructive">(non installée)</span>
              )}
            </label>
          ))}
        </div>
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