import { prisma } from "@/lib/prisma";
import { cache } from "react";

export const getProjectConversations = cache(
  async (projectId: string) => {
    return prisma.conversation.findMany({
      where: { projectId },
    });
  }
);

export const getConversation = cache(
  async (conversationId: string) => prisma.conversation.findUnique({ where: { id: conversationId } })
);

export const getConversationModel = cache(
  async (conversationId: string) => prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { model: { select: { providerId: true, name: true } } },
  })
);

export const getConversationWithMessages = cache(
  async (conversationId: string, projectId: string) => {
    return prisma.conversation.findUnique({
      where: {
        id: conversationId,
        projectId: projectId
      },
      select: {
        id: true,
        title: true,
        projectId: true,
        model: {
          select: { providerId: true, name: true },
        },
        messages: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            role: true,
            status: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });
  }
);

export const getConversationCount = cache(
  async (projectId: string) =>
    prisma.conversation.count({ where: { projectId } 
  })
);
