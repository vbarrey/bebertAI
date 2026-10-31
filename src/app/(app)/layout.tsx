import { redirect } from "next/navigation";
import { connection } from "next/server";

import { MainLayout } from "@/components/layout/MainLayout"
import { SetupWarning } from "@/components/layout/SetupWarning";
import { TooltipProvider } from "@/components/ui/tooltip";
import { needsOnboarding } from "@/lib/onboarding";
import { getSetupStatus } from "@/lib/pipeline/setup";
import { getSidebarTree } from "@/lib/queries/conversation"
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>){
    // Rendered per request, like every page under it: the build prerenders against an empty database
    // (Dockerfile), and a page prerendered then keeps showing it.
    await connection();

    const user = await requireUser();
    if (await needsOnboarding(user.id)) redirect("/bienvenue");

    const [tree, status] = await Promise.all([getSidebarTree(user.id), getSetupStatus(user.id)]);

    return (
        // Around the sidebar too: its truncated titles show the full text in a tooltip.
        <TooltipProvider>
            <MainLayout tree={tree} user={user}>
                <SetupWarning status={status} />
                {children}
            </MainLayout>
        </TooltipProvider>
    )
}