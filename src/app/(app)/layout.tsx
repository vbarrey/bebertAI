"use server";

import { connection } from "next/server";

import { MainLayout } from "@/components/layout/MainLayout"
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSidebarTree } from "@/lib/queries/conversation"

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>){
    // Rendered per request, like every page under it: the build prerenders against an empty database
    // (Dockerfile), and a page prerendered then keeps showing it.
    await connection();

    const tree = await getSidebarTree();

    return (
        // Around the sidebar too: its truncated titles show the full text in a tooltip.
        <TooltipProvider>
            <MainLayout tree={tree}>{children}</MainLayout>
        </TooltipProvider>
    )
}