import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";

import { pipelineCapabilities } from "@/lib/pipeline/capabilities";
import { DocumentFormatSchema } from "@/lib/documents/format";
import { importDocuments } from "@/lib/documents/import";
import { isDriveId } from "@/lib/google-drive/client";
import { apiUser } from "@/lib/session";

/**
 * The files of the analysis, sent back as they were analyzed: nothing is downloaded again before the indexing.
 */
const ImportRequestSchema = z.object({
    files: z.array(z.object({
        sourceRef: z.string().refine(isDriveId),
        displayName: z.string().min(1),
        format: DocumentFormatSchema.refine(
            (format) => pipelineCapabilities.import.supportedFormat.includes(format),
        ),
        fileSize: z.number().int().nonnegative(),
        checksum: z.string().regex(/^[a-f0-9]{64}$/),
    })).min(1),
    decisions: z.record(z.string(), z.enum(["IGNORE", "REPLACE"])).default({}),
    indexImmediately: z.boolean(),
    // Imported from this project.
    projectId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
    const { error: authError } = await apiUser();
    if (authError) return authError;

    const parsed = ImportRequestSchema.safeParse(await request.json().catch(() => undefined));

    if (!parsed.success) {
        return NextResponse.json(
            { error: "Requête d'import invalide." },
            { status: 400 },
        );
    }

    const { files, decisions, indexImmediately, projectId } = parsed.data;

    try {
        const result = await importDocuments(
            files.map((file) => ({
                ...file,
                id: crypto.randomUUID(),
                storagePath: null,
                sourceType: "GOOGLE_DRIVE",
            })),
            new Map(Object.entries(decisions)),
            indexImmediately,
            projectId ?? null,
        );

        return NextResponse.json({
            importedDocuments: result.documents,
            createdJobIds: result.createdJobIds,
        });
    } catch (error) {
        console.error("Google Drive import failed:", error);

        return NextResponse.json(
            { error: "Impossible d'importer les documents Google Drive." },
            { status: 500 },
        );
    }
}
