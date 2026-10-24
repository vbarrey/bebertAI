import { prisma } from "@/lib/prisma";
import { cache } from "react";

export const getProjects = cache(
  async (userId: string, limit: number | undefined = undefined) => {
    return prisma.project.findMany({
      where: { userId },
      orderBy: {
        updatedAt: "desc",
      },
      take: limit,
    });
  }
);

/** Null when unknown or another user's. */
export const getProjectWithConversations = cache(async (projectId: string, userId: string) => {
  return prisma.project.findUnique({
    where: {
      id: projectId,
      userId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      documentScope: true,
      conversations: {
        orderBy: { lastMessageAt: "desc" },
        select: {
          id: true,
          title: true,
          lastMessageAt: true,
          _count: { select: { messages: true } },
          // The first question: the title of a conversation never titled, else its subtitle.
          messages: {
            where: { role: "USER" },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { content: true },
          },
        },
      }
    }
  });
});
