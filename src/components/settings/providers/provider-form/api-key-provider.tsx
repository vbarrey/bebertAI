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
import { Textarea } from "@/components/ui/textarea";

import { ApiKeyProviderType, createApiKeyProvider } from "@/lib/mutations/aiProvider";

// What differs between the providers reached with an API key.
// apiKeyUrl null: no key (Ollama local).
const providerForms: Record<ApiKeyProviderType, { name: string; apiKeyUrl: string | null; modelPlaceholder: string }> = {
  OLLAMA_LOCAL: { name: "Ollama local", apiKeyUrl: null, modelPlaceholder: "qwen3-embedding:4b-q8_0" },
  OLLAMA_CLOUD: { name: "Ollama Cloud", apiKeyUrl: "ollama.com/settings/keys", modelPlaceholder: "gpt-oss:120b" },
  ANTHROPIC: { name: "Anthropic", apiKeyUrl: "platform.claude.com/settings/keys", modelPlaceholder: "claude-opus-5-5" },
  VOYAGE: { name: "Voyage AI", apiKeyUrl: "dashboard.voyageai.com", modelPlaceholder: "voyage-4" },
  GOOGLE: { name: "Google Gemini", apiKeyUrl: "aistudio.google.com/apikey", modelPlaceholder: "gemini-embedding-2" },
  DEEPINFRA: { name: "DeepInfra", apiKeyUrl: "deepinfra.com/dash/api_keys", modelPlaceholder: "Qwen/Qwen3-Embedding-4B" },
};

type ApiKeyProviderFormProps = {
  type: ApiKeyProviderType;
  onBack: () => void;
  onSuccess: () => void;
};

export function ApiKeyProviderForm({
  type,
  onBack,
  onSuccess,
}: ApiKeyProviderFormProps) {
  const form = providerForms[type];

  const [name, setName] = useState(form.name);
  const [description, setDescription] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setLoading(true);

    try {
      const result = await createApiKeyProvider(type, { name, description, apiKey, defaultModel });

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
          <FieldLabel htmlFor="description">Commentaire</FieldLabel>

          <Textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ex. : compte perso, clé de test, offre gratuite…"
            maxLength={500}
            rows={2}
          />

          <FieldDescription>Facultatif : pour distinguer vos fournisseurs entre eux.</FieldDescription>
        </Field>


        {form.apiKeyUrl && <Field>
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
            À créer sur {form.apiKeyUrl}. Elle est vérifiée avant
            l&apos;ajout du fournisseur.
          </FieldDescription>
        </Field>}

        <Field>
          <FieldLabel htmlFor="default-model">Modèle par défaut</FieldLabel>

          <Input
            id="default-model"
            value={defaultModel}
            onChange={(event) => setDefaultModel(event.target.value)}
            placeholder={form.modelPlaceholder}
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
