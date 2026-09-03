import { ReactNode } from "react";
import type { Project } from "@prisma/client";

import { AppSidebar } from "./AppSidebar";
import { MobileHeader } from "./MobileHeader";

type MainLayoutProps = {
  projects: Project[];
  children: ReactNode;
};

export function MainLayout({
  projects,
  children,
}: MainLayoutProps) {
  return (
    <main className="flex min-h-screen bg-background">
      <AppSidebar
        projects={projects}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />

        <div className="h-[100vh] w-full flex-1 overflow-y-hidden">
          {children}
        </div>
      </div>
    </main>
  );
}