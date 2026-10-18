"use server";

import { connection } from "next/server";

import { MainLayout } from "@/components/layout/MainLayout"
import { TooltipProvider } from "@/components/ui/tooltip";
import { getProjects } from "@/lib/queries/project"

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>){
    // Rendered per request, like every page under it: the build prerenders against an empty database
    // (Dockerfile), and a page prerendered then keeps showing it.
    await connection();

    const projects = await getProjects(20);

    return (
        <MainLayout projects={projects}>
            <TooltipProvider>{children}</TooltipProvider>
        </MainLayout>
    )
}