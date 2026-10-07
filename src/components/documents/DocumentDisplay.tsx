"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";
import { DocumentActions } from "@/components/documents/DocumentActions";
import { DocumentBulkActions } from "@/components/documents/DocumentBulkActions";
import { File, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Document, IndexingStatus, JobStatus } from "@prisma/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { DocumentImportPopover } from "./DocumentPopover";
import { Card, CardContent } from "../ui/card";

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

type DocumentRow = Document & { indexingError?: string | null };

type Props = {
    initialDocuments: DocumentRow[]
}

// ----- Page ----
export function DocumentsDisplay({ initialDocuments }: Props) {
    const [documents, setDocuments] = useState<DocumentRow[]>(initialDocuments);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"ALL" | IndexingStatus>("ALL");
    const [page, setPage] = useState(1);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const filtered = documents.filter((d) => {
        const matchesSearch =
            d.displayName.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === "ALL" ? true : d.indexingStatus === statusFilter;
        return matchesSearch && matchesStatus;
    });

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

    const addDocuments = (newDocuments: Document[]) => {
        setDocuments((prev) => [...prev, ...newDocuments]);
    };

    const [activeJobIds, setActiveJobIds] = useState<string[]>([]);
    useEffect(() => {
        if (activeJobIds.length === 0) {
            return;
        }

        // A single connection for every active job: browsers cap SSE connections per origin.
        const eventSource = new EventSource(
            `/api/indexing-jobs/events?ids=${activeJobIds.join(",")}`,
        );

        eventSource.addEventListener("status", (event) => {
            const data = JSON.parse(event.data) as {
                jobId: string;
                documentId: string;
                displayName: string;
                status: JobStatus;
                errorMessage?: string;
            };

            const status = jobStatusToIndexingStatus[data.status];

            if (!status) {
                return;
            }

            setDocuments((documents) =>
                documents.map((document) =>
                    document.id === data.documentId
                        ? {
                            ...document,
                            indexingStatus: status,
                            indexingError: data.errorMessage ?? null,
                        }
                        : document,
                ),
            );

            if (finishedJobStatuses.includes(data.status)) {
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
    }, [activeJobIds]);

    function onIndexingStarted(jobId: string) {
        setActiveJobIds((jobIds) => [
            ...jobIds,
            jobId,
        ]);
    };

    function onDocumentDeleted(documentId: string) {
        setDocuments((documents) =>
            documents.filter((document) => document.id !== documentId)
        );
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
                <div className="mt-4 lg:mt-0">
                    <DocumentImportPopover addDocuments={addDocuments} onIndexingStarted={onIndexingStarted} />
                </div>
            </div>

            {/* Stats + Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {statusOptions
                    .filter((opt) => opt.value !== "all")
                    .map((opt) => {
                        const count = documents.filter((d) => d.indexingStatus === opt.value).length;
                        return (
                            <Card key={opt.value} className="flex flex-row items-center gap-3 p-4 transition-all hover:-translate-y-1/20 duration-200 hover:border-primary hover:shadow-md" onClick={() => changeFilters(() => setStatusFilter(toIndexingStatus(opt.value as string)))}>
                                <CardContent>
                                    <Badge variant="outline">{count}</Badge> <span>{opt.label}</span>
                                </CardContent>
                            </Card>
                        );
                    })}
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 mb-6">
                <Input
                    placeholder="Rechercher par nom"
                    value={search}
                    onChange={(e) => changeFilters(() => setSearch(e.target.value))}
                    className="max-w-xs"
                />
                <Select
                    onValueChange={(v) => changeFilters(() => setStatusFilter(toIndexingStatus(v as string)))}
                    value={statusFilter}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                        {statusOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="mt-4 sm:mt-0 sm:ml-auto">
                    {selectionMode ? (
                        <DocumentBulkActions
                            documents={selectedDocuments}
                            onIndexingStarted={onIndexingStarted}
                            onDeleted={onDocumentDeleted}
                            onDone={() => setSelectedIds(new Set())}
                            onCancel={exitSelection}
                        />
                    ) : (
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => setSelectionMode(true)}>
                            <ListChecks className="size-4" />
                            Sélectionner
                        </Button>
                    )}
                </div>
            </div>

            {/* Table */}
            {paginated.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">Aucun document trouvé.</div>
            ) : (
                <div className="overflow-hidden rounded-xl border">
                    <table className="w-full min-w-[800px] table-fixed">
                        <thead className="bg-muted/20">
                            <tr>
                                {selectionMode && (
                                    <th className="w-10 px-4 py-2">
                                        <Checkbox
                                            checked={pageCheckState}
                                            onCheckedChange={togglePage}
                                            aria-label="Sélectionner les documents de la page"
                                        />
                                    </th>
                                )}
                                <th className="w-[20%] px-4 py-2">Fichier</th>
                                <th className="w-[12.5%] px-4 py-2 hidden lg:table-cell">Type</th>
                                <th className="w-[12.5%] px-4 py-2 hidden lg:table-cell">Taille</th>
                                <th className="w-[12.5%] px-4 py-2">Statut</th>
                                <th className="w-[12.5%] px-4 py-2 hidden lg:table-cell">Dernière indexation</th>
                                <th className="w-[12.5%] px-4 py-2 hidden md:table-cell">Dernière modification</th>
                                <th className="w-[12.5%] px-4 py-2">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.map((doc) => {
                                const sizeMB = ((doc.fileSize ?? -1) / 1024 / 1024).toFixed(2);
                                return (
                                    <tr
                                        key={doc.id}
                                        data-state={selectedIds.has(doc.id) ? "selected" : undefined}
                                        className="border-t transition-colors data-[state=selected]:bg-muted/50 [&>td]:px-4 [&>td]:py-3"
                                    >
                                        {selectionMode && (
                                            <td>
                                                <Checkbox
                                                    checked={selectedIds.has(doc.id)}
                                                    onCheckedChange={(checked) => toggleSelected(doc.id, checked === true)}
                                                    aria-label={`Sélectionner ${doc.displayName}`}
                                                />
                                            </td>
                                        )}
                                        <td>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <File className="size-4 shrink-0" />
                                                        <div className="truncate cursor-default min-w-0">
                                                            {doc.displayName}
                                                        </div>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="max-w-md break-all">
                                                    {doc.displayName}
                                                </TooltipContent>
                                            </Tooltip>
                                        </td>
                                        <td className="hidden lg:table-cell text-center">{doc.format}</td>
                                        <td className="hidden lg:table-cell text-center text-muted-foreground">
                                            {doc.fileSize ? sizeMB : "—"} MB
                                        </td>
                                        <td className="text-center">
                                            <DocumentStatusBadge status={doc.indexingStatus} error={doc.indexingError} />
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
                <div className="mt-6 flex justify-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    >
                        Précédent
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <Button
                            key={p}
                            variant={p === page ? "default" : "ghost"}
                            size="sm"
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
