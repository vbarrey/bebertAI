"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";
import { DocumentActions } from "@/components/documents/DocumentActions";
import { File, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Document, IndexingStatus } from "@prisma/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

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
        case "CANCELED":
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

type Props = {
    documents: Document[]
}

// ----- Page ----
export function DocumentsDisplay({ documents }: Props) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"ALL" | IndexingStatus>("ALL");
    const [page, setPage] = useState(1);

    const filtered = documents.filter((d) => {
        const matchesSearch =
            d.filename.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === "ALL" ? true : d.indexingStatus === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const totalPages = Math.ceil(filtered.length / PerPage);
    const paginated = filtered.slice((page - 1) * PerPage, page * PerPage);

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Documents</h1>
                    <p className="text-muted-foreground mt-1">Gestion et suivi de vos documents indexés.</p>
                </div>
                <Button className="mt-4 lg:mt-0">
                    <Plus className="mr-2 size-4" />Ajouter/Importer
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {statusOptions
                    .filter((opt) => opt.value !== "all")
                    .map((opt) => {
                        const count = documents.filter((d) => d.indexingStatus === opt.value).length;
                        return (
                            <div key={opt.value} className="flex items-center gap-3 p-4 rounded-xl border">
                                <Badge variant="outline">{count}</Badge> <span>{opt.label}</span>
                            </div>
                        );
                    })}
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 mb-6">
                <Input
                    placeholder="Rechercher par nom"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                    }}
                    className="max-w-xs"
                />
                <Select
                    onValueChange={(v) => {
                        setStatusFilter(toIndexingStatus(v as string));
                        setPage(1);
                    }}
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
            </div>

            {/* Table */}
            {paginated.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">Aucun document trouvé.</div>
            ) : (
                <div className="overflow-hidden rounded-xl border">
                    <table className="w-full min-w-[800px] table-auto">
                        <thead className="bg-muted/20">
                            <tr>
                                <th className="w-[25%] px-4 py-2">Fichier</th>
                                <th className="w-[10%] px-4 py-2 hidden lg:table-cell">Type</th>
                                <th className="w-[10%] px-4 py-2 hidden lg:table-cell">Taille</th>
                                <th className="w-[10%] px-4 py-2">Statut</th>
                                <th className="w-[10%] px-4 py-2 hidden lg:table-cell">Dernière indexation</th>
                                <th className="w-[10%] px-4 py-2 hidden md:table-cell">Dernière modification</th>
                                <th className="w-[60px] px-4 py-2">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.map((doc) => {
                                const sizeMB = ((doc.fileSize ?? -1) / 1024 / 1024).toFixed(2);
                                return (
                                    <tr key={doc.id} className="border-t [&>td]:px-4 [&>td]:py-3">
                                        <td>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="flex flex-row items-center gap-2">
                                                        <File className="size-4" />
                                                        <div className="truncate cursor-default">
                                                            {doc.filename}
                                                        </div>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="max-w-md break-all">
                                                    {doc.filename}
                                                </TooltipContent>
                                            </Tooltip>
                                        </td>
                                        <td className="hidden lg:table-cell text-center">{doc.format}</td>
                                        <td className="hidden lg:table-cell text-muted-foreground">
                                            {doc.fileSize ? sizeMB : "—"} MB
                                        </td>
                                        <td>
                                            <DocumentStatusBadge status={doc.indexingStatus} />
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
                                        <td>
                                            <DocumentActions />
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
