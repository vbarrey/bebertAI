"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

import { deleteProvider, updateProviderDetails } from "@/lib/mutations/aiProvider";
import type { Provider } from "@/types/augmented-prisma";

import { providerTypes } from "./provider-type-selector";

type ProviderInfoDialogProps = {
  provider: Provider;
  // The button opening it.
  children: React.ReactNode;
};

/** What was entered when the provider was added, its name and comment to change, and its deletion. */
export function ProviderInfoDialog({ provider, children }: ProviderInfoDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(provider.name);
  const [description, setDescription] = useState(provider.description ?? "");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // Opened again: from the stored values, not from a change left unsaved.
    if (next) {
      setName(provider.name);
      setDescription(provider.description ?? "");
      setApiKey("");
      setError(undefined);
    }
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await updateProviderDetails(provider.id, { name, description, apiKey });
      if (result?.error) return setError(result.error);
      toast.success(apiKey.trim() ? "Clé API vérifiée et enregistrée." : "Fournisseur enregistré.");
      setOpen(false);
    });
  }

  function remove() {
    setError(undefined);
    startTransition(async () => {
      const result = await deleteProvider(provider.id);
      if (result?.error) return setError(result.error);
      toast.success(`Fournisseur « ${provider.name} » supprimé.`);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <form onSubmit={save} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Fournisseur</DialogTitle>
            <DialogDescription>Ce qui a été saisi à son ajout. La clé API n&apos;est jamais affichée en entier : seuls ses 4 derniers caractères le sont.</DialogDescription>
          </DialogHeader>

          <dl className="divide-y rounded-lg border text-sm">
            {providerInfo(provider).map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between gap-4 px-3 py-2">
                <dt className="shrink-0 text-muted-foreground">{label}</dt>
                <dd className="min-w-0 break-all text-right font-mono text-xs">{value}</dd>
              </div>
            ))}
          </dl>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="provider-name">Nom</FieldLabel>
              <Input id="provider-name" value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>

            <Field>
              <FieldLabel htmlFor="provider-api-key">Nouvelle clé API</FieldLabel>
              <Input
                id="provider-api-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Laisser vide pour garder la clé actuelle"
              />
              <FieldDescription>Vérifiée auprès du fournisseur avant d&apos;être enregistrée.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="provider-description">Commentaire</FieldLabel>
              <Textarea
                id="provider-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Ex. : compte perso, clé de test, offre gratuite…"
                maxLength={500}
              />
              <FieldDescription>Pour distinguer vos fournisseurs entre eux.</FieldDescription>
            </Field>
          </FieldGroup>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="gap-2 sm:justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" disabled={pending}>
                  <Trash2 className="size-4" />
                  Supprimer
                </Button>
              </AlertDialogTrigger>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer « {provider.name} » ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ses modèles et sa clé API sont supprimés. Les étapes du pipeline qui l&apos;utilisent seront à
                    reconfigurer, et les conversations sur ses modèles passeront au modèle du pipeline.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={remove}>
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button type="submit" disabled={pending}>
              {pending && <Spinner />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function providerInfo(provider: Provider): { label: string; value: string }[] {
  const configuration = (typeof provider.configuration === "object" && !Array.isArray(provider.configuration)
    ? provider.configuration
    : null) ?? {};
  const text = (value: unknown) => (typeof value === "string" && value ? value : null);

  return [
    { label: "Type", value: providerTypes.find(({ type }) => type === provider.type)?.name ?? provider.type },
    { label: "Adresse de l'API", value: text(configuration.host) },
    { label: "Clé API", value: text(configuration.apiKey) },
    { label: "Modèle par défaut", value: text(configuration.defaultModel) },
    { label: "Ajouté le", value: new Date(provider.createdAt).toLocaleDateString("fr-FR", { dateStyle: "long" }) },
  ].filter((row): row is { label: string; value: string } => row.value !== null);
}
