import { ReactNode } from "react";
import type { Project } from "@prisma/client";

import { AppSidebar } from "./AppSidebar";
import { MobileHeader } from "./MobileHeader";

type MainLayoutProps = {
  projects: Project[];
  activeProjectId?: string;
  children: ReactNode;
};

export function MainLayout({
  projects,
  activeProjectId,
  children,
}: MainLayoutProps) {
  return (
    <main className="flex min-h-screen bg-background">
      <AppSidebar
        projects={projects}
        activeProjectId={activeProjectId}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />

        <div className="flex-1">
          {children}
        </div>
      </div>
    </main>
  );
}