import { prisma } from "@/lib/prisma";
import { cache } from "react";

/**
 * Only get COMPLETED messages ordered by createdAt.
 * @param conversationId 
 */
export const getConversationMessages = cache((conversationId: string) =>
  prisma.message.findMany({ where: { conversationId: conversationId, status: "COMPLETED" }, orderBy: { createdAt: "asc" }})
);
