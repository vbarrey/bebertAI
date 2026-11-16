"use client";

import { useEffect, useRef } from "react";
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    type ColumnDef,
    type OnChangeFn,
    type RowSelectionState,
    type SortingState,
} from "@tanstack/react-table";
import { AnimatePresence, motion } from "motion/react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import Image from "next/image";
import { ArrowDown, ArrowUp, ChevronsUpDown, File, FolderOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TruncatedText } from "@/components/ui/truncated-text";
import { DocumentActions } from "@/components/documents/DocumentActions";
import { DocumentStatusBadge } from "@/components/documents/DocumentStatusBadge";
import { cn } from "@/lib/utils";
import type { DocumentRow } from "@/lib/queries/document";
import type { IndexingSteps } from "@/lib/queue/types";

// Document.language holds the BM25 language detected at indexing: its code in the column, its name on hover.
const languages: Record<string, { code: string; name: string }> = {
    french: { code: "FR", name: "Français" },
    english: { code: "EN", name: "Anglais" },
    russian: { code: "RU", name: "Russe" },
    german: { code: "DE", name: "Allemand" },
};

function Language({ language }: { language: string }) {
    const { code, name } = languages[language] ?? { code: language.slice(0, 2).toUpperCase(), name: language };
    return <abbr title={name} className="cursor-default no-underline">{code}</abbr>;
}

// What the cells need from the page, handed to the table rather than captured: the columns are defined once.
type DocumentTableMeta = {
    selectionMode: boolean;
    progressByDocument: Record<string, IndexingSteps>;
    onIndexingStarted: (jobId: string) => void;
    onDeleted: (documentId: string) => void;
};

// The responsive widths and visibility of a column, on its header and its cells.
type ColumnClasses = { header?: string; cell?: string };

const tableMeta = (meta: unknown) => meta as DocumentTableMeta;
const columnClasses = (meta: unknown) => (meta ?? {}) as ColumnClasses;

function relativeDate(date: Date) {
    return formatDistanceToNow(date, { addSuffix: true, locale: fr });
}

/**
 * The columns. Sorted by the server (manualSorting): the sort of the table is only the state the page sends with its
 * requests. The column ids are the sort columns of /api/documents.
 */
