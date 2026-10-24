import { NextResponse } from "next/server";

import { disconnectGoogleDrive, getGoogleDriveConnection } from "@/lib/google-drive/auth";
import { apiUser } from "@/lib/session";

type ConnectionResponse =
    | { error: string }
    | { connected: false }
    | { connected: true; email: string };

export async function GET(): Promise<NextResponse<ConnectionResponse>> {
    const { error: authError } = await apiUser();
    if (authError) return authError;

    try {
        const connection = await getGoogleDriveConnection();

        return NextResponse.json(
            connection
                ? { connected: true, email: connection.email }
                : { connected: false },
        );
    } catch (error) {
        console.error("Google Drive status failed:", error);

        return NextResponse.json(
            { error: "Impossible de lire la connexion Google Drive." },
            { status: 500 },
        );
    }
}

export async function DELETE() {
    const { error: authError } = await apiUser();
    if (authError) return authError;

    try {
        await disconnectGoogleDrive();

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error("Google Drive disconnection failed:", error);

        return NextResponse.json(
            { error: "Impossible de déconnecter Google Drive." },
            { status: 500 },
        );
    }
}
