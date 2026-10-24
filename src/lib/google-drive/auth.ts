import { prisma } from "@/lib/prisma";

import { decryptToken, encryptToken } from "@/lib/encryption";

const AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

const SCOPES = [
    "openid",
    "email",
    "https://www.googleapis.com/auth/drive.readonly",
];

// OAuth state of the flow in progress, checked by the callback.
export const STATE_COOKIE = "google-drive-oauth-state";

// An access token this close to its expiry is refreshed before use.
const EXPIRY_MARGIN_MS = 60_000;

// Not connected, or the connection was revoked or expired: the user has to connect again.
export class GoogleDriveAuthError extends Error {
    constructor(message = "Google Drive n'est pas connecté. Reconnectez votre compte.") {
        super(message);
        this.name = "GoogleDriveAuthError";
    }
}

type TokenResponse = {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    id_token?: string;
};

function oauthClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
        throw new Error("GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et GOOGLE_REDIRECT_URI doivent être définis.");
    }

    return { clientId, clientSecret, redirectUri };
}

async function requestToken(parameters: Record<string, string>): Promise<TokenResponse> {
    const { clientId, clientSecret } = oauthClient();

    const response = await fetch(TOKEN_URL, {
        method: "POST",
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            ...parameters,
        }),
    });

    if (response.ok) {
        return response.json();
    }

    const { error } = await response.json().catch(() => ({ error: undefined }));

    // Revoked from the Google account, expired (7 days for an app in testing) or code already used.
    if (error === "invalid_grant") {
        throw new GoogleDriveAuthError();
    }

    throw new Error(`Google OAuth : ${response.status} ${error ?? response.statusText}`);
}

function expiresAt(expiresIn: number) {
    return new Date(Date.now() + expiresIn * 1000);
}

// `prompt=consent` makes Google return a refresh token even when the app was already allowed.
export function getAuthorizationUrl(state: string): string {
    const { clientId, redirectUri } = oauthClient();

    return `${AUTHORIZATION_URL}?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: SCOPES.join(" "),
        access_type: "offline",
        prompt: "consent",
        state,
    })}`;
}

/**
 * Exchanges the authorization code and stores the tokens, replacing the account connected before.
 */
export async function connectGoogleDrive(code: string): Promise<string> {
    const tokens = await requestToken({
        code,
        grant_type: "authorization_code",
        redirect_uri: oauthClient().redirectUri,
    });

    if (!tokens.refresh_token || !tokens.id_token) {
        throw new Error("Google n'a pas renvoyé de refresh token.");
    }

    // Received straight from Google over TLS: its payload is read without checking the signature.
    const { email } = JSON.parse(
        Buffer.from(tokens.id_token.split(".")[1], "base64url").toString("utf8"),
    ) as { email: string };

    const data = {
        email,
        refreshToken: encryptToken(tokens.refresh_token),
        accessToken: encryptToken(tokens.access_token),
        expiresAt: expiresAt(tokens.expires_in),
    };

    await prisma.googleDriveConnection.upsert({
        where: { id: 1 },
        create: data,
        update: data,
    });

    return email;
}

export async function getGoogleDriveConnection() {
    return prisma.googleDriveConnection.findUnique({
        where: { id: 1 },
        select: { email: true },
    });
}

/**
 * A valid access token, refreshed when it is about to expire. Used by the app and by the indexing worker.
 */
export async function getGoogleDriveAccessToken(): Promise<string> {
    const connection = await prisma.googleDriveConnection.findUnique({ where: { id: 1 } });

    if (!connection) {
        throw new GoogleDriveAuthError();
    }

    if (connection.expiresAt.getTime() - Date.now() > EXPIRY_MARGIN_MS) {
        return decryptToken(connection.accessToken);
    }

    let tokens: TokenResponse;

    try {
        tokens = await requestToken({
            refresh_token: decryptToken(connection.refreshToken),
            grant_type: "refresh_token",
        });
    } catch (error) {
        // The refresh token no longer works: shown as disconnected so the user connects again.
        if (error instanceof GoogleDriveAuthError) {
            await prisma.googleDriveConnection.deleteMany();
        }

        throw error;
    }

    await prisma.googleDriveConnection.update({
        where: { id: 1 },
        data: {
            accessToken: encryptToken(tokens.access_token),
            expiresAt: expiresAt(tokens.expires_in),
        },
    });

    return tokens.access_token;
}

/**
 * Revokes the access at Google (best effort: the tokens are forgotten anyway) and deletes the connection.
 */
export async function disconnectGoogleDrive() {
    const connection = await prisma.googleDriveConnection.findUnique({ where: { id: 1 } });

    if (!connection) {
        return;
    }

    await fetch(REVOKE_URL, {
        method: "POST",
        body: new URLSearchParams({ token: decryptToken(connection.refreshToken) }),
    }).catch((error) => console.error("Google Drive token revocation failed:", error));

    await prisma.googleDriveConnection.deleteMany();
}
