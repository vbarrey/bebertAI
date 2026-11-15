"use server";

// The export (and later import) of .bebert bundles from the documents page: the worker does the work
// (src/lib/bundle/export.ts), these actions start it and tell where it is.

import { BundleJobKind, DocumentSourceType, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { enqueueBundleJob } from "@/lib/queue/bundle";
import { ExportParametersSchema, exportedWhere, selectionWhere, type ExportParameters } from "@/lib/bundle/selection";

export type ExportPreview = {
    // Indexed: the ones exported.
    exported: number;
    // In the selection but not indexed (yet, or any more): left out.
    skipped: number;
    localBytes: number;
    driveBytes: number;
};

export type BundleJobView = {
    id: string;
    kind: BundleJobKind;
    status: string;
    label: string;
    progress: number;
    fileSize: number | null;
    // Completed and still on the server.
    downloadable: boolean;
    result: Prisma.JsonValue;
    errorMessage: string | null;
    createdAt: Date;
};

async function parse(input: unknown, userId: string): Promise<ExportParameters | { error: string }> {
    const parsed = ExportParametersSchema.safeParse(input);
    if (!parsed.success) return { error: "Sélection d'export invalide." };

    const { selection } = parsed.data;
    if (selection.kind === "project" && !(await prisma.project.count({ where: { id: selection.projectId, userId } }))) {
        return { error: "Projet introuvable." };
    }
    return parsed.data;
}

/** What the export would hold: shown in the dialog before it starts. */
export async function previewExport(input: unknown): Promise<ExportPreview | { error: string }> {
    const user = await requireUser();
    const parameters = await parse(input, user.id);
    if ("error" in parameters) return parameters;

    const [total, sizes] = await Promise.all([
        prisma.document.count({ where: selectionWhere(user.id, parameters.selection) }),
        prisma.document.groupBy({
            by: ["sourceType"],
            where: exportedWhere(user.id, parameters.selection),
            _count: true,
            _sum: { fileSize: true },
        }),
    ]);
    const of = (sourceType: DocumentSourceType) => sizes.find((size) => size.sourceType === sourceType);
    const exported = sizes.reduce((sum, size) => sum + size._count, 0);

    return {
        exported,
        skipped: total - exported,
        localBytes: of(DocumentSourceType.LOCAL)?._sum.fileSize ?? 0,
        driveBytes: of(DocumentSourceType.GOOGLE_DRIVE)?._sum.fileSize ?? 0,
    };
}

/** Queues the export for the worker; its bundle is offered for download once written. */
export async function startExport(input: unknown): Promise<{ jobId: string } | { error: string }> {
    const user = await requireUser();
    const parameters = await parse(input, user.id);
    if ("error" in parameters) return parameters;

    const { selection } = parameters;
    const exported = await prisma.document.count({ where: exportedWhere(user.id, selection) });
    if (exported === 0) return { error: "Aucun document indexé dans cette sélection : rien à exporter." };

    const label = selection.kind === "documents" ? `${exported} document(s) sélectionné(s)`
        : selection.kind === "library" ? "Bibliothèque"
        : selection.kind === "project" ? `Projet « ${(await prisma.project.findUniqueOrThrow({ where: { id: selection.projectId } })).name} »`
        : "Tous les documents";

    const job = await prisma.bundleJob.create({
        data: { userId: user.id, kind: BundleJobKind.EXPORT, parameters, label },
    });
    await enqueueBundleJob(job.id);

    return { jobId: job.id };
}

/** The user's exports and imports of the last days, the latest first. */
export async function listBundleJobs(): Promise<BundleJobView[]> {
    const user = await requireUser();
    const jobs = await prisma.bundleJob.findMany({
        where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        orderBy: { createdAt: "desc" },
        take: 10,
    });

    return jobs.map(({ id, kind, status, label, progress, fileSize, filePath, result, errorMessage, createdAt }) => ({
        id,
        kind,
        status,
        label,
        progress,
        fileSize: fileSize === null ? null : Number(fileSize),
        downloadable: status === "COMPLETED" && filePath !== null,
        result,
        errorMessage,
        createdAt,
    }));
}
