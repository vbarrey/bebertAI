import { prisma } from "@/lib/prisma";

export async function findOrCreateSourceFolder(data: {
  path: string;
  label: string;
}) {
  return prisma.sourceFolder.upsert({ where: data, update: {}, create: data });
}
