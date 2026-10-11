import { pipelineCapabilities } from "@/lib/pipeline/capabilities";
import { DocumentFormat, getDocumentFormat } from "@/lib/documents/format";

import { getGoogleDriveAccessToken } from "./auth";

const DRIVE_API_URL = "https://www.googleapis.com/drive/v3";

export const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

// Drive ids are letters, digits, - and _: checked before they go into a query.
const DRIVE_ID = /^[A-Za-z0-9_-]+$/;

export class GoogleDriveApiError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
        this.name = "GoogleDriveApiError";
    }
}

export type DriveItem = {
    id: string;
    name: string;
    mimeType: string;
    isFolder: boolean;
    // Import format of a file, null for a folder or a file the pipeline does not support.
    format: DocumentFormat | null;
    size: number | null;
    modifiedTime: string;
};

export type DriveFolderPage = {
    items: DriveItem[];
    nextPageToken: string | null;
};

type DriveFile = {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    modifiedTime: string;
};

export function isDriveId(value: string) {
    return DRIVE_ID.test(value);
}

async function driveFetch<T>(path: string, parameters: Record<string, string>): Promise<T> {
    const response = await fetch(`${DRIVE_API_URL}${path}?${new URLSearchParams(parameters)}`, {
        headers: { Authorization: `Bearer ${await getGoogleDriveAccessToken()}` },
    });

    if (!response.ok) {
        const body = await response.json().catch(() => undefined);

        throw new GoogleDriveApiError(
            response.status,
            `Google Drive : ${response.status} ${body?.error?.message ?? response.statusText}`,
        );
    }

    return response.json();
}

function toDriveItem(file: DriveFile): DriveItem {
    const isFolder = file.mimeType === FOLDER_MIME_TYPE;
    const format = isFolder ? null : getDocumentFormat(file.name, file.mimeType);

    return {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        isFolder,
        format: format && pipelineCapabilities.import.supportedFormat.includes(format) ? format : null,
        size: file.size ? Number(file.size) : null,
        modifiedTime: file.modifiedTime,
    };
}

/**
 * One page of the content of a folder ("root" for My Drive), folders first, then by name.
 */
export async function listDriveFolder(folderId: string, pageToken?: string): Promise<DriveFolderPage> {
    if (!isDriveId(folderId)) {
        throw new GoogleDriveApiError(400, `Identifiant de dossier invalide : ${folderId}`);
    }

    const page = await driveFetch<{ files: DriveFile[]; nextPageToken?: string }>("/files", {
        q: `'${folderId}' in parents and trashed = false`,
        fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime)",
        orderBy: "folder, name",
        pageSize: "100",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
        ...(pageToken ? { pageToken } : {}),
    });

    return {
        items: page.files.map(toDriveItem),
        nextPageToken: page.nextPageToken ?? null,
    };
}
