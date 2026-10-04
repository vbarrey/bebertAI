"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type {
  DocumentImportConflictAction,
  DocumentImportFile,
} from "@/types/document-import";

type Props = {
  open: boolean;
  conflicts: DocumentImportFile[];
  onOpenChange: (open: boolean) => void;
  onResolved: (
    decisions: Map<
      string,
      DocumentImportConflictAction
    >,
  ) => void;
};

export function DocumentImportConflictDialog({
  open,
  conflicts,
  onOpenChange,
  onResolved,
}: Props) {
  const [index, setIndex] =
    useState(0);

  const [applyToAll, setApplyToAll] =
    useState(false);

  const [decisions, setDecisions] =
    useState<
      Map<string, DocumentImportConflictAction>
    >(new Map());

  useEffect(() => {
    if (!open) {
      return;
    }

    setIndex(0);
    setApplyToAll(false);
    setDecisions(new Map());
  }, [open]);

  if (conflicts.length === 0) {
    return null;
  }

  const current =
    conflicts[index];

  function resolve(
    action: DocumentImportConflictAction,
  ) {
    if (applyToAll) {
      const next = new Map(decisions);

      for (const conflict of conflicts) {
        next.set(
          conflict.key,
          action,
        );
      }

      setDecisions(next);
      onResolved(next);
      return;
    }

    const next = new Map(decisions);

    next.set(
      current.key,
      action,
    );

    if (
      index <
      conflicts.length - 1
    ) {
      setDecisions(next);
      setIndex(
        (value) => value + 1,
      );
      setApplyToAll(false);
      return;
    }

    setDecisions(next);
    onResolved(next);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Document déjà présent
          </DialogTitle>

          <DialogDescription>
            Un document avec le même
            contenu existe déjà.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />

            <div className="min-w-0">
              <p className="truncate font-medium">
                {current.displayName}
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Document existant :
              </p>

              <p className="truncate text-sm">
                {current.conflict?.displayName}
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Conflit {index + 1} sur{" "}
            {conflicts.length}
          </p>

          <div className="flex items-center gap-2">
            <Checkbox
              id="apply-to-all"
              checked={applyToAll}
              onCheckedChange={(
                checked,
              ) =>
                setApplyToAll(
                  checked === true,
                )
              }
            />

            <label
              htmlFor="apply-to-all"
              className="cursor-pointer text-sm"
            >
              Faire la même chose pour
              tous les autres fichiers
              identiques
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() =>
              resolve("IGNORE")
            }
          >
            Ignorer
          </Button>

          <Button
            variant="destructive"
            onClick={() =>
              resolve("REPLACE")
            }
          >
            Remplacer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}