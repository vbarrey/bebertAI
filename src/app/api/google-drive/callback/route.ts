import { NextRequest, NextResponse } from "next/server";

import { connectGoogleDrive, GoogleDriveAuthError, STATE_COOKIE } from "@/lib/google-drive/auth";
import { env } from "@/lib/env";
import { apiUser } from "@/lib/session";

// Back to the documents page, the result in the query for the import dialog. On APP_URL: behind the reverse proxy,
// a route handler's request.url is the container's own address (http://localhost:3000).
function redirectToDocuments(request: NextRequest, result: "connected" | "error" | "no-drive-access") {
    const response = NextResponse.redirect(new URL(`/documents?googleDrive=${result}`, env.APP_URL ?? request.url));

    response.cookies.delete({ name: STATE_COOKIE, path: "/api/google-drive" });

    return response;
}

export async function GET(request: NextRequest) {
    const { user, error: authError } = await apiUser();
    if (authError) return authError;

    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");

    // Refused consent (error=access_denied) or an answer to a flow this browser did not start.
    if (!code || !state || state !== request.cookies.get(STATE_COOKIE)?.value) {
        console.warn(
            "Google Drive callback rejected:",
            request.nextUrl.searchParams.get("error") ?? (code ? "state mismatch" : "no code"),
        );

        return redirectToDocuments(request, "error");
    }

    try {
        await connectGoogleDrive(user.id, code);

        return redirectToDocuments(request, "connected");
    } catch (error) {
        console.error("Google Drive connection failed:", error);

        return redirectToDocuments(request, error instanceof GoogleDriveAuthError ? "no-drive-access" : "error");
    }
}
