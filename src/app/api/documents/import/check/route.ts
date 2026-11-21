import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiUser } from "@/lib/session";

const CheckRequestSchema = z.object({
    checksums: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(500),
});

/**
 * The documents of the user already there with these checksums: an import of them is a conflict. Only the
 * checksums are sent, the files go up once their conflict is settled.
 */
export async function POST(request: Request) {
    const { user, error: authError } = await apiUser();
    if (authError) return authError;

    const parsed = CheckRequestSchema.safeParse(await request.json().catch(() => undefined));

    if (!parsed.success) {
        return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }

    const existing = await prisma.document.findMany({
        where: { userId: user.id, checksum: { in: parsed.data.checksums } },
        select: { id: true, displayName: true, checksum: true },
    });

    return NextResponse.json({
        conflicts: Object.fromEntries(
            existing.map((document) => [document.checksum, { documentId: document.id, displayName: document.displayName }]),
        ),
    });
}
