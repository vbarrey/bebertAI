"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, FileIcon, Folder, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

import type { DriveFolderPage, DriveItem } from "@/lib/google-drive/client";
import { formatSize } from "@/lib/documents/import-queue";
import { cn } from "@/lib/utils";

import { ImportOptions, ImportQueuePanel } from "./ImportQueuePanel";
import type { ImportQueue } from "./useImportQueue";

type Connection =
  | { connected: false }
  | { connected: true; email: string };

// A folder, or the results of a search when `search` is set (always the first step then).
type FolderStep = {
  id: string;
  name: string;
  search?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queue: ImportQueue;
};

type DriveFile = DriveItem & { relativePath?: string };

// The files under a picked folder, "loading" while they are listed.
type FolderFiles = "loading" | DriveFile[];

const ROOT: FolderStep = { id: "root", name: "Mon Drive" };
const SHARED: FolderStep = { id: "sharedWithMe", name: "Partagés avec moi" };

// Delay after the last key before the search runs.
const SEARCH_DELAY_MS = 300;

class NotConnectedError extends Error { }

async function fetchFolder(step: FolderStep, pageToken?: string): Promise<DriveFolderPage> {
  const params = new URLSearchParams(step.search ? { search: step.search } : { folderId: step.id });

  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  const response = await fetch(`/api/google-drive/files?${params}`);
  const data = await response.json();

  if (response.status === 401) {
    throw new NotConnectedError();
  }

  if (!response.ok) {
    throw new Error(data.error ?? "Impossible de lister le dossier.");
  }

  return data;
}

function plural(count: number) {
  return count !== 1 ? "s" : "";
}

