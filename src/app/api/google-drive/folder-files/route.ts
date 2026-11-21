import { NextRequest, NextResponse } from "next/server";

import { GoogleDriveAuthError } from "@/lib/google-drive/auth";
import { getDriveItem, GoogleDriveApiError, listDriveFilesRecursive } from "@/lib/google-drive/client";
import { apiUser } from "@/lib/session";

/**
 * Every file under the folder ?id=, its subfolders included: its size before the import, then the lines of the
 * import queue. Metadata only, nothing is downloaded.
 */
export async function GET(request: NextRequest) {
    const { user, error: authError } = await apiUser();
    if (authError) return authError;

    const id = request.nextUrl.searchParams.get("id") ?? "";

    try {
        const folder = await getDriveItem(user.id, id);

        return NextResponse.json({ files: await listDriveFilesRecursive(user.id, folder) });
    } catch (error) {
        if (error instanceof GoogleDriveAuthError) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        if (error instanceof GoogleDriveApiError && (error.status === 400 || error.status === 404)) {
            return NextResponse.json({ error: "Dossier introuvable dans Google Drive." }, { status: 404 });
        }

        console.error(`Google Drive folder listing failed (${id}):`, error);

        return NextResponse.json({ error: "Impossible de lister le dossier Google Drive." }, { status: 502 });
    }
}
