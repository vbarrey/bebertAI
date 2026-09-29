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
  Files,
} from "lucide-react";

import { createProject } from "@/lib/mutations/projects";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type MainSidebarProps = {
  projects: Project[];
};

const SIDEBAR_ANIMATION_DURATION = 0.2;
const SIDEBAR_ANIMATION_EASE = cubicBezier(0.9, 0, 0.1, 1);

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
      className="group hidden h-screen min-h-0 overflow-hidden border-r bg-background md:flex md:flex-col sticky top-0 left-0"
    >
      {/* Header */}
      <div className="relative flex h-16 shrink-0 items-center justify-center border-b px-2">
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
                  marginLeft: 0,
                }}
                animate={{
                  opacity: 1,
                  width: "auto",
                  marginLeft: "calc(.25rem * 2)",
                }}
                exit={{
                  opacity: 0,
                  width: 0,
                  marginLeft: 0,
                }}
                transition={SIDEBAR_TRANSITION}
                className="overflow-hidden whitespace-nowrap"
              >
                Bebert AI
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Collapse */}
      <motion.button
        type="button"
        initial={{ opacity: 0.7 }}
        whileHover={{ opacity: 1 }}
        onClick={toggleCollapsed}
        aria-label={
          collapsed
            ? "Agrandir la barre latérale"
            : "Réduire la barre latérale"
        }
        className="flex shrink-0 cursor-pointer items-center justify-center bg-gray-200 p-0"
      >
        <motion.div
          initial={false}
          animate={{
            rotate: collapsed ? 180 : 0,
          }}
          transition={SIDEBAR_TRANSITION}
          className="flex items-center justify-center"
        >
          <ChevronsLeft className="h-4 w-4" />
        </motion.div>
      </motion.button>

      {/* Nouveau projet */}
      <div className="shrink-0 p-2">
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
                    marginLeft: 0,
                  }}
                  animate={{
                    opacity: 1,
                    width: "auto",
                    marginLeft: "calc(.25rem * 2)",
                  }}
                  exit={{
                    opacity: 0,
                    width: 0,
                    marginLeft: 0,
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
      <div
        id="projectsPanel"
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* Label */}
        <div className="shrink-0">
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
                  height: "auto",
                }}
                exit={{
                  opacity: 0,
                  width: 0,
                  height: 0,
                }}
                transition={SIDEBAR_TRANSITION}
                className="my-2 block overflow-hidden px-3 text-nowrap text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Projets récents
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Liste scrollable */}
        <nav className="min-h-0 flex-1">
          {projects.length === 0 ? (
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div
                  layout
                  initial={{
                    opacity: 0,
                    width: 0,
                  }}
                  animate={{
                    opacity: 1,
                    width: "auto",
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
          ) : (
            <ScrollArea className="h-full min-h-0">
              <div className="space-y-1 px-3">
                {projects.map((project) => {
                  const isActive = pathname.startsWith(
                    `/projects/${project.id}`,
                  );

                  return (
                    <motion.div
                      key={project.id}
                      initial={false}
                      animate={{
                        padding: collapsed
                          ? "calc(.25rem * 2)"
                          : "calc(.25rem * 4)",
                        margin: collapsed
                          ? 0
                          : "calc(.25rem * 2)",
                      }}
                      className={cn(
                        "rounded-lg transition-colors hover:bg-accent",
                        isActive && "bg-accent",
                      )}
                    >
                      <Link
                        href={`/projects/${project.id}`}
                        aria-label={
                          collapsed ? project.name : undefined
                        }
                        className="flex min-w-0 items-start"
                      >
                        <FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

                        <AnimatePresence initial={false}>
                          {!collapsed && (
                            <motion.div
                              initial={{
                                opacity: 0,
                                width: 0,
                                height: 0,
                                marginLeft: 0,
                              }}
                              animate={{
                                opacity: 1,
                                width: "auto",
                                height: "auto",
                                marginLeft: "calc(.25rem * 2)",
                              }}
                              exit={{
                                opacity: 0,
                                width: 0,
                                height: 0,
                                marginLeft: 0,
                              }}
                              transition={SIDEBAR_TRANSITION}
                              className="min-w-0 overflow-hidden"
                            >
                              <p className="truncate text-sm font-medium">
                                {project.name}
                              </p>

                              <p className="text-xs text-muted-foreground">
                                {project.updatedAt.toLocaleDateString(
                                  "fr-FR",
                                )}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </nav>
      </div>

      {/* Navigation basse */}
      <div className="shrink-0 border-t p-2">
        <div className="flex flex-col">
          <Link href="/documents">
            <Button
              variant="ghost"
              className={cn(
                "flex w-full justify-center",
                pathname.startsWith("/documents") && "bg-accent",
              )}
              aria-label={collapsed ? "Documents" : undefined}
            >
              <Files className="h-4 w-4 shrink-0" />

              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.span
                    initial={{
                      opacity: 0,
                      width: 0,
                      marginLeft: 0,
                    }}
                    animate={{
                      opacity: 1,
                      width: "auto",
                      marginLeft: "calc(.25rem * 2)",
                    }}
                    exit={{
                      opacity: 0,
                      width: 0,
                      marginLeft: 0,
                    }}
                    transition={SIDEBAR_TRANSITION}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    Documents
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </Link>

          <Link href="/settings">
            <Button
              variant="ghost"
              className={cn(
                "flex w-full justify-center",
                pathname.startsWith("/settings") && "bg-accent",
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
                      marginLeft: 0,
                    }}
                    animate={{
                      opacity: 1,
                      width: "auto",
                      marginLeft: "calc(.25rem * 2)",
                    }}
                    exit={{
                      opacity: 0,
                      width: 0,
                      marginLeft: 0,
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
      </div>
    </motion.aside>
  );
}