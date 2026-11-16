"use client";

import { useState } from "react";
import { ChevronDown, Play, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { type Document } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { canBeIndexed, canBeReindexed, getErrorMessage } from "@/components/documents/DocumentActions";
import {
  deleteDocuments,
  indexDocuments,
  reindexDocuments,
  type DocumentActionResult,
} from "@/lib/mutations/document-actions";

type Props = {
  documents: Document[];
  onIndexingStarted: (jobId: string) => void;
  onDeleted: (documentId: string) => void;
  onDone: () => void;
  onCancel: () => void;
  onExport: (documentIds: string[]) => void;
};

/**
 * Runs the server action on the whole selection in a single request, and reports the failures in a single toast.
 * Returns the documents that succeeded.
 */
async function runBulk<T>(
  documents: Document[],
  action: (documentIds: string[]) => Promise<DocumentActionResult<T>[]>,
  label: string,
): Promise<(T & { documentId: string; error?: undefined })[]> {
  let results: DocumentActionResult<T>[];

  try {
    results = await action(documents.map((document) => document.id));
  } catch (error) {
    toast.error(getErrorMessage(error));
    return [];
  }

  const names = new Map(documents.map((document) => [document.id, document.displayName]));
  const succeeded = results.flatMap((result) => (result.error === undefined ? [result] : []));
  const failures = results.flatMap((result) => (result.error !== undefined ? [`${names.get(result.documentId)} : ${result.error}`] : []));

  if (succeeded.length > 0) {
    toast.success(`${label} : ${succeeded.length} document(s).`);
  }

  if (failures.length > 0) {
    toast.error(`${failures.length} échec(s)`, {
      description: (
        <ul className="list-disc pl-4">
          {failures.map((failure) => <li key={failure}>{failure}</li>)}
        </ul>
      ),
    });
  }

  return succeeded;
}

export function DocumentBulkActions({ documents, onIndexingStarted, onDeleted, onDone, onCancel, onExport }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const indexable = documents.filter(canBeIndexed);
  const reindexable = documents.filter(canBeReindexed);

  async function handleIndexing(
    targets: Document[],
    start: typeof indexDocuments,
    label: string,
  ) {
    setMenuOpen(false);
    setLoading(true);

    try {
      const started = await runBulk(targets, start, label);
      started.forEach(({ indexingJobId }) => onIndexingStarted(indexingJobId));
      onDone();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);

    try {
      const deleted = await runBulk(documents, deleteDocuments, "Supprimés");
      deleted.forEach(({ documentId }) => onDeleted(documentId));
      setDeleteOpen(false);
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground tabular-nums">
        {documents.length} sélectionné(s)
      </span>

      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={loading || documents.length === 0}
          >
            Actions
            <ChevronDown data-icon="inline-end" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={4}
          className="w-56"
        >
          <div className="flex flex-col gap-1 p-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              disabled={indexable.length === 0}
              onClick={() => handleIndexing(indexable, indexDocuments, "Indexation lancée")}
            >
              <Play className="size-4" />
              Indexer
              <span className="ml-auto text-xs text-muted-foreground">
                {indexable.length}/{documents.length}
              </span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              disabled={reindexable.length === 0}
              onClick={() => handleIndexing(reindexable, reindexDocuments, "Réindexation lancée")}
            >
              <RotateCcw className="size-4" />
              Réindexer
              <span className="ml-auto text-xs text-muted-foreground">
                {reindexable.length}/{documents.length}
              </span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => {
                setMenuOpen(false);
                onExport(documents.map((document) => document.id));
              }}
            >
              <Upload className="size-4" />
              Exporter
              <span className="ml-auto text-xs text-muted-foreground">
                {documents.filter((document) => document.indexingStatus === "PROCESSED").length}/{documents.length}
              </span>
            </Button>

            <div className="my-1 h-px bg-border" />

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setMenuOpen(false);
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="size-4" />
              Supprimer
              <span className="ml-auto text-xs">
                {documents.length}
              </span>
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        disabled={loading}
        onClick={onCancel}
      >
        <X data-icon="inline-start" />
        Annuler
      </Button>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer {documents.length} document(s) ?
            </AlertDialogTitle>

            <AlertDialogDescription>
              Les documents sélectionnés ainsi que leurs données
              d&apos;indexation seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>
              Annuler
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={loading}
              onClick={(event) => {
                // Keep the dialog open until the deletions are done.
                event.preventDefault();
                void handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
