import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const getProvidersWithModels = cache(async () => {
  return await prisma.aIProvider.findMany({
    where: { enabled: true, models: { some: {enabled: true}} },
    include: { models: { where: {enabled: true}} },
    orderBy: [{isDefault: 'desc'}, {name: 'asc'}],
  });
});
