"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";
import { DocumentActions } from "@/components/documents/DocumentActions";
import { DocumentBulkActions } from "@/components/documents/DocumentBulkActions";
import { File, FolderOpen, ListChecks, Upload } from "lucide-react";
import { TruncatedText } from "@/components/ui/truncated-text";
import Image from "next/image";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Document, IndexingStatus, JobStatus } from "@prisma/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { DocumentImportPopover } from "./DocumentPopover";
import { ExportDialog } from "./ExportDialog";
import { Card, CardContent } from "../ui/card";
import type { IndexingSteps } from "@/lib/queue/types";

const toIndexingStatus = (status: string): IndexingStatus | "ALL" => {
    switch (status) {
        case "PROCESSED":
            return IndexingStatus.PROCESSED;
        case "PENDING":
            return IndexingStatus.PENDING;
        case "PROCESSING":
            return IndexingStatus.PROCESSING;
        case "FAILED":
            return IndexingStatus.FAILED;
        case "CANCELLED":
            return IndexingStatus.CANCELLED;
        case "NEEDREINDEX":
            return IndexingStatus.NEEDREINDEX;
        case "ALL":
            return "ALL";
        default: // case "UNPLANNED":
            return IndexingStatus.UNPLANNED;
    }
}

// ----- Helpers -----
const statusOptions = [
    { label: "Tous", value: "ALL" },
    { label: "Indexé", value: IndexingStatus.PROCESSED },
    { label: "En attente", value: IndexingStatus.PENDING },
    { label: "En cours", value: IndexingStatus.PROCESSING },
    { label: "Erreur", value: IndexingStatus.FAILED },
    { label: "Annulé", value: IndexingStatus.CANCELLED },
    { label: "À réindexer", value: IndexingStatus.NEEDREINDEX },
    { label: "Jamais indexé", value: IndexingStatus.UNPLANNED },
];

const PerPage = 10;

const jobStatusToIndexingStatus: Partial<Record<JobStatus, IndexingStatus>> = {
    QUEUED: IndexingStatus.PENDING,
    RUNNING: IndexingStatus.PROCESSING,
    COMPLETED: IndexingStatus.PROCESSED,
    FAILED: IndexingStatus.FAILED,
    CANCELLED: IndexingStatus.CANCELLED,
};

const finishedJobStatuses: JobStatus[] = [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED];

// Document.language holds the BM25 language detected at indexing.
const languageLabels: Record<string, string> = {
    french: "Français",
    english: "Anglais",
    russian: "Russe",
    german: "Allemand",
};

type DocumentRow = Document & {
    indexingError?: string | null;
    activeJobId?: string | null;
    // Imported for this project only; null for a library document.
    ownerProject?: { id: string; name: string } | null;
};

// "LIBRARY", or the id of the project the documents were imported for.
type LocationFilter = "ALL" | "LIBRARY" | string;

type Props = {
    // Rendered by the server again after each document action and import: never copied into a state.
    documents: DocumentRow[]
    googleDriveResult?: string
    // The user's projects, to export one.
    projects: { id: string; name: string }[]
}

// What the indexing events tell before the server renders the documents again.
type LiveStatus = Pick<DocumentRow, "indexingStatus" | "indexingError">;

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
    const next = { ...record };
    delete next[key];
    return next;
}

