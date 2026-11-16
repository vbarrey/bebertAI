"use client";

import { useState, useEffect, useRef } from "react";
import type { OnChangeFn, RowSelectionState, SortingState } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { DocumentBulkActions } from "@/components/documents/DocumentBulkActions";
import { DocumentTable } from "@/components/documents/DocumentTable";
import { useDocumentList } from "@/components/documents/useDocumentList";
import { ListChecks, Upload } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { IndexingStatus, JobStatus } from "@prisma/client";
import { DocumentImportPopover } from "./DocumentPopover";
import { ExportDialog } from "./ExportDialog";
import { Card, CardContent } from "../ui/card";
import type { IndexingSteps } from "@/lib/queue/types";
import { defaultDocumentListQuery, type DocumentListQuery, type DocumentSortColumn } from "@/lib/documents/list-query";
import type { DocumentRow, DocumentStats, DocumentsPage } from "@/lib/queries/document";

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

const jobStatusToIndexingStatus: Partial<Record<JobStatus, IndexingStatus>> = {
    QUEUED: IndexingStatus.PENDING,
    RUNNING: IndexingStatus.PROCESSING,
    COMPLETED: IndexingStatus.PROCESSED,
    FAILED: IndexingStatus.FAILED,
    CANCELLED: IndexingStatus.CANCELLED,
};

const finishedJobStatuses: JobStatus[] = [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED];

// The search is sent once the user stops typing, not at each letter.
const SEARCH_DELAY_MS = 300;

// "LIBRARY", or the id of the project the documents were imported for.
type LocationFilter = "ALL" | "LIBRARY" | string;

type Props = {
    // The first slice of the documents, in the default sort and without filter: the page then loads the next ones.
    initialPage: DocumentsPage
    // Rendered by the server again after each document action and import: the page then loads its documents again.
    stats: DocumentStats
    googleDriveResult?: string
    // The user's projects, to export one.
    projects: { id: string; name: string }[]
}

// What the indexing events tell before the documents are loaded again. Settled: the job is over, the status final;
// dropped once a reload started after it brought the document as the server now has it.
type LiveStatus = Pick<DocumentRow, "indexingStatus" | "indexingError"> & { settledAt?: number };

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
    const next = { ...record };
    delete next[key];
    return next;
}

