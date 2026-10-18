"use client";

import { useState } from "react";
import Link from "next/link";
import type { Project } from "@prisma/client";
import { usePathname } from "next/navigation";
import { FileSearch, Files, FolderOpen, Menu, Plus, Settings } from "lucide-react";

import { createProject } from "@/lib/mutations/projects";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { useThemeChoice } from "./useThemeChoice";

type MobileHeaderProps = {
  projects: Project[];
};

export function MobileHeader({ projects }: MobileHeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const theme = useThemeChoice();

  const linkClassName = (active: boolean) =>
    cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent", active && "bg-accent");

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur md:hidden">
      <Link
        href="/"
        className="flex items-center gap-2 text-sm font-semibold"
      >
        <FileSearch className="h-5 w-5" />
        <span>Bebert AI</span>
      </Link>

      <div className="flex items-center gap-2">
        <form action={createProject}>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Créer un projet"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
          <DialogTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </DialogTrigger>

          {/* A panel along the left edge rather than a centered dialog. */}
          <DialogContent className="top-0 left-0 flex h-full max-w-[min(20rem,85vw)] translate-x-0 translate-y-0 flex-col rounded-none p-3 sm:max-w-xs data-open:slide-in-from-left data-closed:slide-out-to-left">
            <DialogTitle className="px-3 pt-1 text-sm font-semibold">Bebert AI</DialogTitle>

            <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Projets récents
            </p>

            <ScrollArea className="min-h-0 flex-1">
              <nav className="space-y-1">
                {projects.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">Aucun projet</p>
                )}

                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    onClick={closeMenu}
                    className={linkClassName(pathname.startsWith(`/projects/${project.id}`))}
                  >
                    <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{project.name}</span>
                  </Link>
                ))}
              </nav>
            </ScrollArea>

            <nav className="space-y-1 border-t pt-2">
              <Link href="/documents" onClick={closeMenu} className={linkClassName(pathname.startsWith("/documents"))}>
                <Files className="h-4 w-4 shrink-0" />
                Documents
              </Link>

              <Link href="/settings" onClick={closeMenu} className={linkClassName(pathname.startsWith("/settings"))}>
                <Settings className="h-4 w-4 shrink-0" />
                Réglages
              </Link>

              <button type="button" onClick={theme.cycle} className={cn(linkClassName(false), "w-full")}>
                <theme.Icon className="h-4 w-4 shrink-0" />
                {theme.label}
              </button>
            </nav>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  )
}
