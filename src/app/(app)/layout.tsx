"use server";

import { MainLayout } from "@/components/layout/MainLayout"
import { TooltipProvider } from "@/components/ui/tooltip";
import { prisma } from "@/lib/prisma"

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>){
    const projects = await prisma.project.findMany({take: 20});

    return (
        <MainLayout projects={projects}>
            <TooltipProvider>{children}</TooltipProvider>
        </MainLayout>
    )
}