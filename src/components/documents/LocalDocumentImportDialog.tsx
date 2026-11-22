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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TruncatedText } from "@/components/ui/truncated-text";

import { pipelineCapabilities } from "@/lib/pipeline/capabilities";
import { EXTENSIONS_TO_FORMAT } from "@/lib/documents/format";
import { formatSize } from "@/lib/documents/import-queue";
import { cn } from "@/lib/utils";

import { ImportOptions, ImportQueuePanel } from "./ImportQueuePanel";
import type { ImportQueue } from "./useImportQueue";

type ImportFile = {
  file: File;
  relativePath?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queue: ImportQueue;
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
  queue,
}: Props) {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const folderInputRef =
    useRef<HTMLInputElement>(null);

  const [files, setFiles] =
    useState<ImportFile[]>([]);

  const [dragging, setDragging] =
    useState(false);

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

  // The files go to the import queue; the dialog stays open for more.
  function importFiles() {
    queue.addLocal(files);
    setFiles([]);
  }

  const queueShown = queue.items.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      <DialogContent
        className={cn(
          "w-full min-w-0 max-h-[calc(100vh-2rem)] overflow-hidden",
          queueShown ? "sm:max-w-5xl md:grid-cols-[minmax(0,1fr)_22rem]" : "sm:max-w-2xl",
        )}
      >
        <div className="grid min-w-0 gap-4">
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
                  {files.length} fichier{files.length !== 1 ? "s" : ""}
                  {" · "}
                  {formatSize(files.reduce((total, item) => total + item.file.size, 0))}
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

              <div className="min-w-0 w-full max-h-[40vh] space-y-1 overflow-x-hidden overflow-y-auto">
                {files.map((item) => (
                  <div
                    key={getFileKey(item)}
                    className="flex min-w-0 w-full items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <TruncatedText className="text-sm">
                        {item.file.name}
                      </TruncatedText>

                      {item.relativePath &&
                        item.relativePath !==
                        item.file.name && (
                          <TruncatedText className="text-xs text-muted-foreground">
                            {item.relativePath}
                          </TruncatedText>
                        )}
                    </div>

                    <span className="ml-4 shrink-0 text-xs text-muted-foreground">
                      {formatSize(item.file.size)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ImportOptions queue={queue} id="local" />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                handleOpenChange(false)
              }
            >
              Fermer
            </Button>

            <Button
              disabled={files.length === 0}
              onClick={importFiles}
            >
              {files.length > 0
                ? `Importer ${files.length} fichier${files.length !== 1 ? "s" : ""}`
                : "Importer"}
            </Button>
          </DialogFooter>
        </div>

        {queueShown && <ImportQueuePanel queue={queue} />}
      </DialogContent>
    </Dialog>
  );
}
