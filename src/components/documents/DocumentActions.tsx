"use client";

import { useState } from "react";
import {
  MoreVertical,
  Play,
  RotateCcw,
  Eye,
  Info,
  Trash2,
} from "lucide-react";

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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { type Document } from "@prisma/client";

type Props = {
  document: Document;
  onIndexingStarted: (jobId: string) => void;
  onDeleted: (documentId: string) => void;
};

export function DocumentActions({ document, onIndexingStarted, onDeleted }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  function canBeIndex(doc: Document){
    return doc.indexingStatus === "UNPLANNED" || doc.indexingStatus === "FAILED" ||doc.indexingStatus === "CANCELLED";
  }

  async function handleIndex() {
    setLoading(true);

    try {
      const response = await fetch(
        `/api/documents/${document.id}/index`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error(
          "Impossible de lancer l'indexation.",
        );
      }

      const data = await response.json();

      if(data.indexingJobId){
        onIndexingStarted(data.indexingJobId);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleReindex() {
    setLoading(true);

    try {
      const response = await fetch(
        `/api/documents/${document.id}/reindex`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error(
          "Impossible de relancer l'indexation.",
        );
      }

      const data = await response.json();

      if(data.indexingJobId){
        onIndexingStarted(data.indexingJobId);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);

    try {
      const response = await fetch(
        `/api/documents/${document.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(
          "Impossible de supprimer le document.",
        );
      }

      onDeleted(document.id);
      setDeleteOpen(false);
    } finally {
      setLoading(false);
    }
  }

  function handleVisualize() {
    window.open(
      `/api/documents/${document.id}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions pour ${document.displayName}`}
          >
            <MoreVertical className="size-4" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={4}
          className="w-48"
        >
          <div className="flex flex-col gap-1 p-1">
            <Button
              variant="ghost"
              size="sm"
              className={"w-full justify-start gap-2"}
              disabled={
                loading ||
                !canBeIndex(document)
              }
              onClick={handleIndex}
            >
              <Play className="size-4" />
              Indexer
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              disabled={loading}
              onClick={handleReindex}
            >
              <RotateCcw className="size-4" />
              Réindexer
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={handleVisualize}
            >
              <Eye className="size-4" />
              Visualiser
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => setDetailsOpen(true)}
            >
              <Info className="size-4" />
              Détails
            </Button>

            <div className="my-1 h-px bg-border" />

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
              Supprimer
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Détails du document
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <Detail
              label="Nom"
              value={document.displayName}
            />

            <Detail
              label="Format"
              value={document.format}
            />

            <Detail
              label="Taille"
              value={
                document.fileSize
                  ? `${(
                    document.fileSize /
                    1024 /
                    1024
                  ).toFixed(2)} MB`
                  : "—"
              }
            />

            <Detail
              label="Checksum"
              value={document.checksum}
              mono
            />

            <Detail
              label="Statut"
              value={document.indexingStatus}
            />

            <Detail
              label="Créé le"
              value={new Date(
                document.createdAt,
              ).toLocaleString("fr-FR")}
            />

            <Detail
              label="Modifié le"
              value={new Date(
                document.updatedAt,
              ).toLocaleString("fr-FR")}
            />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer ce document ?
            </AlertDialogTitle>

            <AlertDialogDescription>
              Le document «{" "}
              <strong>
                {document.displayName}
              </strong>{" "}
              ainsi que ses données d'indexation
              seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>
              Annuler
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={loading}
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Detail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">
        {label}
      </div>

      <div
        className={
          mono
            ? "break-all font-mono text-xs"
            : "break-words"
        }
      >
        {value}
      </div>
    </div>
  );
}