import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

// Once per request, however many components ask.
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

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