// ----- Page ----
export function DocumentsDisplay({ documents: serverDocuments, googleDriveResult, projects }: Props) {
    const [exportOpen, setExportOpen] = useState(false);
    // The documents picked for the export; null: chosen in the dialog.
    const [exportIds, setExportIds] = useState<string[] | null>(null);
    const router = useRouter();
    const [, startTransition] = useTransition();
    const [liveStatus, setLiveStatus] = useState<Record<string, LiveStatus>>({});
    const documents = serverDocuments.map((document) =>
        liveStatus[document.id] ? { ...document, ...liveStatus[document.id] } : document,
    );
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"ALL" | IndexingStatus>("ALL");
    const [locationFilter, setLocationFilter] = useState<LocationFilter>("ALL");
    const [page, setPage] = useState(1);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const filtered = documents.filter((d) => {
        const matchesSearch =
            d.displayName.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === "ALL" ? true : d.indexingStatus === statusFilter;
        const matchesLocation = locationFilter === "ALL"
            || (locationFilter === "LIBRARY" ? !d.ownerProjectId : d.ownerProjectId === locationFilter);
        return matchesSearch && matchesStatus && matchesLocation;
    });

    // The projects that have their own documents, for the location filter.
    const ownerProjects = [...new Map(
        documents.flatMap((d) => (d.ownerProject ? [[d.ownerProject.id, d.ownerProject.name] as const] : [])),
    )];

    const statusCount = (status: string) =>
        status === "ALL" ? documents.length : documents.filter((d) => d.indexingStatus === status).length;

    const totalPages = Math.ceil(filtered.length / PerPage);
    const paginated = filtered.slice((page - 1) * PerPage, page * PerPage);

    const selectedDocuments = documents.filter((d) => selectedIds.has(d.id));
    const selectedOnPage = paginated.filter((d) => selectedIds.has(d.id)).length;
    const pageCheckState =
        selectedOnPage === 0 ? false : selectedOnPage === paginated.length ? true : "indeterminate";

    function toggleSelected(documentId: string, checked: boolean) {
        setSelectedIds((ids) => {
            const next = new Set(ids);
            if (checked) next.add(documentId);
            else next.delete(documentId);
            return next;
        });
    }

    function togglePage() {
        const select = pageCheckState !== true;
        setSelectedIds((ids) => {
            const next = new Set(ids);
            paginated.forEach((d) => (select ? next.add(d.id) : next.delete(d.id)));
            return next;
        });
    }

    function exitSelection() {
        setSelectionMode(false);
        setSelectedIds(new Set());
    }

    // Never act on documents hidden by the filters: changing them resets the selection.
    function changeFilters(update: () => void) {
        update();
        setPage(1);
        setSelectedIds(new Set());
    }

    // The imports go through API routes, which cannot send the page back like a server action: it asks for it.
    const refresh = () => router.refresh();

    // Jobs already queued or running when the page opens are followed too.
    const [activeJobIds, setActiveJobIds] = useState<string[]>(() =>
        serverDocuments.flatMap((document) => (document.activeJobId ? [document.activeJobId] : [])),
    );
    const [progressByDocument, setProgressByDocument] = useState<Record<string, IndexingSteps>>({});
    useEffect(() => {
        if (activeJobIds.length === 0) {
            return;
        }

        // A single connection for every active job: browsers cap SSE connections per origin.
        const eventSource = new EventSource(
            `/api/indexing-jobs/events?ids=${activeJobIds.join(",")}`,
        );

        eventSource.addEventListener("progress", (event) => {
            const { documentId, data } = JSON.parse(event.data) as {
                documentId: string;
                data: IndexingSteps;
            };

            setProgressByDocument((progress) => ({ ...progress, [documentId]: data }));
        });

        eventSource.addEventListener("status", (event) => {
            const data = JSON.parse(event.data) as {
                jobId: string;
                documentId: string;
                displayName: string;
                status: JobStatus;
                errorMessage?: string;
                // Indexed, but not quite as asked: the old chunks kept without the file.
                warning?: string;
            };

            const status = jobStatusToIndexingStatus[data.status];

            if (!status) {
                return;
            }

            setLiveStatus((live) => ({
                ...live,
                [data.documentId]: { indexingStatus: status, indexingError: data.errorMessage ?? null },
            }));

            if (finishedJobStatuses.includes(data.status)) {
                // Changed by the worker, not by an action of this page: the server renders the documents again
                // (status, language, date of indexing). In a transition: the live status is dropped together with
                // the arrival of the new rendering, the former status never shows in between.
                startTransition(() => {
                    setLiveStatus((live) => without(live, data.documentId));
                    setProgressByDocument((progress) => without(progress, data.documentId));
                    router.refresh();
                });

                if (data.warning) {
                    toast.warning(`« ${data.displayName} » réindexé partiellement`, { description: data.warning });
                }

                if (data.status === JobStatus.FAILED) {
                    toast.error(`Échec de l'indexation de « ${data.displayName} »`, {
                        description: data.errorMessage,
                    });
                }

                setActiveJobIds((jobIds) =>
                    jobIds.filter((id) => id !== data.jobId),
                );
            }
        });

        eventSource.onerror = () => {
            // CONNECTING: the browser reconnects by itself. CLOSED: the jobs no longer exist.
            if (eventSource.readyState !== EventSource.CLOSED) {
                return;
            }

            console.error("SSE error for indexing jobs:", activeJobIds);

            setActiveJobIds((jobIds) =>
                jobIds.filter((id) => !activeJobIds.includes(id)),
            );
        };

        return () => {
            eventSource.close();
        };
    }, [activeJobIds, router]);

    function onIndexingStarted(jobId: string) {
        setActiveJobIds((jobIds) => [
            ...jobIds,
            jobId,
        ]);
    };

    // Gone from the documents the server sends back with the action's result.
    function onDocumentDeleted(documentId: string) {
        toggleSelected(documentId, false);
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Documents</h1>
                    <p className="text-muted-foreground mt-1">Gestion et suivi de vos documents indexés.</p>
                </div>
                <div className="mt-4 flex gap-2 lg:mt-0">
                    <Button variant="outline" className="gap-2" onClick={() => { setExportIds(null); setExportOpen(true); }}>
                        <Upload className="size-4" />
                        Exporter
                    </Button>
                    <DocumentImportPopover addDocuments={refresh} onIndexingStarted={onIndexingStarted} googleDriveResult={googleDriveResult} />
                </div>
                <ExportDialog open={exportOpen} onOpenChange={setExportOpen} projects={projects} documentIds={exportIds} />
            </div>

            {/* Stats + Filters */}
            {/* Phone: the status select below shows the same counts. */}
            <div className="mb-8 hidden grid-cols-4 gap-4 md:grid">
                {statusOptions.map((opt) => {
                        const count = statusCount(opt.value);
                        return (
                            <Card
                                key={opt.value}
                                className={cn(
                                    "cursor-pointer flex-row items-center py-4 transition-all duration-200 hover:border-primary hover:shadow-md",
                                    statusFilter === opt.value && "border-primary",
                                )}
                                onClick={() => changeFilters(() => setStatusFilter(toIndexingStatus(opt.value as string)))}
                            >
                                <CardContent className="flex items-center gap-2 whitespace-nowrap px-4">
                                    <Badge variant="outline">{count}</Badge> <span>{opt.label}</span>
                                </CardContent>
                            </Card>
                        );
                    })}
            </div>

            {/* Search & Filters */}
            <div className="mb-6 flex flex-wrap items-center gap-2 sm:gap-4">
                <Input
                    placeholder="Rechercher par nom"
                    value={search}
                    onChange={(e) => changeFilters(() => setSearch(e.target.value))}
                    className="w-full sm:max-w-xs"
                />
                <Select
                    onValueChange={(v) => changeFilters(() => setStatusFilter(toIndexingStatus(v as string)))}
                    value={statusFilter}
                >
                    <SelectTrigger aria-label="Statut">
                        <SelectValue placeholder="Statut">
                            {statusFilter === "ALL" ? "Tous les statuts" : statusOptions.find((opt) => opt.value === statusFilter)?.label}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {statusOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label} ({statusCount(opt.value)})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {/* Only once documents were imported for a project. */}
                {ownerProjects.length > 0 && (
                    <Select
                        onValueChange={(v) => changeFilters(() => setLocationFilter(v))}
                        value={locationFilter}
                    >
                        <SelectTrigger aria-label="Emplacement">
                            <SelectValue placeholder="Emplacement">
                                {locationFilter === "ALL" ? "Tous les emplacements"
                                    : locationFilter === "LIBRARY" ? "Bibliothèque"
                                    : ownerProjects.find(([id]) => id === locationFilter)?.[1]}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Tous les emplacements</SelectItem>
                            <SelectItem value="LIBRARY">Bibliothèque</SelectItem>
                            {ownerProjects.map(([id, name]) => (
                                <SelectItem key={id} value={id}>{name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                <div className="ml-auto">
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={selectionMode ? "bulk" : "select"}
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 8 }}
                        >
                            {selectionMode ? (
                                <DocumentBulkActions
                                    documents={selectedDocuments}
                                    onIndexingStarted={onIndexingStarted}
                                    onDeleted={onDocumentDeleted}
                                    onDone={() => setSelectedIds(new Set())}
                                    onCancel={exitSelection}
                                    onExport={(documentIds) => { setExportIds(documentIds); setExportOpen(true); }}
                                />
                            ) : (
                                <Button variant="outline" size="sm" className="gap-2" onClick={() => setSelectionMode(true)}>
                                    <ListChecks className="size-4" />
                                    Sélectionner
                                </Button>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* Table */}
            {paginated.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">Aucun document trouvé.</div>
            ) : (
                <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full table-fixed">
                        <thead className="bg-muted/20">
                            <tr>
                                {/* Always rendered so the column width can animate open/closed (table-fixed reads widths from the header). */}
                                <motion.th
                                    initial={false}
                                    animate={{ width: selectionMode ? 40 : 0 }}
                                    className="overflow-hidden p-0"
                                >
                                    <SelectionCell show={selectionMode}>
                                        <Checkbox
                                            checked={pageCheckState}
                                            onCheckedChange={togglePage}
                                            aria-label="Sélectionner les documents de la page"
                                        />
                                    </SelectionCell>
                                </motion.th>
                                {/* No width: this auto column absorbs the slack, so the selection column keeps its exact animated width. */}
                                <th className="px-2 py-2 md:px-4">Fichier</th>
                                <th className="w-[12.5%] px-4 py-2 hidden lg:table-cell">Type</th>
                                <th className="w-[12.5%] px-4 py-2 hidden lg:table-cell">Taille</th>
                                <th className="w-[10%] px-4 py-2 hidden md:table-cell">Langue</th>
                                <th className="w-24 px-2 py-2 md:w-[12.5%] md:px-4">Statut</th>
                                <th className="w-[12.5%] px-4 py-2 hidden lg:table-cell">Dernière indexation</th>
                                <th className="w-[12.5%] px-4 py-2 hidden md:table-cell">Dernière modification</th>
                                <th className="w-20 px-2 py-2 md:w-[12.5%] md:px-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.map((doc) => {
                                const sizeMB = ((doc.fileSize ?? -1) / 1024 / 1024).toFixed(2);
                                return (
                                    <tr
                                        key={doc.id}
                                        data-state={selectedIds.has(doc.id) ? "selected" : undefined}
                                        className="border-t transition-colors data-[state=selected]:bg-muted/50 [&>td]:px-2 md:[&>td]:px-4 [&>td]:py-3"
                                    >
                                        <td className="overflow-hidden p-0!">
                                            <SelectionCell show={selectionMode}>
                                                <Checkbox
                                                    checked={selectedIds.has(doc.id)}
                                                    onCheckedChange={(checked) => toggleSelected(doc.id, checked === true)}
                                                    aria-label={`Sélectionner ${doc.displayName}`}
                                                />
                                            </SelectionCell>
                                        </td>
                                        <td>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        {doc.sourceType === "GOOGLE_DRIVE" ? (
                                                            <Image
                                                                src="/icons/google-drive.svg"
                                                                alt="Google Drive"
                                                                width={16}
                                                                height={16}
                                                                className="size-4 shrink-0"
                                                            />
                                                        ) : (
                                                            <File className="size-4 shrink-0" />
                                                        )}
                                                        <div className="truncate cursor-default min-w-0">
                                                            {doc.displayName}
                                                        </div>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="max-w-md break-all">
                                                    {doc.displayName}
                                                </TooltipContent>
                                            </Tooltip>
                                            {doc.ownerProject && (
                                                <Badge variant="secondary" className="mt-1 ml-6 flex max-w-48 gap-1">
                                                    <FolderOpen className="size-3 shrink-0" />
                                                    <TruncatedText>{doc.ownerProject.name}</TruncatedText>
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="hidden lg:table-cell text-center">{doc.format}</td>
                                        <td className="hidden lg:table-cell text-center text-muted-foreground">
                                            {doc.fileSize ? sizeMB : "—"} MB
                                        </td>
                                        <td className="hidden md:table-cell text-center text-muted-foreground">
                                            {doc.language ? languageLabels[doc.language] ?? doc.language : "—"}
                                        </td>
                                        <td className="text-center">
                                            <DocumentStatusBadge status={doc.indexingStatus} error={doc.indexingError} progress={progressByDocument[doc.id]} />
                                        </td>
                                        <td className="hidden lg:table-cell text-muted-foreground text-center">
                                            {doc.indexedAt
                                                ? formatDistanceToNow(new Date(doc.indexedAt), {
                                                    addSuffix: true,
                                                    locale: fr,
                                                })
                                                : "—"}
                                        </td>
                                        <td className="hidden md:table-cell text-muted-foreground">
                                            {formatDistanceToNow(new Date(doc.updatedAt), {
                                                addSuffix: true,
                                                locale: fr,
                                            })}
                                        </td>
                                        <td className="text-center">
                                            <DocumentActions document={doc} onIndexingStarted={onIndexingStarted} onDeleted={onDocumentDeleted} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    >
                        Précédent
                    </Button>
                    {/* Too many page buttons for a phone: the position instead. */}
                    <span className="text-sm text-muted-foreground sm:hidden">{page} / {totalPages}</span>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <Button
                            key={p}
                            variant={p === page ? "default" : "ghost"}
                            size="sm"
                            className="hidden sm:inline-flex"
                            onClick={() => setPage(p)}
                        >
                            {p}
                        </Button>
                    ))}
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={page === totalPages}
                        onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    >
                        Suivant
                    </Button>
                </div>
            )}
        </div>
    );
}

function SelectionCell({ show, children }: { show: boolean; children: React.ReactNode }) {
    return (
        <AnimatePresence initial={false}>
            {show && (
                <motion.div
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    className="flex justify-center"
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
