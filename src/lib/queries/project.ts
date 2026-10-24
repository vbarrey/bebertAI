import { prisma } from "@/lib/prisma";
import { cache } from "react";

export const getProjects = cache(
  async (limit: number | undefined = undefined) => {
    return prisma.project.findMany({
      orderBy: {
        updatedAt: "desc",
      },
      take: limit,
    });
  }
);

export const getProject = cache(async (projectId: string) => {
  return prisma.project.findUnique({
    where: {
      id: projectId,
    },
  });
});

export const getProjectWithConversations = cache(async (projectId: string) => {
  return prisma.project.findUnique({
    where: {
      id: projectId,
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