const columns: ColumnDef<DocumentRow>[] = [
    {
        id: "select",
        enableSorting: false,
        header: ({ table }) => (
            <SelectionCell show={tableMeta(table.options.meta).selectionMode}>
                <Checkbox
                    checked={table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? "indeterminate" : false}
                    onCheckedChange={(checked) => table.toggleAllRowsSelected(checked === true)}
                    aria-label="Sélectionner les documents affichés"
                />
            </SelectionCell>
        ),
        cell: ({ row, table }) => (
            <SelectionCell show={tableMeta(table.options.meta).selectionMode}>
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(checked) => row.toggleSelected(checked === true)}
                    aria-label={`Sélectionner ${row.original.displayName}`}
                />
            </SelectionCell>
        ),
        meta: { cell: "overflow-hidden p-0!" } satisfies ColumnClasses,
    },
    {
        accessorKey: "displayName",
        header: "Fichier",
        sortDescFirst: false,
        cell: ({ row: { original: doc } }) => (
            <>
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
                            <div className="truncate cursor-default min-w-0">{doc.displayName}</div>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-md break-all">
                        {doc.displayName}
                    </TooltipContent>
                </Tooltip>
                {/* Narrower screens: the project column is hidden, its name stays under the title. */}
                {doc.ownerProject && (
                    <ProjectBadge name={doc.ownerProject.name} className="mt-1 ml-6 lg:hidden" />
                )}
            </>
        ),
        // No width: this auto column absorbs the slack, so the selection column keeps its exact animated width.
    },
    {
        // The project the document was imported for; none for a library document, last in both orders.
        id: "project",
        accessorFn: (doc) => doc.ownerProject?.name ?? null,
        header: "Projet",
        sortDescFirst: false,
        cell: ({ row: { original: doc } }) => (doc.ownerProject ? <ProjectBadge name={doc.ownerProject.name} className="mx-auto" /> : "—"),
        meta: {
            header: "w-[13%] hidden lg:table-cell",
            cell: "hidden lg:table-cell text-center text-muted-foreground",
        } satisfies ColumnClasses,
    },
    {
        accessorKey: "format",
        header: "Type",
        sortDescFirst: false,
        meta: { header: "w-[8%] hidden lg:table-cell", cell: "hidden lg:table-cell text-center" } satisfies ColumnClasses,
    },
    {
        accessorKey: "fileSize",
        header: "Taille",
        sortDescFirst: true,
        cell: ({ row: { original: doc } }) => `${doc.fileSize ? (doc.fileSize / 1024 / 1024).toFixed(2) : "—"} MB`,
        meta: {
            header: "w-[9%] hidden lg:table-cell",
            cell: "hidden lg:table-cell text-center text-muted-foreground",
        } satisfies ColumnClasses,
    },
    {
        accessorKey: "language",
        header: "Langue",
        sortDescFirst: false,
        cell: ({ row: { original: doc } }) => (doc.language ? <Language language={doc.language} /> : "—"),
        meta: {
            header: "md:w-24 hidden md:table-cell",
            cell: "hidden md:table-cell text-center text-muted-foreground",
        } satisfies ColumnClasses,
    },
    {
        accessorKey: "indexingStatus",
        header: "Statut",
        // Its filter already groups the documents by status.
        enableSorting: false,
        cell: ({ row: { original: doc }, table }) => (
            <DocumentStatusBadge
                status={doc.indexingStatus}
                error={doc.indexingError}
                progress={tableMeta(table.options.meta).progressByDocument[doc.id]}
            />
        ),
        meta: { header: "w-24 md:w-32 lg:w-[11%]", cell: "text-center" } satisfies ColumnClasses,
    },
    {
        accessorKey: "indexedAt",
        header: "Dernière indexation",
        sortDescFirst: true,
        cell: ({ row: { original: doc } }) => (doc.indexedAt ? relativeDate(doc.indexedAt) : "—"),
        meta: {
            header: "w-[12%] hidden lg:table-cell",
            cell: "hidden lg:table-cell text-muted-foreground text-center",
        } satisfies ColumnClasses,
    },
    {
        accessorKey: "updatedAt",
        header: "Dernière modification",
        sortDescFirst: true,
        cell: ({ row: { original: doc } }) => relativeDate(doc.updatedAt),
        meta: { header: "md:w-28 lg:w-[12%] hidden md:table-cell", cell: "hidden md:table-cell text-muted-foreground" } satisfies ColumnClasses,
    },
    {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row: { original: doc }, table }) => {
            const { onIndexingStarted, onDeleted } = tableMeta(table.options.meta);
            return <DocumentActions document={doc} onIndexingStarted={onIndexingStarted} onDeleted={onDeleted} />;
        },
        meta: { header: "w-20 md:w-24", cell: "text-center" } satisfies ColumnClasses,
    },
];

type Props = DocumentTableMeta & {
    documents: DocumentRow[];
    sorting: SortingState;
    onSortingChange: OnChangeFn<SortingState>;
    rowSelection: RowSelectionState;
    onRowSelectionChange: OnChangeFn<RowSelectionState>;
    total: number;
    hasMore: boolean;
    loading: "idle" | "more" | "replace";
    error: string | null;
    onLoadMore: () => void;
    onRetry: () => void;
};

// The element that scrolls the page: the layout's, not the window.
function scrollParent(element: HTMLElement | null): HTMLElement | null {
    for (let parent = element?.parentElement; parent; parent = parent.parentElement) {
        if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) return parent;
    }
    return null;
}

