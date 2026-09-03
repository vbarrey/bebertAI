"use client";

import Link from "next/link";
import Image from "next/image";
import type { Project } from "@prisma/client";
import { createProject } from "@/lib/mutations/projects";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { usePathname } from "next/navigation";

import { FolderOpen, Plus, Settings } from "lucide-react";

type AppSidebarProps = {
  projects: Project[];
};

export function AppSidebar({ projects }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-64 shrink-0 border-r bg-background md:flex md:flex-col">
      <div className="flex h-16 items-center border-b px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <Image src="/logo.png" alt="Logo" width={24} height={24} />
          <span>Bebert AI</span>
        </Link>
      </div>

      <div className="p-4">
        <form action={createProject}>
          <input type="hidden" name="name" value="Nouveau projet" />

          <Button className="w-full justify-start gap-2">
            <Plus className="h-4 w-4" />
            Nouveau projet
          </Button>
        </form>
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Projets récents
        </div>

        <nav className="space-y-1">
          {projects.length === 0 ? (
            <div className="rounded-lg px-3 py-2 text-sm text-muted-foreground">
              Aucun projet
            </div>
          ) : (
            projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className={cn(
                  "flex items-start gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent",
                  pathname.startsWith(`/projects/${project.id}`) && "bg-accent",
                )}
              >
                <FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{project.name}</p>

                  <p className="text-xs text-muted-foreground">
                    {project.updatedAt.toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </Link>
            ))
          )}
        </nav>
      </ScrollArea>

      <div className="border-t p-3">
        <Link href="/settings/ai" className="flex rox gap-2 items-center">
          <Button variant="ghost" className={cn("w-full justify-start gap-2", pathname.startsWith("/settings") && "bg-accent")}>
            <Settings className="h-4 w-4" />
            Réglages
          </Button>
        </Link>
      </div>
    </aside>
  );
}
