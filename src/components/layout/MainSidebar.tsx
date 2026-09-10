"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Project } from "@prisma/client";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, cubicBezier } from "motion/react";

import {
  ChevronsLeft,
  FolderOpen,
  Plus,
  Settings,
} from "lucide-react";

import { createProject } from "@/lib/mutations/projects";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type MainSidebarProps = {
  projects: Project[];
};

const SIDEBAR_ANIMATION_DURATION = 0.20;
const SIDEBAR_ANIMATION_EASE = cubicBezier(.9, 0, .1, 1);

const SIDEBAR_TRANSITION = {
  width: {
    duration: SIDEBAR_ANIMATION_DURATION,
    ease: SIDEBAR_ANIMATION_EASE,
  },
  opacity: {
    duration: SIDEBAR_ANIMATION_DURATION,
    ease: SIDEBAR_ANIMATION_EASE,
  },
  height: {
    duration: SIDEBAR_ANIMATION_DURATION,
    ease: SIDEBAR_ANIMATION_EASE,
  },
  marginLeft: {
    duration: SIDEBAR_ANIMATION_DURATION / 2,
    ease: SIDEBAR_ANIMATION_EASE,
  },
};

export function MainSidebar({ projects }: MainSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const handleProjectCreation = async (data: FormData) => {
    data.set("projectName", crypto.randomUUID());
    await createProject(data);
  };

  const toggleCollapsed = () => {
    setCollapsed((value) => !value);
  };

  return (
    <motion.aside
      layout
      transition={SIDEBAR_TRANSITION}
      className="group hidden h-screen overflow-hidden border-r bg-background md:flex md:flex-col"
    >
      {/* Header */}
      <div
        className="relative flex h-16 items-center border-b justify-center px-2"
      >
        <Link
          href="/"
          aria-label="Bebert AI"
          className="flex min-w-0 items-center text-sm font-semibold tracking-tight"
        >

          <Image
            src="/logo.png"
            alt="Logo"
            width={24}
            height={24}
            className="size-6 shrink-0"
          />

          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                key="title"
                initial={{
                  opacity: 0,
                  width: 0,
                  marginLeft: 0
                }}
                animate={{
                  opacity: 1,
                  width: "auto",
                  marginLeft: "calc(.25rem * 2)" // == TailwindCSS className ml-2
                }}
                exit={{
                  opacity: 0,
                  width: 0,
                  marginLeft: 0
                }}
                transition={SIDEBAR_TRANSITION}
                className="overflow-hidden whitespace-nowrap"
              >
                Bebert AI
              </motion.span>)}
          </AnimatePresence>
        </Link>
      </div>


      <motion.div
        initial={{ opacity: 0.7 }}
        whileHover={{ opacity: 1 }}
        onClick={toggleCollapsed}
        aria-label={
          collapsed
            ? "Agrandir la barre latérale"
            : "Réduire la barre latérale"
        }
        className="flex align-center justify-center cursor-pointer bg-gray-200 p-0 mb-2">

        <motion.div
          initial={false}
          animate={{
            rotate: collapsed ? 180 : 0,
          }}
          transition={SIDEBAR_TRANSITION}
          className="flex align-center justify-center cursor-pointer bg-transparent opacity-100">
          <ChevronsLeft className="h-4 w-4" />
        </motion.div>
      </motion.div>

      {/* Nouveau projet */}
      <div
        className="p-2"
      >
        <form action={handleProjectCreation}>
          <Button
            className="w-full justify-center gap-0"
            aria-label="Créer un projet"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  key="new-project-label"
                  initial={{
                    opacity: 0,
                    width: 0,
                    marginLeft: 0
                  }}
                  animate={{
                    opacity: 1,
                    width: "auto",
                    marginLeft: "calc(.25rem * 2)" // == TailwindCSS className ml-2
                  }}
                  exit={{
                    opacity: 0,
                    width: 0,
                    marginLeft: 0
                  }}
                  transition={SIDEBAR_TRANSITION}
                  className="overflow-hidden whitespace-nowrap"
                >
                  Nouveau projet
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </form>
      </div>

      {/* Projets */}
      <div className="flex flex-1 flex-col">
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.span
              initial={{
                opacity: 0,
                width: 0,
                height: 0,
              }}
              animate={{
                opacity: 1,
                width: "auto",
                height: "auto"
              }}
              exit={{
                opacity: 0,
                width: 0,
                height: 0
              }}
              transition={SIDEBAR_TRANSITION}
              className="mb-2 overflow-hidden px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground text-nowrap"
            >
              Projets récents
            </motion.span>
          )}
        </AnimatePresence>


        {projects.length === 0 ? (
          <nav className="space-y-1">
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div
                  layout
                  initial={{
                    opacity: 0,
                    width: 0,
                  }}
                  animate={{
                    opacity: collapsed ? 0 : 1,
                    width: collapsed ? 0 : "auto",
                  }}
                  exit={{
                    opacity: 0,
                    width: 0,
                  }}
                  transition={SIDEBAR_TRANSITION}
                  className="overflow-hidden rounded-lg px-3 py-2 text-sm text-muted-foreground"
                >
                  Aucun projet
                </motion.div>
              )}
            </AnimatePresence>
          </nav>
        ) : (
          <nav className="space-y-1">
            <ScrollArea className="h-[80vh] px-3" >
              {projects.map((project) => {
                const isActive = pathname.startsWith(
                  `/projects/${project.id}`,
                );
                return (
                  <motion.div
                    key={project.id}
                    initial={false}
                    animate={{
                      padding: collapsed ? "calc(.25rem * 2)" : "calc(.25rem * 4)",
                      margin: collapsed ? 0 : "calc(.25rem * 2)"
                    }}
                    className={cn(
                      "rounded-lg transition-colors hover:bg-accent",
                      isActive && "bg-accent",
                    )}
                  >
                    <Link
                      href={`/projects/${project.id}`}

                      aria-label={collapsed ? project.name : undefined}
                      className="flex items-start"
                    >
                      <FolderOpen
                        className={cn(
                          "mt-0.5 h-4 w-4 text-muted-foreground"
                        )}
                      />

                      <AnimatePresence initial={false}>
                        {!collapsed && (
                          <motion.div
                            initial={{
                              opacity: 0,
                              width: 0,
                              height: 0,
                              marginLeft: 0
                            }}
                            animate={{
                              opacity: 1,
                              width: "auto",
                              height: "auto",
                              marginLeft: "calc(.25rem * 2)"
                            }}
                            exit={{
                              opacity: 0,
                              width: 0,
                              height: 0,
                              marginLeft: 0
                            }}
                            transition={SIDEBAR_TRANSITION}
                            className="min-w-0 overflow-hidden"
                          >
                            <p className="truncate text-sm font-medium">
                              {project.name}
                            </p>

                            <p className="text-xs text-muted-foreground">
                              {project.updatedAt.toLocaleDateString("fr-FR")}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Link>
                  </motion.div>
                );
              })}
            </ScrollArea>
          </nav>
        )}
      </div>

      {/* Réglages */}
      <div className="border-t p-2">
        <Link href="/settings">
          <Button
            variant="ghost"
            className={cn(
              "flex w-full justify-center",
              pathname.startsWith("/settings") && "bg-accent"
            )}
            aria-label={collapsed ? "Réglages" : undefined}
          >
            <Settings className="h-4 w-4 shrink-0" />

            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  initial={{
                    opacity: 0,
                    width: 0,
                    marginLeft: 0
                  }}
                  animate={{
                    opacity: 1,
                    width: "auto",
                    marginLeft: "calc(.25rem * 2)"
                  }}
                  exit={{
                    opacity: 0,
                    width: 0,
                    marginLeft: 0
                  }}
                  transition={SIDEBAR_TRANSITION}
                  className="overflow-hidden whitespace-nowrap"
                >
                  Réglages
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </Link>
      </div>
    </motion.aside>
  );
}