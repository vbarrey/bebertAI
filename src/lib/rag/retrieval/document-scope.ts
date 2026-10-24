import type { DocumentScope, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * The documents a conversation searches:
 * - outside any project, the library (the documents imported for a project are left out);
 * - in a project, its own documents, and the whole library or the documents it selected in it.
 */
export function documentScopeWhere(project: { id: string; documentScope: DocumentScope } | null): Prisma.DocumentWhereInput {
  if (!project) return { ownerProjectId: null };

  return project.documentScope === "ALL"
    ? { OR: [{ ownerProjectId: null }, { ownerProjectId: project.id }] }
    : { OR: [{ ownerProjectId: project.id }, { projects: { some: { projectId: project.id } } }] };
}

/** The project of the conversation and its scope, null outside any project. */
export async function getConversationScope(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { project: { select: { id: true, documentScope: true } } },
  });

  return conversation?.project ?? null;
}

/**
 * The ids of the documents the conversation may search, null when it may search them all: the Qdrant search is
 * then not filtered, as long as no document was imported for a project.
 */
export async function getSearchableDocumentIds(conversationId: string): Promise<string[] | null> {
  const project = await getConversationScope(conversationId);

  if (!project || project.documentScope === "ALL") {
    // The documents it must not see: those of the projects, or of the other projects.
    const hidden = await prisma.document.count({
      where: { ownerProjectId: project ? { not: project.id } : { not: null } },
    });

    if (hidden === 0) return null;
  }

  const documents = await prisma.document.findMany({ where: documentScopeWhere(project), select: { id: true } });
  return documents.map((document) => document.id);
}
