import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { getAuthorizationUrl, STATE_COOKIE } from "@/lib/google-drive/auth";

/**
 * Sends the user to the Google consent screen. The state cookie lets the callback check the answer
 * comes from the flow started here (CSRF).
 */
export async function GET() {
    const state = randomBytes(16).toString("hex");
    const response = NextResponse.redirect(getAuthorizationUrl(state));

    response.cookies.set(STATE_COOKIE, state, {
        httpOnly: true,
        sameSite: "lax",
        path: "/api/google-drive",
        maxAge: 600,
    });

    return response;
}
