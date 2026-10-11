import { NextRequest, NextResponse } from "next/server";

import { GoogleDriveAuthError } from "@/lib/google-drive/auth";
import { DriveFolderPage, GoogleDriveApiError, listDriveFolder } from "@/lib/google-drive/client";

type FilesResponse = { error: string } | DriveFolderPage;

/**
 * Content of a Drive folder: ?folderId= (My Drive when absent) and ?pageToken= for the next page.
 */
export async function GET(request: NextRequest): Promise<NextResponse<FilesResponse>> {
    const folderId = request.nextUrl.searchParams.get("folderId") || "root";
    const pageToken = request.nextUrl.searchParams.get("pageToken") || undefined;

    try {
        return NextResponse.json(await listDriveFolder(folderId, pageToken));
    } catch (error) {
        // 401: the dialog shows the connect button again.
        if (error instanceof GoogleDriveAuthError) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        if (error instanceof GoogleDriveApiError && (error.status === 400 || error.status === 404)) {
            return NextResponse.json({ error: "Dossier introuvable dans Google Drive." }, { status: 404 });
        }

        console.error(`Google Drive listing failed (${folderId}):`, error);

        return NextResponse.json(
            { error: "Impossible de lister le dossier Google Drive." },
            { status: 502 },
        );
    }
}
