import { NextRequest, NextResponse } from "next/server";

import { GoogleDriveAuthError } from "@/lib/google-drive/auth";
import { DriveFolderPage, GoogleDriveApiError, listDriveFolder, searchDrive } from "@/lib/google-drive/client";

type FilesResponse = { error: string } | DriveFolderPage;

const MAX_SEARCH_LENGTH = 200;

/**
 * Content of a Drive folder: ?folderId= (My Drive when absent, "sharedWithMe" for the shared items),
 * or the files and folders matching ?search= in every folder; ?pageToken= for the next page.
 */
export async function GET(request: NextRequest): Promise<NextResponse<FilesResponse>> {
    const folderId = request.nextUrl.searchParams.get("folderId") || "root";
    const search = request.nextUrl.searchParams.get("search")?.trim();
    const pageToken = request.nextUrl.searchParams.get("pageToken") || undefined;

    if (search && search.length > MAX_SEARCH_LENGTH) {
        return NextResponse.json({ error: "Recherche trop longue." }, { status: 400 });
    }

    try {
        return NextResponse.json(
            search
                ? await searchDrive(search, pageToken)
                : await listDriveFolder(folderId, pageToken),
        );
    } catch (error) {
        // 401: the dialog shows the connect button again.
        if (error instanceof GoogleDriveAuthError) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        if (error instanceof GoogleDriveApiError && (error.status === 400 || error.status === 404)) {
            return NextResponse.json({ error: "Dossier introuvable dans Google Drive." }, { status: 404 });
        }

        console.error(`Google Drive listing failed (${search ? `search ${search}` : folderId}):`, error);

        return NextResponse.json(
            { error: "Impossible de lister le dossier Google Drive." },
            { status: 502 },
        );
    }
}
