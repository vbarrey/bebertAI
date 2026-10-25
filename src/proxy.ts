import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Reached without a session.
const PUBLIC_PATHS = ["/login", "/mot-de-passe-oublie", "/reinitialiser", "/invitation", "/api/auth", "/api/health"];

/**
 * Turns away the requests without a session cookie: the sign-in page for a page, a 401 for the API.
 * Only the cookie's presence is checked here; pages, routes and actions check the session itself.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (getSessionCookie(request) || PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);

  return NextResponse.redirect(login);
}

/** The page asked before signing in (?next= set above): a path of this site only, never another site. */
export function safeNext(next: string | undefined) {
  return next?.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export const config = {
  // Not the build files nor the public images. Nor the import uploads: the proxy would buffer their body and keep
  // only its first 10 MB; those routes check the session themselves.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/documents/import|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