export function GoogleDriveImportDialog({ open, onOpenChange, queue }: Props) {
  // Undefined while the status loads.
  const [connection, setConnection] = useState<Connection>();

  const [path, setPath] = useState<FolderStep[]>([ROOT]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Only the answer to the latest request is shown: an older search may answer last.
  const latestRequest = useRef(0);

  // Kept while browsing: files and folders can be picked in several folders.
  const [selected, setSelected] = useState<Map<string, DriveItem>>(new Map());

  // Listed when a folder is picked: its size, then the files of the import.
  const [folderFiles, setFolderFiles] = useState<Map<string, FolderFiles>>(new Map());

  async function loadFolder(nextPath: FolderStep[], pageToken?: string) {
    const request = ++latestRequest.current;

    setLoading(true);
    setError(null);

    try {
      const page = await fetchFolder(nextPath[nextPath.length - 1], pageToken);

      if (request !== latestRequest.current) {
        return;
      }

      setPath(nextPath);
      setItems((current) => (pageToken ? [...current, ...page.items] : page.items));
      setNextPageToken(page.nextPageToken);
    } catch (error) {
      if (error instanceof NotConnectedError) {
        setConnection({ connected: false });
      } else {
        setError(error instanceof Error ? error.message : "Une erreur est survenue.");
      }
    } finally {
      if (request === latestRequest.current) {
        setLoading(false);
      }
    }
  }

  function handleSearchChange(value: string) {
    const text = value.trim();

    setSearchText(value);
    clearTimeout(searchTimer.current);

    searchTimer.current = setTimeout(
      () => loadFolder(text ? [{ id: "search", name: `Résultats pour « ${text} »`, search: text }] : [ROOT]),
      SEARCH_DELAY_MS,
    );
  }

  function openView(view: FolderStep) {
    clearTimeout(searchTimer.current);
    setSearchText("");
    loadFolder([view]);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    (async () => {
      try {
        const response = await fetch("/api/google-drive");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error);
        }

        setConnection(data);

        if (data.connected) {
          await loadFolder([ROOT]);
        }
      } catch (error) {
        setConnection({ connected: false });
        setError(error instanceof Error ? error.message : "Une erreur est survenue.");
      }
    })();
  }, [open]);

  function handleOpenChange(value: boolean) {
    onOpenChange(value);

    if (!value) {
      setConnection(undefined);
      clearTimeout(searchTimer.current);
      setSearchText("");
      setPath([ROOT]);
      setItems([]);
      setNextPageToken(null);
      setError(null);
      setSelected(new Map());
      setFolderFiles(new Map());
    }
  }

  function setFolder(id: string, files: FolderFiles | null) {
    setFolderFiles((current) => {
      const next = new Map(current);

      if (files) {
        next.set(id, files);
      } else {
        next.delete(id);
      }

      return next;
    });
  }

  // Metadata only: a few requests to Drive for a big folder, nothing downloaded.
  async function loadFolderFiles(folder: DriveItem) {
    setFolder(folder.id, "loading");

    try {
      const response = await fetch(`/api/google-drive/folder-files?id=${encodeURIComponent(folder.id)}`);
      const data = await response.json();

      if (response.status === 401) {
        throw new NotConnectedError();
      }

      if (!response.ok) {
        throw new Error(data.error ?? "Impossible de lister le dossier.");
      }

      setFolder(folder.id, data.files);
    } catch (error) {
      setFolder(folder.id, null);
      toggle(folder, false);

      if (error instanceof NotConnectedError) {
        setConnection({ connected: false });
      } else {
        setError(`« ${folder.name} » : ${error instanceof Error ? error.message : "une erreur est survenue."}`);
      }
    }
  }

  // The picked files and the files of the picked folders, each once, go to the import queue.
  function importSelection() {
    const files = new Map<string, DriveFile>();

    for (const item of selected.values()) {
      const listed = item.isFolder ? folderFiles.get(item.id) : [item];

      for (const file of Array.isArray(listed) ? listed : []) {
        if (!files.has(file.id)) {
          files.set(file.id, file);
        }
      }
    }

    queue.addDrive([...files.values()]);
    setSelected(new Map());
  }

  async function disconnect() {
    const response = await fetch("/api/google-drive", { method: "DELETE" });

    if (!response.ok) {
      setError("Impossible de déconnecter Google Drive.");
      return;
    }

    setConnection({ connected: false });
    setSearchText("");
    setPath([ROOT]);
    setItems([]);
    setSelected(new Map());
  }

  function toggle(item: DriveItem, checked: boolean) {
    setSelected((current) => {
      const next = new Map(current);

      if (checked) {
        next.set(item.id, item);
      } else {
        next.delete(item.id);
      }

      return next;
    });

    if (checked && item.isFolder && !folderFiles.has(item.id)) {
      void loadFolderFiles(item);
    }
  }

  // The files that will be imported (supported format), under a folder or picked.
  const importable = (files: DriveFile[]) => files.filter((file) => file.format !== null);
  const sizeOf = (files: DriveFile[]) => files.reduce((total, file) => total + (file.size ?? 0), 0);

  function folderSummary(folder: DriveItem) {
    const files = folderFiles.get(folder.id);

    if (files === undefined) {
      return null;
    }

    if (files === "loading") {
      return "calcul…";
    }

    const count = importable(files).length;

    return `${count} fichier${plural(count)} · ${formatSize(sizeOf(importable(files)))}`;
  }

  const selectedFolders = [...selected.values()].filter((item) => item.isFolder).length;
  const selectedFiles = selected.size - selectedFolders;
  const pickedFolders = [...selected.values()].filter((item) => item.isFolder).map((item) => folderFiles.get(item.id));
  const computing = pickedFolders.some((files) => !Array.isArray(files));
  const selectionSize = sizeOf(importable([
    ...[...selected.values()].filter((item) => !item.isFolder),
    ...pickedFolders.flatMap((files) => (Array.isArray(files) ? files : [])),
  ]));
  const queueShown = queue.items.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "w-full min-w-0 max-h-[calc(100vh-2rem)] overflow-hidden",
          queueShown ? "sm:max-w-5xl md:grid-cols-[minmax(0,1fr)_22rem]" : "sm:max-w-2xl",
        )}
      >
        <div className="grid min-w-0 gap-4">
          <DialogHeader>
            <DialogTitle>Importer depuis Google Drive</DialogTitle>

            <DialogDescription>
              Sélectionnez des fichiers ou des dossiers. Les fichiers restent dans
              Google Drive : seuls leur lien et leur index sont conservés.
            </DialogDescription>
          </DialogHeader>

          {connection === undefined ? (
            <div className="flex justify-center py-10">
              <Spinner className="size-6 text-muted-foreground" />
            </div>
          ) : !connection.connected ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Connectez votre compte Google pour parcourir votre Drive.
              </p>

              <Button asChild>
                <a href="/api/google-drive/auth">Se connecter à Google Drive</a>
              </Button>
            </div>
          ) : (
            <div className="min-w-0 space-y-3">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-muted-foreground">
                  Connecté : {connection.email}
                </span>

                <Button variant="ghost" size="sm" onClick={disconnect}>
                  Se déconnecter
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {[ROOT, SHARED].map((view) => (
                  <Button
                    key={view.id}
                    variant={path[0].id === view.id ? "secondary" : "ghost"}
                    size="sm"
                    disabled={loading && path[0].id === view.id}
                    onClick={() => openView(view)}
                  >
                    {view.name}
                  </Button>
                ))}

                <div className="relative min-w-48 flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    type="search"
                    aria-label="Rechercher dans Google Drive"
                    placeholder="Rechercher un fichier ou un dossier"
                    className="pl-8"
                    value={searchText}
                    onChange={(event) => handleSearchChange(event.target.value)}
                  />
                </div>
              </div>

              <nav aria-label="Dossier courant" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
                {path.map((step, index) => (
                  <span key={step.id} className="flex items-center gap-1">
                    {index > 0 && <ChevronRight className="size-3 text-muted-foreground" />}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      disabled={loading || index === path.length - 1}
                      onClick={() => loadFolder(path.slice(0, index + 1))}
                    >
                      {step.name}
                    </Button>
                  </span>
                ))}
              </nav>

              <div className="min-w-0 max-h-[50vh] space-y-1 overflow-y-auto">
                {items.map((item) => {
                  const selectable = item.isFolder || item.format !== null;

                  return (
                    <div
                      key={item.id}
                      className={[
                        "flex min-w-0 items-center gap-3 rounded-md border px-3 py-2",
                        selectable ? "" : "opacity-50",
                      ].join(" ")}
                    >
                      <Checkbox
                        aria-label={`Sélectionner ${item.name}`}
                        disabled={!selectable}
                        checked={selected.has(item.id)}
                        onCheckedChange={(checked) => toggle(item, checked === true)}
                      />

                      {item.isFolder ? (
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm hover:underline"
                          disabled={loading}
                          onClick={() => loadFolder([...path, { id: item.id, name: item.name }])}
                        >
                          <Folder className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{item.name}</span>
                        </button>
                      ) : (
                        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                          <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{item.name}</span>
                        </span>
                      )}

                      {item.isFolder && selected.has(item.id) && (
                        <span className="shrink-0 text-xs text-muted-foreground">{folderSummary(item)}</span>
                      )}

                      {!item.isFolder && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {item.format
                            ? `${item.format}${item.size !== null ? ` · ${formatSize(item.size)}` : ""}`
                            : "Non supporté"}
                        </span>
                      )}
                    </div>
                  );
                })}

                {!loading && items.length === 0 && !error && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {path[0].search ? "Aucun résultat." : "Ce dossier est vide."}
                  </p>
                )}

                {loading && (
                  <div className="flex justify-center py-4">
                    <Spinner className="text-muted-foreground" />
                  </div>
                )}

                {nextPageToken && !loading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => loadFolder(path, nextPageToken)}
                  >
                    Charger plus
                  </Button>
                )}
              </div>

              <ImportOptions queue={queue} id="drive" />
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter className="items-center">
            {selected.size > 0 && (
              <span className="mr-auto text-sm text-muted-foreground">
                {selectedFiles > 0 && `${selectedFiles} fichier${plural(selectedFiles)}`}
                {selectedFiles > 0 && selectedFolders > 0 && " et "}
                {selectedFolders > 0 && `${selectedFolders} dossier${plural(selectedFolders)}`}
                {` sélectionné${plural(selected.size)} · ${computing ? "au moins " : ""}${formatSize(selectionSize)}`}
              </span>
            )}

            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Fermer
            </Button>

            <Button
              disabled={!connection?.connected || selected.size === 0 || computing}
              onClick={importSelection}
            >
              {computing ? "Calcul…" : "Importer"}
            </Button>
          </DialogFooter>
        </div>

        {queueShown && <ImportQueuePanel queue={queue} />}
      </DialogContent>
    </Dialog>
  );
}
