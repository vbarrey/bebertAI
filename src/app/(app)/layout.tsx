"use server";

import { connection } from "next/server";

import { MainLayout } from "@/components/layout/MainLayout"
import { TooltipProvider } from "@/components/ui/tooltip";
import { prisma } from "@/lib/prisma"

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>){
    // Rendered per request, like every page under it: the build prerenders against an empty database
    // (Dockerfile), and a page prerendered then keeps showing it.
    await connection();

    const projects = await prisma.project.findMany({take: 20});

    return (
        <MainLayout projects={projects}>
            <TooltipProvider>{children}</TooltipProvider>
        </MainLayout>
    )
}