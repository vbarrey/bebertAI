"use client";

import { useState } from "react";
import { ChevronDown, Play, RotateCcw, Trash2, X } from "lucide-react";
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
import {
  canBeIndexed,
  canBeReindexed,
  deleteDocument,
  getErrorMessage,
  indexDocument,
  reindexDocument,
} from "@/components/documents/DocumentActions";

type Props = {
  documents: Document[];
  onIndexingStarted: (jobId: string) => void;
  onDeleted: (documentId: string) => void;
  onDone: () => void;
  onCancel: () => void;
};

type BulkResult<T> = { document: Document; value: T }[];

/**
 * Runs the action on each document and reports the failures in a single toast.
 * Sequential on purpose (SQLite transactions): parallelize if bulk actions get slow.
 */
async function runBulk<T>(
  documents: Document[],
  action: (documentId: string) => Promise<T>,
  label: string,
): Promise<BulkResult<T>> {
  const succeeded: BulkResult<T> = [];
  const failures: string[] = [];

  for (const document of documents) {
    try {
      succeeded.push({ document, value: await action(document.id) });
    } catch (error) {
      failures.push(`${document.displayName} : ${getErrorMessage(error)}`);
    }
  }

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

export function DocumentBulkActions({ documents, onIndexingStarted, onDeleted, onDone, onCancel }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const indexable = documents.filter(canBeIndexed);
  const reindexable = documents.filter(canBeReindexed);

  async function handleIndexing(
    targets: Document[],
    start: (documentId: string) => Promise<string>,
    label: string,
  ) {
    setMenuOpen(false);
    setLoading(true);

    try {
      const started = await runBulk(targets, start, label);
      started.forEach(({ value: jobId }) => onIndexingStarted(jobId));
      onDone();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);

    try {
      const deleted = await runBulk(documents, deleteDocument, "Supprimés");
      deleted.forEach(({ document }) => onDeleted(document.id));
      setDeleteOpen(false);
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">
        {documents.length} sélectionné(s)
      </span>

      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={loading || documents.length === 0}
          >
            Actions
            <ChevronDown className="size-4" />
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
              onClick={() => handleIndexing(indexable, indexDocument, "Indexation lancée")}
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
              onClick={() => handleIndexing(reindexable, reindexDocument, "Réindexation lancée")}
            >
              <RotateCcw className="size-4" />
              Réindexer
              <span className="ml-auto text-xs text-muted-foreground">
                {reindexable.length}/{documents.length}
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
        size="sm"
        className="gap-2"
        disabled={loading}
        onClick={onCancel}
      >
        <X className="size-4" />
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