/** The documents in a shadcn/ui data table, sorted by the server and loaded further as the end of the list nears. */
export function DocumentTable({
    documents,
    sorting,
    onSortingChange,
    rowSelection,
    onRowSelectionChange,
    total,
    hasMore,
    loading,
    error,
    onLoadMore,
    onRetry,
    ...meta
}: Props) {
    // TanStack Table keeps its own mutable instance: the React Compiler leaves this component unmemoized. The
    // components below it receive plain values, not the table.
    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data: documents,
        columns,
        getRowId: (document) => document.id,
        getCoreRowModel: getCoreRowModel(),
        manualSorting: true,
        enableMultiSort: false,
        state: { sorting, rowSelection },
        onSortingChange,
        onRowSelectionChange,
        meta,
    });

    // Under the last row: once it comes within a few rows of the bottom of the screen, the next slice. Observed again
    // after each slice, so that a slice too short to fill the screen is followed by the next one.
    const sentinel = useRef<HTMLDivElement>(null);
    const canLoadMore = hasMore && loading === "idle" && !error;
    useEffect(() => {
        const element = sentinel.current;
        if (!element || !canLoadMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
            },
            { root: scrollParent(element), rootMargin: "0px 0px 600px 0px" },
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, [canLoadMore, documents.length, onLoadMore]);

    const selectionMode = meta.selectionMode;

    return (
        <div className={cn("transition-opacity", loading === "replace" && "pointer-events-none opacity-60")} aria-busy={loading !== "idle"}>
            {documents.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                    {loading === "replace" ? "Chargement…" : "Aucun document trouvé."}
                </div>
            ) : (
                <div className="overflow-hidden rounded-xl border">
                    <Table className="table-fixed text-base">
                        <TableHeader className="bg-muted/20">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                                    {headerGroup.headers.map((header) => {
                                        const { column } = header;
                                        const sorted = column.getIsSorted();
                                        const title = flexRender(column.columnDef.header, header.getContext());

                                        // Always rendered so the column width can animate open/closed (table-fixed reads
                                        // widths from the header).
                                        if (column.id === "select") {
                                            return (
                                                <motion.th
                                                    key={header.id}
                                                    initial={false}
                                                    animate={{ width: selectionMode ? 40 : 0 }}
                                                    className="overflow-hidden p-0"
                                                >
                                                    {title}
                                                </motion.th>
                                            );
                                        }

                                        return (
                                            <TableHead
                                                key={header.id}
                                                aria-sort={column.getCanSort() ? (sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none") : undefined}
                                                className={cn(
                                                    "h-auto px-2 py-2 text-center whitespace-normal md:px-4",
                                                    columnClasses(column.columnDef.meta).header,
                                                )}
                                            >
                                                {column.getCanSort() ? (
                                                    <SortableHeader
                                                        title={title}
                                                        sorted={sorted}
                                                        onToggle={column.getToggleSortingHandler()}
                                                    />
                                                ) : (
                                                    title
                                                )}
                                            </TableHead>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() ? "selected" : undefined}
                                    className="border-t border-b-0 hover:bg-transparent data-[state=selected]:bg-muted/50"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            className={cn(
                                                "px-2 py-3 whitespace-normal md:px-4",
                                                columnClasses(cell.column.columnDef.meta).cell,
                                            )}
                                        >
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* The end of the list: what is loading, what failed, or how many documents in all. */}
            <div ref={sentinel} className="flex min-h-12 items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                {error ? (
                    <>
                        <span>Le chargement des documents a échoué.</span>
                        <Button variant="ghost" size="sm" onClick={onRetry}>Réessayer</Button>
                    </>
                ) : loading === "more" ? (
                    <>
                        <Spinner />
                        <span>Chargement des documents suivants…</span>
                    </>
                ) : hasMore ? (
                    <span>{documents.length} sur {total} documents</span>
                ) : (
                    total > 0 && <span>{total} document{total > 1 ? "s" : ""}</span>
                )}
            </div>
        </div>
    );
}

function SortableHeader({
    title,
    sorted,
    onToggle,
}: {
    title: React.ReactNode;
    sorted: false | "asc" | "desc";
    onToggle?: (event: unknown) => void;
}) {
    const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronsUpDown;

    return (
        <Button
            variant="ghost"
            size="sm"
            className="-mx-2 h-auto gap-1 px-2 py-1 text-[length:inherit] font-medium whitespace-normal"
            onClick={onToggle}
        >
            {title}
            <Icon className={cn("size-3.5 shrink-0", !sorted && "text-muted-foreground/60")} />
        </Button>
    );
}

function ProjectBadge({ name, className }: { name: string; className?: string }) {
    return (
        <Badge variant="secondary" className={cn("flex max-w-48 gap-1", className)}>
            <FolderOpen className="size-3 shrink-0" />
            <TruncatedText>{name}</TruncatedText>
        </Badge>
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
