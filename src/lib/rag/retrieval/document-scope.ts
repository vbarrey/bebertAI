import type { DocumentScope, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type ConversationScope = { userId: string; project: { id: string; documentScope: DocumentScope } | null };

/**
 * The documents a conversation searches, always among its owner's:
 * - outside any project, the library (the documents imported for a project are left out);
 * - in a project, its own documents, and the whole library or the documents it selected in it.
 */
export function documentScopeWhere({ userId, project }: ConversationScope): Prisma.DocumentWhereInput {
  if (!project) return { userId, ownerProjectId: null };

  return {
    userId,
    ...(project.documentScope === "ALL"
      ? { OR: [{ ownerProjectId: null }, { ownerProjectId: project.id }] }
      : { OR: [{ ownerProjectId: project.id }, { projects: { some: { projectId: project.id } } }] }),
  };
}

/** The owner of the conversation and its project with its scope (null outside any project); null when unknown. */
export async function getConversationScope(conversationId: string): Promise<ConversationScope | null> {
  return prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { userId: true, project: { select: { id: true, documentScope: true } } },
  });
}

/**
 * The ids of the documents the conversation may search: the Qdrant search is always filtered by them, the
 * collection holding every user's chunks.
 */
export async function getSearchableDocumentIds(conversationId: string): Promise<string[]> {
  const scope = await getConversationScope(conversationId);

  if (!scope) return [];

  const documents = await prisma.document.findMany({ where: documentScopeWhere(scope), select: { id: true } });
  return documents.map((document) => document.id);
}
