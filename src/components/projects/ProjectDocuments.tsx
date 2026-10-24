"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentScope } from "@prisma/client";
import { Check, File, Library, ListChecks, Search, X } from "lucide-react";
import { toast } from "sonner";

import { selectProjectDocuments, setProjectDocumentScope, unselectProjectDocument } from "@/lib/mutations/projects";
import type { ProjectDocuments as ProjectDocumentsData } from "@/lib/queries/document";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TruncatedText } from "@/components/ui/truncated-text";
import { DocumentActions } from "@/components/documents/DocumentActions";
import { DocumentImportPopover } from "@/components/documents/DocumentPopover";
import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";
import { cn } from "@/lib/utils";

type ProjectDocumentsProps = {
  projectId: string;
  scope: DocumentScope;
  documents: ProjectDocumentsData;
};

type DocumentRow = ProjectDocumentsData["owned"][number];

const SCOPES: { value: DocumentScope; title: string; description: string; icon: typeof Library }[] = [
  {
    value: "ALL",
    title: "Toute la bibliothèque",
    description: "Les conversations du projet cherchent dans tous les documents de la bibliothèque.",
    icon: Library,
  },
  {
    value: "SELECTION",
    title: "Une sélection",
    description: "Les conversations du projet ne cherchent que dans les documents choisis.",
    icon: ListChecks,
  },
];

/** The documents the conversations of a project search, and where they come from. */
export function ProjectDocuments({ projectId, scope, documents }: ProjectDocumentsProps) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);

  async function changeScope(next: DocumentScope) {
    if (next === scope) return;
    try {
      await setProjectDocumentScope(projectId, next);
    } catch {
      toast.error("Impossible de modifier les documents du projet.");
    }
  }

  async function unselect(documentId: string) {
    try {
      await unselectProjectDocument(projectId, documentId);
    } catch {
      toast.error("Impossible de retirer le document de la sélection.");
    }
  }

  // The document actions and the import change the documents: the page reads them again.
  const refresh = () => router.refresh();

  function documentRow(document: DocumentRow, action: React.ReactNode) {
    return (
      <li key={document.id} className="flex items-center gap-3 px-4 py-2.5">
        <File className="size-4 shrink-0 text-muted-foreground" />
        <TruncatedText className="flex-1 text-sm">{document.displayName}</TruncatedText>
        <div className="shrink-0">
          <DocumentStatusBadge status={document.indexingStatus} error={document.indexingError} />
        </div>
        <div className="flex w-9 shrink-0 justify-end">{action}</div>
      </li>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-medium">Où cherchent les conversations du projet ?</h2>

        <div role="radiogroup" aria-label="Documents du projet" className="grid gap-3 sm:grid-cols-2">
          {SCOPES.map(({ value, title, description, icon: Icon }) => {
            const checked = value === scope;

            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => changeScope(value)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-accent/50",
                  checked && "border-primary bg-accent/50",
                )}
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
                </span>
                {checked && <Check className="size-4 shrink-0" />}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          Les documents importés dans le projet sont toujours utilisés, et n&apos;apparaissent pas dans les autres projets.
        </p>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Importés dans le projet ({documents.owned.length})</h2>
          <DocumentImportPopover projectId={projectId} addDocuments={refresh} onIndexingStarted={refresh} />
        </div>

        {documents.owned.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Aucun document importé pour ce projet seulement.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {documents.owned.map((document) =>
              documentRow(document, <DocumentActions document={document} onIndexingStarted={refresh} onDeleted={refresh} />))}
          </ul>
        )}
      </section>

      {scope === "SELECTION" && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Sélectionnés dans la bibliothèque ({documents.selected.length})</h2>
            <Button variant="outline" onClick={() => setPickerOpen(true)} disabled={documents.library.length === 0}>
              <Library />
              Ajouter depuis la bibliothèque
            </Button>
          </div>

          {documents.selected.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              Aucun document sélectionné : les conversations du projet ne cherchent que dans ses documents importés.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {documents.selected.map((document) =>
                documentRow(
                  document,
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    onClick={() => unselect(document.id)}
                    aria-label={`Retirer « ${document.displayName} » de la sélection`}
                    title="Retirer de la sélection"
                  >
                    <X className="size-4" />
                  </Button>,
                ))}
            </ul>
          )}

          <LibraryPicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            projectId={projectId}
            library={documents.library}
          />
        </section>
      )}
    </div>
  );
}

type LibraryPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  library: ProjectDocumentsData["library"];
};

/** The library documents not selected yet, picked with a search. */
function LibraryPicker({ open, onOpenChange, projectId, library }: LibraryPickerProps) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const query = search.trim().toLowerCase();
  const shown = query ? library.filter((document) => document.displayName.toLowerCase().includes(query)) : library;
  const allShownPicked = shown.length > 0 && shown.every((document) => picked.has(document.id));

  function toggle(ids: string[], checked: boolean) {
    setPicked((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSearch("");
      setPicked(new Set());
    }
    onOpenChange(next);
  }

  async function add() {
    setSaving(true);
    try {
      await selectProjectDocuments(projectId, [...picked]);
      toast.success(`${picked.size} document${picked.size > 1 ? "s" : ""} ajouté${picked.size > 1 ? "s" : ""} au projet.`);
      handleOpenChange(false);
    } catch {
      toast.error("Impossible d'ajouter les documents au projet.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter depuis la bibliothèque</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher par nom"
            aria-label="Rechercher un document"
            className="pl-7"
            autoFocus
          />
        </div>

        <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <Checkbox
            checked={allShownPicked}
            onCheckedChange={(checked) => toggle(shown.map((document) => document.id), checked === true)}
            disabled={shown.length === 0}
          />
          {query ? `Tous les résultats (${shown.length})` : `Tous les documents (${shown.length})`}
        </label>

        <div className="max-h-[50vh] min-h-0 overflow-y-auto rounded-lg border">
          <ul className="divide-y">
            {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Aucun document trouvé.</li>}

            {shown.map((document) => (
              <li key={document.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent/50">
                  <Checkbox
                    checked={picked.has(document.id)}
                    onCheckedChange={(checked) => toggle([document.id], checked === true)}
                  />
                  <TruncatedText className="flex-1 text-sm">{document.displayName}</TruncatedText>
                  <span className="shrink-0 text-xs text-muted-foreground uppercase">{document.format}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Annuler</Button>
          <Button onClick={add} disabled={picked.size === 0 || saving}>
            Ajouter{picked.size > 0 && ` (${picked.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
