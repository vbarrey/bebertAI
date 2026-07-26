import { prisma } from "@/lib/prisma";

export const projectRepository = {
  create(name: string) {
    return prisma.project.create({ data: { name } });
  },

  findById(id: string) {
    return prisma.project.findUnique({
      where: { id },
      include: { conversations: { orderBy: { updatedAt: "desc" } } },
    });
  },

  listRecent() {
    return prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      take: 30,
    });
  },

  rename(id: string, name: string) {
    return prisma.project.update({ where: { id }, data: { name } });
  },
};
