"use client";

import {
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FileIcon,
  FolderOpen,
  Upload,
} from "lucide-react";

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

import { pipelineCapabilities } from "@/lib/pipeline/capabilities";
import { EXTENSIONS_TO_FORMAT } from "@/lib/documents/format";

import type {
  DocumentImportAnalysis,
  DocumentImportConflictAction,
} from "@/types/document-import";

import { DocumentImportConflictDialog } from "./DocumentImportConflictDialog";
import { Document } from "@prisma/client";

type ImportFile = {
  file: File;
  relativePath?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addDocuments: (documents: Document[]) => void;
  onIndexingStarted: (jobId: string) => void;
};

function getFileKey(item: ImportFile) {
  return [
    item.file.name,
    item.file.size,
    item.file.lastModified,
    item.relativePath ?? "",
  ].join(":");
}

export function LocalDocumentImportDialog({
  open,
  onOpenChange,
  addDocuments,
  onIndexingStarted
}: Props) {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const folderInputRef =
    useRef<HTMLInputElement>(null);

  const [files, setFiles] =
    useState<ImportFile[]>([]);

  const [indexImmediately, setIndexImmediately] =
    useState(true);

  const [dragging, setDragging] =
    useState(false);

  const [analysis, setAnalysis] =
    useState<DocumentImportAnalysis | null>(null);

  const [analyzing, setAnalyzing] =
    useState(false);

  const [analysisError, setAnalysisError] =
    useState<string | null>(null);

  const [conflictsOpen, setConflictsOpen] =
    useState(false);

  /**
   * Decisions are also used as the UI state for
   * the resolved conflict badges.
   *
   * key = analysis file key
   * value = user's decision
   */
  const [decisions, setDecisions] =
    useState<
      Map<string, DocumentImportConflictAction>
    >(new Map());

  const [importing, setImporting] =
    useState(false);

  const [importError, setImportError] =
    useState<string | null>(null);

  const accept = useMemo(
    () =>
      // From the extension map: a format can have several extensions (.jpg / .jpeg).
      Object.entries(EXTENSIONS_TO_FORMAT)
        .filter(([, format]) =>
          pipelineCapabilities.import.supportedFormat.includes(format),
        )
        .map(([extension]) => extension)
        .join(","),
    [],
  );

  function reset() {
    setFiles([]);
    setIndexImmediately(true);
    setAnalysis(null);
    setAnalyzing(false);
    setAnalysisError(null);
    setConflictsOpen(false);
    setDecisions(new Map());
    setImporting(false);
    setImportError(null);
    setDragging(false);
  }

  function handleOpenChange(value: boolean) {
    onOpenChange(value);

    if (!value) {
      reset();
    }
  }

  function addFiles(
    newFiles: ImportFile[],
  ) {
    setFiles((current) => {
      const existing = new Set(
        current.map(getFileKey),
      );

      const unique = newFiles.filter((item) => {
        const key = getFileKey(item);

        if (existing.has(key)) {
          return false;
        }

        existing.add(key);
        return true;
      });

      return [...current, ...unique];
    });
  }

  function handleFileInput(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const selected = Array.from(
      event.target.files ?? [],
    );

    addFiles(
      selected.map((file) => ({
        file,
      })),
    );

    event.target.value = "";
  }

  function handleFolderInput(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const selected = Array.from(
      event.target.files ?? [],
    );

    addFiles(
      selected.map((file) => ({
        file,
        relativePath:
          file.webkitRelativePath || file.name,
      })),
    );

    event.target.value = "";
  }

  async function readDirectory(
    directory: FileSystemDirectoryEntry,
  ): Promise<ImportFile[]> {
    const files: ImportFile[] = [];

    const reader =
      directory.createReader();

    async function readEntries(): Promise<
      FileSystemEntry[]
    > {
      return new Promise((resolve, reject) => {
        reader.readEntries(
          resolve,
          reject,
        );
      });
    }

    while (true) {
      const entries = await readEntries();

      if (entries.length === 0) {
        break;
      }

      for (const entry of entries) {
        if (entry.isFile) {
          const file =
            await new Promise<File>(
              (resolve, reject) => {
                (
                  entry as FileSystemFileEntry
                ).file(
                  resolve,
                  reject,
                );
              },
            );

          files.push({
            file,
            relativePath:
              entry.fullPath.replace(
                /^\/+/,
                "",
              ),
          });
        } else if (entry.isDirectory) {
          files.push(
            ...(await readDirectory(
              entry as FileSystemDirectoryEntry,
            )),
          );
        }
      }
    }

    return files;
  }

  async function handleDrop(
    event: React.DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault();

    setDragging(false);

    const items = Array.from(
      event.dataTransfer.items,
    );

    const droppedFiles: ImportFile[] = [];

    for (const item of items) {
      const entry =
        item.webkitGetAsEntry?.();

      if (!entry) {
        const file =
          item.getAsFile();

        if (file) {
          droppedFiles.push({
            file,
          });
        }

        continue;
      }

      if (entry.isFile) {
        const file =
          await new Promise<File | null>(
            (resolve) => {
              (
                entry as FileSystemFileEntry
              ).file(
                resolve,
                () => resolve(null),
              );
            },
          );

        if (file) {
          droppedFiles.push({
            file,
            relativePath:
              entry.fullPath.replace(
                /^\/+/,
                "",
              ),
          });
        }
      } else if (entry.isDirectory) {
        droppedFiles.push(
          ...(await readDirectory(
            entry as FileSystemDirectoryEntry,
          )),
        );
      }
    }

    addFiles(droppedFiles);
  }

  async function analyzeFiles() {
    if (files.length === 0) {
      return;
    }

    setAnalyzing(true);
    setAnalysisError(null);
    setImportError(null);

    try {
      const formData = new FormData();

      for (const item of files) {
        formData.append(
          "files",
          item.file,
        );

        formData.append(
          "relativePaths",
          item.relativePath ?? "",
        );
      }

      const response = await fetch(
        "/api/documents/import/analyze",
        {
          method: "POST",
          body: formData,
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
          "L'analyse a échoué.",
        );
      }

      setAnalysis(
        data as DocumentImportAnalysis,
      );

      setDecisions(new Map());
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue.",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  function handleConflictResolved(
    nextDecisions: Map<
      string,
      DocumentImportConflictAction
    >,
  ) {
    /*
     * The same state is used both for the import
     * request and for the UI badges.
     *
     * No modification of analysis.files is needed.
     */
    setDecisions(
      new Map(nextDecisions),
    );

    setConflictsOpen(false);
  }

  async function importDocuments() {
    if (!analysis || importing) {
      return;
    }

    const unresolvedConflicts =
      analysis.files.filter(
        (file) =>
          file.conflict &&
          !decisions.has(file.key),
      );

    if (unresolvedConflicts.length > 0) {
      setConflictsOpen(true);
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      const formData = new FormData();

      /*
       * We deliberately send the complete original
       * file list. The server receives the decisions
       * separately and is responsible for applying them.
       */
      for (const item of files) {
        formData.append(
          "files",
          item.file,
        );

        formData.append(
          "relativePaths",
          item.relativePath ?? "",
        );
      }

      formData.append(
        "decisions",
        JSON.stringify(
          Object.fromEntries(decisions),
        ),
      );

      formData.append(
        "indexImmediately",
        String(indexImmediately),
      );

      const response = await fetch(
        "/api/documents/import",
        {
          method: "POST",
          body: formData,
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
          "L'import a échoué.",
        );
      }

      if ("importedDocuments" in data) {
        const importedDocuments: Document[] = data.importedDocuments;
        addDocuments(importedDocuments);
      }

      if ("createdJobIds" in data) {
        const createdJobIds: string[] = data.createdJobIds;
        createdJobIds.forEach((jobId) => {
          onIndexingStarted(jobId);
        });
      }

      handleOpenChange(false);
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue.",
      );
    } finally {
      setImporting(false);
    }
  }

  const conflicts =
    analysis?.files.filter(
      (file) => file.conflict,
    ) ?? [];

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
      >
        <DialogContent className="w-full min-w-0 max-h-[calc(100vh-2rem)] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Importer des documents
            </DialogTitle>

            <DialogDescription>
              Ajoutez des fichiers ou des
              dossiers. Les formats non
              supportés seront ignorés.
            </DialogDescription>
          </DialogHeader>

          {!analysis ? (
            <>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                >
                  <FileIcon className="mr-2 size-4" />
                  Ajouter des fichiers
                </Button>

                <Button
                  variant="outline"
                  onClick={() =>
                    folderInputRef.current?.click()
                  }
                >
                  <FolderOpen className="mr-2 size-4" />
                  Ajouter un dossier
                </Button>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={accept}
                  className="hidden"
                  onChange={handleFileInput}
                />

                <input
                  ref={folderInputRef}
                  type="file"
                  multiple
                  // @ts-expect-error webkitdirectory is not in React's types
                  webkitdirectory=""
                  accept={accept}
                  className="hidden"
                  onChange={handleFolderInput}
                />
              </div>

              <div
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDragging(false);
                }}
                onDrop={handleDrop}
                className={[
                  "flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition-colors",
                  dragging
                    ? "border-primary bg-muted/50"
                    : "border-border",
                ].join(" ")}
              >
                <Upload className="mb-3 size-6 text-muted-foreground" />

                <p className="text-sm font-medium">
                  Glissez vos fichiers ou
                  dossiers ici
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Vous pouvez mélanger
                  fichiers et dossiers.
                </p>
              </div>

              {files.length > 0 && (
                <div className="min-w-0 w-full space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {files.length} fichier
                      {files.length !== 1
                        ? "s"
                        : ""}
                    </p>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setFiles([])
                      }
                    >
                      Tout supprimer
                    </Button>
                  </div>

                  <div className="min-w-0 w-full max-h-[50vh] space-y-1 overflow-x-hidden overflow-y-auto">
                    {files.map((item) => (
                      <div
                        key={getFileKey(item)}
                        className="flex min-w-0 w-full items-center justify-between rounded-md border px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">
                            {item.file.name}
                          </p>

                          {item.relativePath &&
                            item.relativePath !==
                            item.file.name && (
                              <p className="truncate text-xs text-muted-foreground">
                                {item.relativePath}
                              </p>
                            )}
                        </div>

                        <span className="ml-4 shrink-0 text-xs text-muted-foreground">
                          {(
                            item.file.size /
                            1024 /
                            1024
                          ).toFixed(2)}{" "}
                          MB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Checkbox
                  id="index-immediately"
                  checked={indexImmediately}
                  onCheckedChange={(checked) =>
                    setIndexImmediately(
                      checked === true,
                    )
                  }
                />

                <label
                  htmlFor="index-immediately"
                  className="cursor-pointer text-sm"
                >
                  Indexer maintenant
                </label>
              </div>

              {analysisError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {analysisError}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Vérification
                </p>

                <p className="text-sm text-muted-foreground">
                  {analysis.files.length} fichier
                  {analysis.files.length !==
                    1
                    ? "s"
                    : ""}{" "}
                  prêt
                  {analysis.files.length !==
                    1
                    ? "s"
                    : ""}{" "}
                  à être importé
                  {analysis.files.length !==
                    1
                    ? "s"
                    : ""}
                  .
                </p>
              </div>

              <div className="max-h-72 space-y-2 overflow-y-auto">
                {analysis.files.map(
                  (file) => {
                    const decision =
                      decisions.get(
                        file.key,
                      );

                    return (
                      <div
                        key={file.key}
                        className="flex items-center justify-between rounded-md border p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {file.displayName}
                          </p>

                          <p className="text-xs text-muted-foreground">
                            {file.format} ·{" "}
                            {(
                              file.fileSize /
                              1024 /
                              1024
                            ).toFixed(2)}{" "}
                            MB
                          </p>
                        </div>

                        <div className="ml-4 shrink-0">
                          {decision ===
                            "IGNORE" ? (
                            <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                              Ignorer
                            </span>
                          ) : decision ===
                            "REPLACE" ? (
                            <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs text-foreground">
                              Remplacer
                            </span>
                          ) : file.conflict ? (
                            <span className="text-xs text-destructive">
                              Existe déjà
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>

              {analysis.ignored.length >
                0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      {analysis.ignored.length}{" "}
                      fichier
                      {analysis.ignored.length !==
                        1
                        ? "s"
                        : ""}{" "}
                      ignoré
                      {analysis.ignored.length !==
                        1
                        ? "s"
                        : ""}
                    </p>

                    <div className="max-h-32 space-y-1 overflow-y-auto">
                      {analysis.ignored.map(
                        (file) => (
                          <div
                            key={file.key}
                            className="rounded-md border px-3 py-2"
                          >
                            <p className="text-sm">
                              {file.displayName}
                            </p>

                            <p className="text-xs text-muted-foreground">
                              {file.reason ===
                                "UNSUPPORTED_FORMAT"
                                ? "Format non supporté"
                                : "Doublon"}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

              {importError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {importError}
                </div>
              )}
            </>
          )}

          <DialogFooter>
            {!analysis ? (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    handleOpenChange(false)
                  }
                >
                  Annuler
                </Button>

                <Button
                  disabled={
                    files.length === 0 ||
                    analyzing
                  }
                  onClick={analyzeFiles}
                >
                  {analyzing
                    ? "Analyse..."
                    : "Continuer"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  disabled={importing}
                  onClick={() => {
                    setAnalysis(null);
                    setDecisions(new Map());
                  }}
                >
                  Retour
                </Button>

                <Button
                  disabled={
                    importing ||
                    analysis.files.length ===
                    0
                  }
                  onClick={importDocuments}
                >
                  {importing
                    ? "Import..."
                    : conflicts.length > 0 &&
                      conflicts.some(
                        (file) =>
                          !decisions.has(
                            file.key,
                          ),
                      )
                      ? "Vérifier les conflits"
                      : `Importer ${analysis.files.length} fichier${analysis.files.length !==
                        1
                        ? "s"
                        : ""
                      }`}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocumentImportConflictDialog
        open={conflictsOpen}
        conflicts={conflicts}
        onOpenChange={setConflictsOpen}
        onResolved={
          handleConflictResolved
        }
      />
    </>
  );
}