// ----- Page ----
export function DocumentsDisplay({ initialPage, stats, googleDriveResult, projects }: Props) {
    const [exportOpen, setExportOpen] = useState(false);
    // The documents picked for the export; null: chosen in the dialog.
    const [exportIds, setExportIds] = useState<string[] | null>(null);
    const router = useRouter();
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"ALL" | IndexingStatus>("ALL");
    const [locationFilter, setLocationFilter] = useState<LocationFilter>("ALL");
    const [sort, setSort] = useState<Pick<DocumentListQuery, "sort" | "order">>({
        sort: defaultDocumentListQuery.sort,
        order: defaultDocumentListQuery.order,
    });
    const [selectionMode, setSelectionMode] = useState(false);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

    const list = useDocumentList({ search, status: statusFilter, location: locationFilter, ...sort }, initialPage);

    const [liveStatus, setLiveStatus] = useState<Record<string, LiveStatus>>({});
    const documents = list.documents.map((document) =>
        liveStatus[document.id] ? { ...document, ...liveStatus[document.id] } : document,
    );

    // The default sort (the newest first) is no column's.
    const sorting: SortingState = sort.sort === defaultDocumentListQuery.sort ? [] : [{ id: sort.sort, desc: sort.order === "desc" }];

    const onSortingChange: OnChangeFn<SortingState> = (updater) => {
        const [column] = typeof updater === "function" ? updater(sorting) : updater;
        changeFilters(() => setSort(column
            ? { sort: column.id as DocumentSortColumn, order: column.desc ? "desc" : "asc" }
            : { sort: defaultDocumentListQuery.sort, order: defaultDocumentListQuery.order }));
    };

    const statusCount = (status: string) =>
        status === "ALL" ? stats.total : stats.counts[status as IndexingStatus] ?? 0;

    const selectedDocuments = documents.filter((d) => rowSelection[d.id]);

    function deselect(documentId: string) {
        setRowSelection((selection) => without(selection, documentId));
    }

    function exitSelection() {
        setSelectionMode(false);
        setRowSelection({});
    }

    // Never act on documents hidden by the filters or not loaded in the new order: changing them resets the selection.
    function changeFilters(update: () => void) {
        update();
        setRowSelection({});
    }

    useEffect(() => {
        const timeout = setTimeout(() => {
            const trimmed = searchInput.trim();
            if (trimmed !== search) changeFilters(() => setSearch(trimmed));
        }, SEARCH_DELAY_MS);
        return () => clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- the input alone starts the delay.
    }, [searchInput]);

    // The imports go through API routes, which cannot send the page back like a server action: it asks for it.
    const refresh = () => router.refresh();

    // Rendered again by the server (an action, an import, the end of an indexing): the documents loaded may have
    // changed, their order too. Not at the first rendering: the server gave the first slice with it.
    const renderedStats = useRef(stats);
    useEffect(() => {
        if (stats === renderedStats.current) return;
        renderedStats.current = stats;

        const startedAt = performance.now();
        void list.reload().then((applied) => {
            if (!applied) return;
            setLiveStatus((live) => Object.fromEntries(
                Object.entries(live).filter(([, status]) => status.settledAt === undefined || status.settledAt > startedAt),
            ));
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- a new rendering of the server alone reloads.
    }, [stats]);

    // The jobs followed: those started from this page, and those queued or running of the documents loaded. Not
    // those over, which a reload under way can still tell running.
    const [startedJobIds, setStartedJobIds] = useState<string[]>([]);
    const [endedJobIds, setEndedJobIds] = useState<ReadonlySet<string>>(() => new Set());
    const activeJobIds = [...new Set([
        ...startedJobIds,
        ...list.documents.flatMap((document) => (document.activeJobId ? [document.activeJobId] : [])),
    ])].filter((id) => !endedJobIds.has(id));
    // By value: the same jobs keep the same connection, whatever the renderings.
    const activeJobsKey = activeJobIds.join(",");

    const [progressByDocument, setProgressByDocument] = useState<Record<string, IndexingSteps>>({});
    useEffect(() => {
        if (!activeJobsKey) {
            return;
        }

        const jobIds = activeJobsKey.split(",");
        const endJobs = (ended: string[]) => setEndedJobIds((ids) => new Set([...ids, ...ended]));

        // A single connection for every active job: browsers cap SSE connections per origin.
        const eventSource = new EventSource(`/api/indexing-jobs/events?ids=${activeJobsKey}`);

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

            const finished = finishedJobStatuses.includes(data.status);

            setLiveStatus((live) => ({
                ...live,
                [data.documentId]: {
                    indexingStatus: status,
                    indexingError: data.errorMessage ?? null,
                    settledAt: finished ? performance.now() : undefined,
                },
            }));

            if (finished) {
                // Changed by the worker, not by an action of this page: the server renders the page again, which
                // loads the documents again (status, language, date of indexing). The live status is kept until then:
                // the former status never shows in between.
                setProgressByDocument((progress) => without(progress, data.documentId));
                router.refresh();

                if (data.warning) {
                    toast.warning(`« ${data.displayName} » réindexé partiellement`, { description: data.warning });
                }

                if (data.status === JobStatus.FAILED) {
                    toast.error(`Échec de l'indexation de « ${data.displayName} »`, {
                        description: data.errorMessage,
                    });
                }

                endJobs([data.jobId]);
            }
        });

        eventSource.onerror = () => {
            // CONNECTING: the browser reconnects by itself. CLOSED: the jobs no longer exist.
            if (eventSource.readyState !== EventSource.CLOSED) {
                return;
            }

            console.error("SSE error for indexing jobs:", jobIds);
            endJobs(jobIds);
        };

        return () => {
            eventSource.close();
        };
    }, [activeJobsKey, router]);

    function onIndexingStarted(jobId: string) {
        setStartedJobIds((jobIds) => [...jobIds, jobId]);
    }

    // Out of the list at once; the server confirms it with the action's result.
    function onDocumentDeleted(documentId: string) {
        deselect(documentId);
        list.remove([documentId]);
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
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
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
                {stats.ownerProjects.length > 0 && (
                    <Select
                        onValueChange={(v) => changeFilters(() => setLocationFilter(v))}
                        value={locationFilter}
                    >
                        <SelectTrigger aria-label="Emplacement">
                            <SelectValue placeholder="Emplacement">
                                {locationFilter === "ALL" ? "Tous les emplacements"
                                    : locationFilter === "LIBRARY" ? "Bibliothèque"
                                    : stats.ownerProjects.find(({ id }) => id === locationFilter)?.name}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Tous les emplacements</SelectItem>
                            <SelectItem value="LIBRARY">Bibliothèque</SelectItem>
                            {stats.ownerProjects.map(({ id, name }) => (
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
                                    onDone={() => setRowSelection({})}
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

            <DocumentTable
                documents={documents}
                sorting={sorting}
                onSortingChange={onSortingChange}
                rowSelection={rowSelection}
                onRowSelectionChange={setRowSelection}
                total={list.total}
                hasMore={list.hasMore}
                loading={list.loading}
                error={list.error}
                onLoadMore={list.loadMore}
                onRetry={list.hasMore && list.documents.length > 0 ? list.loadMore : () => void list.reload()}
                selectionMode={selectionMode}
                progressByDocument={progressByDocument}
                onIndexingStarted={onIndexingStarted}
                onDeleted={onDocumentDeleted}
            />
        </div>
    );
}
