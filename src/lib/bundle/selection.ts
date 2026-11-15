import { IndexingStatus, type Prisma } from "@prisma/client";
import { z } from "zod";

/** What an export holds, as chosen in its dialog. */
export const ExportParametersSchema = z.object({
    selection: z.discriminatedUnion("kind", [
        // Picked one by one on the documents page.
        z.object({ kind: z.literal("documents"), documentIds: z.array(z.string().min(1)).min(1).max(100_000) }),
        // The library: the documents of no project.
        z.object({ kind: z.literal("library") }),
        // The project's own documents and the library documents it selected.
        z.object({ kind: z.literal("project"), projectId: z.string().min(1) }),
        // Everything, the documents of every project included.
        z.object({ kind: z.literal("all") }),
    ]),
    // The files of the local documents always; the Drive files too, downloaded at the export.
    files: z.enum(["local", "local+drive"]),
});

export type ExportParameters = z.infer<typeof ExportParametersSchema>;
export type ExportSelection = ExportParameters["selection"];

/** The user's documents of the selection, whatever their status. */
export function selectionWhere(userId: string, selection: ExportSelection): Prisma.DocumentWhereInput {
    switch (selection.kind) {
        case "documents":
            return { userId, id: { in: selection.documentIds } };
        case "library":
            return { userId, ownerProjectId: null };
        case "project":
            return { userId, OR: [{ ownerProjectId: selection.projectId }, { projects: { some: { projectId: selection.projectId } } }] };
        case "all":
            return { userId };
    }
}

/** Only the indexed documents are exported: the others have no vectors yet. */
export function exportedWhere(userId: string, selection: ExportSelection): Prisma.DocumentWhereInput {
    return { AND: [selectionWhere(userId, selection), { indexingStatus: IndexingStatus.PROCESSED }] };
}
