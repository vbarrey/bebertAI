"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { createOllamaCloudProvider } from "@/lib/mutations/aiProvider";
import { OLLAMA_CLOUD_HOST } from "@/lib/ai/ollama-cloud/config";

type OllamaCloudProviderFormProps = {
  onBack: () => void;
  onSuccess: () => void;
};

export function OllamaCloudProviderForm({
  onBack,
  onSuccess,
}: OllamaCloudProviderFormProps) {
  const [name, setName] = useState("Ollama Cloud");
  const [host, setHost] = useState(OLLAMA_CLOUD_HOST);
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setLoading(true);

    try {
      const result = await createOllamaCloudProvider({ name, host, apiKey, defaultModel });

      if (result?.error) {
        setError(result.error);
        return;
      }

      toast.success(`Fournisseur « ${name.trim()} » ajouté.`);
      onSuccess();
    } catch {
      setError("Impossible de créer le fournisseur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Nom</FieldLabel>

          <Input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />

          <FieldDescription>
            Nom utilisé pour identifier ce fournisseur dans l&apos;application.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="host">Adresse de l&apos;API</FieldLabel>

          <Input
            id="host"
            type="url"
            value={host}
            onChange={(event) => setHost(event.target.value)}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="api-key">Clé API</FieldLabel>

          <Input
            id="api-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            required
          />

          <FieldDescription>
            À créer sur ollama.com/settings/keys. Elle est vérifiée avant
            l&apos;ajout du fournisseur.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="default-model">Modèle par défaut</FieldLabel>

          <Input
            id="default-model"
            value={defaultModel}
            onChange={(event) => setDefaultModel(event.target.value)}
            placeholder="glm-5.3"
          />
        </Field>
      </FieldGroup>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onBack} disabled={loading}>
          <ArrowLeft className="size-4" />
          Retour
        </Button>

        <Button type="submit" disabled={loading}>
          {loading ? "Vérification..." : "Créer le fournisseur"}
        </Button>
      </DialogFooter>
    </form>
  );
}
