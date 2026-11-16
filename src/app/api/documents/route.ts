import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { documentPageQuerySchema } from "@/lib/documents/list-query";
import { getDocumentsPage } from "@/lib/queries/document";
import { apiUser } from "@/lib/session";

/**
 * A slice of the documents page, asked for as the user scrolls down. A route, not a server action: the actions run one
 * at a time, a page would wait behind a deletion.
 */
export async function GET(request: NextRequest) {
  const { user, error: authError } = await apiUser();
  if (authError) return authError;

  const query = documentPageQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) {
    return NextResponse.json({ error: z.prettifyError(query.error) }, { status: 400 });
  }

  return NextResponse.json(await getDocumentsPage(user.id, query.data));
}
