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
      conversations: {
        orderBy: {
          updatedAt: "desc",
        }
      }
    }
  });
});
