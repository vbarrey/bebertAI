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

import type { Document } from "@prisma/client";
import type { DriveFolderPage, DriveItem } from "@/lib/google-drive/client";
import type {
  DocumentImportAnalysis,
  DocumentImportConflictAction,
} from "@/types/document-import";

import { DocumentImportConflictDialog } from "./DocumentImportConflictDialog";
import { DocumentImportReview } from "./DocumentImportReview";

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
  addDocuments: (documents: Document[]) => void;
  onIndexingStarted: (jobId: string) => void;
};

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

async function postJson<T>(url: string, body: unknown, fallbackError: string): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();

  if (response.status === 401) {
    throw new NotConnectedError();
  }

  if (!response.ok) {
    throw new Error(data.error ?? fallbackError);
  }

  return data;
}

export function GoogleDriveImportDialog({ open, onOpenChange, addDocuments, onIndexingStarted }: Props) {
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

  const [indexImmediately, setIndexImmediately] = useState(true);
  const [analysis, setAnalysis] = useState<DocumentImportAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [decisions, setDecisions] = useState<Map<string, DocumentImportConflictAction>>(new Map());
  const [conflictsOpen, setConflictsOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

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
      setIndexImmediately(true);
      setAnalysis(null);
      setDecisions(new Map());
      setConflictsOpen(false);
      setImportError(null);
    }
  }

  function handleError(error: unknown, setMessage: (message: string) => void) {
    if (error instanceof NotConnectedError) {
      setAnalysis(null);
      setConnection({ connected: false });
    } else {
      setMessage(error instanceof Error ? error.message : "Une erreur est survenue.");
    }
  }

  // Downloads every picked file once to compute its checksum: long for big folders.
  async function analyzeSelection() {
    const items = [...selected.values()];

    setAnalyzing(true);
    setError(null);
    setImportError(null);

    try {
      setAnalysis(await postJson<DocumentImportAnalysis>(
        "/api/google-drive/import/analyze",
        {
          fileIds: items.filter((item) => !item.isFolder).map((item) => item.id),
          folderIds: items.filter((item) => item.isFolder).map((item) => item.id),
        },
        "L'analyse a échoué.",
      ));
      setDecisions(new Map());
    } catch (error) {
      handleError(error, setError);
    } finally {
      setAnalyzing(false);
    }
  }

  async function importDocuments() {
    if (!analysis || importing) {
      return;
    }

    if (analysis.files.some((file) => file.conflict && !decisions.has(file.key))) {
      setConflictsOpen(true);
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      const data = await postJson<{ importedDocuments: Document[]; createdJobIds: string[] }>(
        "/api/google-drive/import",
        {
          files: analysis.files.map(({ sourceRef, displayName, format, fileSize, checksum }) => ({
            sourceRef,
            displayName,
            format,
            fileSize,
            checksum,
          })),
          decisions: Object.fromEntries(decisions),
          indexImmediately,
        },
        "L'import a échoué.",
      );

      addDocuments(data.importedDocuments);
      data.createdJobIds.forEach(onIndexingStarted);
      handleOpenChange(false);
    } catch (error) {
      handleError(error, setImportError);
    } finally {
      setImporting(false);
    }
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
  }

  const selectedFolders = [...selected.values()].filter((item) => item.isFolder).length;
  const selectedFiles = selected.size - selectedFolders;
  const conflicts = analysis?.files.filter((file) => file.conflict) ?? [];

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="w-full min-w-0 max-h-[calc(100vh-2rem)] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importer depuis Google Drive</DialogTitle>

            <DialogDescription>
              Sélectionnez des fichiers ou des dossiers. Les fichiers restent dans
              Google Drive : seuls leur lien et leur index sont conservés.
            </DialogDescription>
          </DialogHeader>

          {analysis ? (
            <DocumentImportReview
              analysis={analysis}
              decisions={decisions}
              importError={importError}
            />
          ) : connection === undefined ? (
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

                      {!item.isFolder && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {item.format
                            ? `${item.format}${item.size !== null ? ` · ${(item.size / 1024 / 1024).toFixed(2)} MB` : ""}`
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

              <div className="flex items-center gap-2">
                <Checkbox
                  id="drive-index-immediately"
                  checked={indexImmediately}
                  onCheckedChange={(checked) => setIndexImmediately(checked === true)}
                />

                <label htmlFor="drive-index-immediately" className="cursor-pointer text-sm">
                  Indexer maintenant
                </label>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter className="items-center">
            {!analysis ? (
              <>
                {selected.size > 0 && (
                  <span className="mr-auto text-sm text-muted-foreground">
                    {selectedFiles > 0 && `${selectedFiles} fichier${plural(selectedFiles)}`}
                    {selectedFiles > 0 && selectedFolders > 0 && " et "}
                    {selectedFolders > 0 && `${selectedFolders} dossier${plural(selectedFolders)}`}
                    {` sélectionné${plural(selected.size)}`}
                  </span>
                )}

                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Annuler
                </Button>

                <Button
                  disabled={!connection?.connected || selected.size === 0 || analyzing}
                  onClick={analyzeSelection}
                >
                  {analyzing ? "Analyse..." : "Continuer"}
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
                  disabled={importing || analysis.files.length === 0}
                  onClick={importDocuments}
                >
                  {importing
                    ? "Import..."
                    : conflicts.some((file) => !decisions.has(file.key))
                      ? "Vérifier les conflits"
                      : `Importer ${analysis.files.length} fichier${plural(analysis.files.length)}`}
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
        onResolved={(nextDecisions) => {
          setDecisions(new Map(nextDecisions));
          setConflictsOpen(false);
        }}
      />
    </>
  );
}
