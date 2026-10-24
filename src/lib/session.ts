import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

type SessionUser = typeof auth.$Infer.Session.user;

// Once per request, however many components ask.
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Pages and server actions: signed out, the visitor is sent to the sign-in page. */
export async function requireUser() {
  const session = await getSession();

  if (!session) redirect("/login");

  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (user.role !== "admin") redirect("/");

  return user;
}

/**
 * API routes: the signed-in user, or the response to return, 401 signed out or 403 for a user on an admin route.
 * Typed `never` so that it fits any route response type.
 */
export async function apiUser(
  { admin = false } = {},
): Promise<{ user: SessionUser; error?: undefined } | { user?: undefined; error: NextResponse<never> }> {
  const session = await getSession();

  if (!session) {
    return { error: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) as NextResponse<never> };
  }

  if (admin && session.user.role !== "admin") {
    return { error: NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 }) as NextResponse<never> };
  }

  return { user: session.user };
}
