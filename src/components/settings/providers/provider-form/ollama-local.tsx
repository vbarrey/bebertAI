"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type OllamaProviderFormProps = {
  onBack: () => void;
  onSuccess: () => void;
};

export type CreateOllamaProviderInput = {
  name: string;
  displayName: string | null;
  description: string | null;
  enabled: boolean;
  configuration: {
    host: string;
    defaultModel?: string;
  };
};

export function OllamaProviderForm({
  onBack,
  onSuccess,
}: OllamaProviderFormProps) {
  const [displayName, setDisplayName] = useState("Ollama");

  const [description, setDescription] = useState(
    "Serveur Ollama local.",
  );

  const [host, setHost] = useState(
    "http://localhost:11434",
  );

  const [defaultModel, setDefaultModel] = useState("");

  const [enabled, setEnabled] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);

    try {
      setLoading(true);

      const configuration: CreateOllamaProviderInput["configuration"] = {
        host: host.trim(),
      };

      if (defaultModel.trim()) {
        configuration.defaultModel =
          defaultModel.trim();
      }

      const provider: CreateOllamaProviderInput = {
        name: "OLLAMA",
        displayName: displayName.trim() || null,
        description: description.trim() || null,
        enabled,
        configuration,
      };

      console.log(
        "Create Ollama provider =>",
        provider,
      );

      // TODO:
      // await createProvider(provider);

      onSuccess();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Impossible de créer le fournisseur.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <FieldGroup>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="display-name">
              Nom affiché
            </FieldLabel>

            <Input
              id="display-name"
              value={displayName}
              onChange={(event) =>
                setDisplayName(event.target.value)
              }
              placeholder="Ollama"
            />

            <FieldDescription>
              Nom utilisé pour identifier ce fournisseur
              dans l&apos;application.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="description">
              Description
            </FieldLabel>

            <Textarea
              id="description"
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              placeholder="Serveur Ollama local."
              className="resize-none"
            />
          </Field>
        </FieldGroup>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="host">
              Adresse du serveur
            </FieldLabel>

            <Input
              id="host"
              type="url"
              value={host}
              onChange={(event) =>
                setHost(event.target.value)
              }
              placeholder="http://localhost:11434"
              required
            />

            <FieldDescription>
              Adresse HTTP de l&apos;API Ollama.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="default-model">
              Modèle par défaut
            </FieldLabel>

            <Input
              id="default-model"
              value={defaultModel}
              onChange={(event) =>
                setDefaultModel(event.target.value)
              }
              placeholder="qwen3:0.6b"
            />

            <FieldDescription>
              Modèle utilisé lorsqu&apos;aucun modèle
              n&apos;est explicitement spécifié.
            </FieldDescription>
          </Field>
        </FieldGroup>

        <Field
          orientation="horizontal"
          className="rounded-lg border p-4"
        >
          <div className="flex-1">
            <FieldLabel htmlFor="enabled">
              Fournisseur activé
            </FieldLabel>

            <FieldDescription>
              Autoriser immédiatement l&apos;utilisation
              de ce fournisseur.
            </FieldDescription>
          </div>

          <Switch
            id="enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </Field>
      </FieldGroup>

      {error && (
        <p className="text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={loading}
        >
          <ArrowLeft className="size-4" />
          Retour
        </Button>

        <Button
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Création..."
            : "Créer le fournisseur"}
        </Button>
      </DialogFooter>
    </form>
  );
}