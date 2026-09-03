import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const getProvidersWithModels = cache(async () => {
  return await prisma.aIProvider.findMany({
    include: { models: { include: {capabilities: true}} },
    orderBy: [{isDefault: 'desc'}, {name: 'asc'}],
  });
});

export const getEnableProvidersWithModels = cache(async () => {
  return await prisma.aIProvider.findMany({
    where: { enabled: true, models: { some: {enabled: true}} },
    include: { models: { where: {enabled: true}} },
    orderBy: [{isDefault: 'desc'}, {name: 'asc'}],
  });
});

export const getProviderConfiguration = cache(async (providerId: string) => {
  return await prisma.aIProvider.findUnique({select: {configuration: true}, where: {id: providerId}})
})
