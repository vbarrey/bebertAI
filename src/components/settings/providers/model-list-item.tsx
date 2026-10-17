"use client";

import { useState, useRef, useEffect } from "react";
import { Model, Capability } from "@/types/augmented-prisma";
import { Bot, Check, Pencil, Star, Trash2Icon, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogMedia,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { TruncatedText } from "@/components/ui/truncated-text";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

import { deleteModel, setModelFavorite, updateModel } from "@/lib/mutations/aiModel";

export const capabilityLabels: Record<Capability, string> = {
  GENERATION: "Génération",
  EMBEDDING: "Embeddings",
  RERANKING: "Reranking",
};

type Props = {
  model: Model;
  // Only the models of a local provider: a remote one lists the models it serves.
  removable: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
};

export function ModelListItem({ model, removable, expanded, onExpandedChange }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [displayName, setDisplayName] = useState(model.displayName ?? "");
  const [description, setDescription] = useState(model.description ?? "");
  const [capabilities, setCapabilities] = useState<Capability[]>(model.capabilities?.map((capability) => capability.name) ?? []);
  const [favorite, setFavorite] = useState(model.favorite);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!expanded) return;
    setTimeout(() => {
      cardRef?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 500);
  }, [expanded]);

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateModel(model.id, { displayName, description, capabilities });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Modèle modifié.");
      setEditOpen(false);
    } catch {
      toast.error("Impossible de modifier le modèle.");
    } finally {
      setSaving(false);
    }
  }

  // Shown at once, put back when the change fails.
  async function handleToggleFavorite() {
    const next = !favorite;
    setFavorite(next);
    try {
      await setModelFavorite(model.id, next);
    } catch {
      setFavorite(!next);
      toast.error("Impossible de modifier les favoris.");
    }
  }

  async function handleDelete(event: React.MouseEvent) {
    // The dialog stays open until the model is deleted.
    event.preventDefault();
    setDeleting(true);
    try {
      const result = await deleteModel(model.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Modèle « ${model.displayName ?? model.name} » supprimé.`);
      setDeleteOpen(false);
    } catch {
      toast.error("Impossible de supprimer le modèle.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Collapsible
        open={expanded}
        onOpenChange={onExpandedChange}
        className="p-1 mb-4 last:mb-0"
      >
        <Card
          className={cn(
            "overflow-hidden transition-all duration-300",
            "cursor-pointer hover:border-primary/40 hover:shadow-md",
            expanded && "border-primary/30 shadow-md",
          )}
          onClick={() => onExpandedChange(!expanded)}
          ref={cardRef}
        >
          <CardHeader className="p-4">
            <div className="flex min-w-0 items-center gap-4">
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-md",
                  model.enabled ? "bg-primary/10" : "bg-muted",
                )}
              >
                <Bot className="size-4 text-muted-foreground" />
              </div>

              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TruncatedText>{displayName || model.name}</TruncatedText>

                  <CostDot requiresCredits={model.requiresCredits} />
                </CardTitle>

                <CardDescription className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {model.parameterSize && <span>{model.parameterSize}</span>}

                  {model.name && <TruncatedText className="max-w-full">{model.name}</TruncatedText>}
                </CardDescription>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-pressed={favorite}
                aria-label={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                onClick={(event) => {
                  event.stopPropagation();
                  handleToggleFavorite();
                }}
              >
                <Star
                  className={cn(
                    "size-4",
                    favorite ? "fill-foreground text-foreground" : "text-muted-foreground",
                  )}
                />
              </Button>

              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full",
                  model.enabled
                    ? "bg-green-500/10 text-green-600"
                    : "bg-destructive/10 text-destructive",
                )}
              >
                {model.enabled ? (
                  <Check className="size-4" />
                ) : (
                  <X className="size-4" />
                )}
              </div>
            </div>
          </CardHeader>

          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
            <CardContent className="border-t px-4 pb-4 pt-4">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium">Description</h3>

                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {description || "Aucune description disponible."}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium">Capacités</h3>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {capabilities.length ? (
                      capabilities.map((capability) => (
                        <Badge key={capability} variant="secondary">
                          {capabilityLabels[capability]}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Aucune capacité configurée.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium">Informations</h3>

                  <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
                    <InfoItem label="Nom technique" value={model.name} />

                    <InfoItem label="Nom affiché" value={displayName || "—"} />

                    <InfoItem label="Famille" value={model.family ?? "—"} />

                    <InfoItem
                      label="Taille"
                      value={model.parameterSize ?? "—"}
                    />
                  </dl>
                </div>

                <div
                  className="flex items-center justify-between border-t pt-4"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="size-3.5" />
                    Modifier
                  </Button>

                  {removable && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2Icon className="size-3.5" />
                      Supprimer
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader className="min-w-0">
            <DialogTitle className="min-w-0">
              <TruncatedText>{`Modifier ${model.displayName ?? model.name}`}</TruncatedText>
            </DialogTitle>

            <DialogDescription>
              Modifiez les informations configurables du modèle.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor={`displayName-${model.id}`}>Nom affiché</Label>

              <Input
                id={`displayName-${model.id}`}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`description-${model.id}`}>Description</Label>

              <Textarea
                id={`description-${model.id}`}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Label>Capacités</Label>

              <div className="space-y-3">
                {Object.values(Capability).map((capability) => {
                  const checked = capabilities.includes(capability);

                  return (
                    <div key={capability} className="flex items-center gap-3">
                      <Checkbox
                        id={`capability-${model.id}-${capability}`}
                        checked={checked}
                        onCheckedChange={(checked) => {
                          setCapabilities((currentCapabilities) => {
                            if (checked) {
                              return [...currentCapabilities, capability];
                            }

                            return currentCapabilities.filter(
                              (currentCapability) =>
                                currentCapability !== capability,
                            );
                          });
                        }}
                      />

                      <Label
                        htmlFor={`capability-${model.id}-${capability}`}
                        className="cursor-pointer text-sm font-normal"
                      >
                        {capabilityLabels[capability]}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Annuler
            </Button>

            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader className="min-w-0">
            <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
              <Trash2Icon />
            </AlertDialogMedia>
            <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>

            <AlertDialogDescription className="w-full min-w-0">
              Cette action est irréversible. Le modèle{" "}
              <TruncatedText className="font-semibold">{model.displayName ?? model.name}</TruncatedText> sera
              définitivement supprimé du fournisseur et de l&apos;application.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>

            <AlertDialogAction onClick={handleDelete} variant="destructive" disabled={deleting}>
              {deleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const costLabels = {
  free: "Gratuit : ce modèle s'utilise sans crédits.",
  paid: "Payant : chaque utilisation de ce modèle consomme des crédits chez le fournisseur.",
};

// Nothing while unknown (a model Ollama Cloud did not answer for).
function CostDot({ requiresCredits }: { requiresCredits: boolean | null }) {
  if (requiresCredits === null) {
    return null;
  }

  const label = requiresCredits ? costLabels.paid : costLabels.free;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={label}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex size-4 shrink-0 items-center justify-center rounded-full"
        >
          <span className={cn("size-2 rounded-full", requiresCredits ? "bg-orange-500" : "bg-green-500")} />
        </span>
      </TooltipTrigger>

      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

type InfoItemProps = {
  label: string;
  value: string;
};

function InfoItem({ label, value }: InfoItemProps) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>

      <dd className="font-medium">
        <TruncatedText>{value}</TruncatedText>
      </dd>
    </div>
  );
}
