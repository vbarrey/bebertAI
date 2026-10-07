import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { getDocumentFilePath, deleteDocumentFile } from "@/lib/documents/storage";
import { deleteDocumentEmbeddings } from "@/lib/qdrant/points";

type RouteContext = {
    params: Promise<{
        documentId: string;
    }>;
};

const CONTENT_TYPES: Record<string, string> = {
    PDF: "application/pdf",
    TXT: "text/plain; charset=utf-8",
    DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(
    _request: Request,
    { params }: RouteContext,
) {
    const { documentId } = await params;

    const document = await prisma.document.findUnique({
        where: {
            id: documentId,
        },
        select: {
            storagePath: true,
            displayName: true,
            format: true,
            sourceType: true,
        },
    });

    if (!document) {
        return NextResponse.json(
            {
                error: "Document introuvable.",
            },
            {
                status: 404,
            },
        );
    }

    if (
        document.sourceType !== "LOCAL" ||
        !document.storagePath
    ) {
        return NextResponse.json(
            {
                error:
                    "Ce document ne possède pas de fichier local.",
            },
            {
                status: 404,
            },
        );
    }

    try {
        const filePath = getDocumentFilePath(
            document.storagePath,
        );

        const file = await readFile(filePath);

        return new NextResponse(file, {
            status: 200,
            headers: {
                "Content-Type":
                    CONTENT_TYPES[document.format] ??
                    "application/octet-stream",

                "Content-Length":
                    file.byteLength.toString(),

                "Content-Disposition":
                    `inline; filename="${encodeURIComponent(
                        document.displayName,
                    )}"`,

                "Cache-Control":
                    "private, max-age=3600",
            },
        });
    } catch (error) {
        console.error(
            `Failed to read document ${documentId}:`,
            error,
        );

        return NextResponse.json(
            {
                error:
                    "Le fichier du document est introuvable.",
            },
            {
                status: 404,
            },
        );
    }
}

export async function DELETE(
    _request: Request,
    { params }: RouteContext,
) {
    const { documentId } = await params;

    try {
        const document = await prisma.document.findUnique({
            where: {
                id: documentId,
            },
            select: {
                id: true,
                storagePath: true,
            },
        });

        if (!document) {
            return NextResponse.json(
                {
                    error: "Document introuvable.",
                },
                {
                    status: 404,
                },
            );
        }

        await prisma.document.delete({
            where: {
                id: document.id,
            },
        });

        await deleteDocumentFile(document.storagePath);

        await deleteDocumentEmbeddings(document.id).catch((error) =>
            console.error(`Failed to delete embeddings of document ${document.id}:`, error),
        );

        return new NextResponse(null, {
            status: 204,
        });
    } catch (error) {
        console.error(
            `Failed to delete document ${documentId}:`,
            error,
        );

        return NextResponse.json(
            {
                error: "Impossible de supprimer le document.",
            },
            {
                status: 500,
            },
        );
    }
}