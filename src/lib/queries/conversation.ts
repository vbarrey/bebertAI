import { prisma } from "@/lib/prisma";
import { cache } from "react";
import type { ChatSource } from "@/lib/ai/types";

export const getConversationModel = cache(
  async (conversationId: string) => prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { model: { select: { providerId: true, name: true } } },
  })
);

/** Null when unknown or another user's. */
export const getConversationWithMessages = cache(
  async (conversationId: string, userId: string) => {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId, userId },
      select: {
        id: true,
        title: true,
        project: { select: { id: true, name: true } },
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
            sources: true,
            createdAt: true,
          },
        },
      },
    });

    return conversation && {
      ...conversation,
      messages: conversation.messages.map((message) => ({
        ...message,
        // Only ever written by the chat stream, with the ChatSource[] shape.
        sources: (message.sources ?? undefined) as ChatSource[] | undefined,
      })),
    };
  }
);

const SIDEBAR_PROJECTS = 30;
const SIDEBAR_PROJECT_CONVERSATIONS = 5;
const SIDEBAR_CONVERSATIONS = 50;

/**
 * What the sidebar lists: the projects with their latest conversations, the most recently active first, and the
 * conversations outside any project.
 */
export const getSidebarTree = cache(async (userId: string) => {
  const conversationFields = { id: true, title: true, lastMessageAt: true } as const;

  const [projects, conversations] = await Promise.all([
    prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: SIDEBAR_PROJECTS,
      select: {
        id: true,
        name: true,
        updatedAt: true,
        _count: { select: { conversations: true } },
        conversations: { orderBy: { lastMessageAt: "desc" }, take: SIDEBAR_PROJECT_CONVERSATIONS, select: conversationFields },
      },
    }),
    prisma.conversation.findMany({
      where: { userId, projectId: null },
      orderBy: { lastMessageAt: "desc" },
      take: SIDEBAR_CONVERSATIONS,
      select: conversationFields,
    }),
  ]);

  // A project is as recent as its last message.
  const lastActivity = (project: (typeof projects)[number]) =>
    Math.max(project.updatedAt.getTime(), project.conversations[0]?.lastMessageAt.getTime() ?? 0);

  return { projects: projects.sort((a, b) => lastActivity(b) - lastActivity(a)), conversations };
});

export type SidebarTree = Awaited<ReturnType<typeof getSidebarTree>>;
