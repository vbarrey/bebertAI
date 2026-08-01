import { prisma } from "@/lib/prisma";
import { cache } from "react";

export const getProjects = cache(async (limit: number | undefined = undefined) => {
    return prisma.project.findMany({
        orderBy: {
            updatedAt: "desc",
        },
        take: limit
    });
});