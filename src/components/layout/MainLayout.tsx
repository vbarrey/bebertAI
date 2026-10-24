import { ReactNode } from "react";
import type { SidebarTree } from "@/lib/queries/conversation";

import { MainSidebar } from "./MainSidebar";
import type { SidebarUser } from "./SidebarNav";
import { MobileHeader } from "./MobileHeader";

type MainLayoutProps = {
  tree: SidebarTree;
  user: SidebarUser;
  children: ReactNode;
};

export function MainLayout({
  tree,
  user,
  children,
}: MainLayoutProps) {
  return (
    <main className="flex h-screen bg-background">
      <MainSidebar tree={tree} user={user} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <MobileHeader tree={tree} user={user} />

        {/* Relative: the hidden native inputs of the Radix fields (absolute) stay inside its scroll. */}
        <div className="relative min-h-0 w-full flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </main>
  );
}