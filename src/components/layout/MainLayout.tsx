import { ReactNode } from "react";
import type { Project } from "@prisma/client";

import { MainSidebar } from "./MainSidebar";
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
    <main className="flex h-screen bg-background">
      <MainSidebar
        projects={projects}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <MobileHeader projects={projects} />

        <div className="min-h-0 w-full flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </main>
  );
}