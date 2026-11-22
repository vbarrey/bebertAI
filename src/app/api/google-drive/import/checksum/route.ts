import { NextResponse } from "next/server";
import { z } from "zod";

import { calculateFileChecksumFromStream } from "@/lib/documents/checksum";
import { GoogleDriveAuthError } from "@/lib/google-drive/auth";
import { downloadDriveFile, GoogleDriveApiError, isDriveId } from "@/lib/google-drive/client";
import { apiUser } from "@/lib/session";

const ChecksumRequestSchema = z.object({ fileId: z.string().refine(isDriveId) });

/**
 * Checksum of a Drive file whose metadata gives none: streamed from Drive, nothing is stored.
 */
export async function POST(request: Request) {
    const { user, error: authError } = await apiUser();
    if (authError) return authError;

    const parsed = ChecksumRequestSchema.safeParse(await request.json().catch(() => undefined));

    if (!parsed.success) {
        return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }

    try {
        return NextResponse.json({
            checksum: await calculateFileChecksumFromStream(await downloadDriveFile(user.id, parsed.data.fileId)),
        });
    } catch (error) {
        if (error instanceof GoogleDriveAuthError) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        if (error instanceof GoogleDriveApiError && error.status === 404) {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }

        console.error(`Google Drive checksum failed (${parsed.data.fileId}):`, error);

        return NextResponse.json({ error: "Impossible de lire le fichier Google Drive." }, { status: 502 });
    }
}
