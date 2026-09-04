"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Project } from "@prisma/client";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";

import {
  ChevronsLeft,
  ChevronsRight,
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

const FADE_DURATION = 0.18;
const RESIZE_DURATION = 0.35;

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
      transition={{
        width: {
          duration: RESIZE_DURATION,
        },
      }}
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

          <AnimatePresence>
            <Image
              src="/logo.png"
              alt="Logo"
              width={24}
              height={24}
              className="size-6 shrink-0"
            />

            {!collapsed && (
              <motion.span
                key="title"
                initial={{
                  opacity: 0,
                  width: 0,
                  marginLeft: 0
                }}
                animate={{
                  opacity: collapsed ? 0 : 1,
                  width: collapsed ? 0 : "auto",
                  marginLeft: collapsed ? 0 : "calc(.25rem * 2)" // == TailwindCSS className ml-2
                }}
                exit={{
                  opacity: 0,
                  width: 0,
                  marginLeft: 0
                }}
                transition={{
                  opacity: {
                    duration: FADE_DURATION,
                    ease: "easeInOut"
                  },
                  width: {
                    duration: FADE_DURATION,
                    ease: "easeInOut"
                  },
                  marginLeft: {
                    duration: FADE_DURATION,
                    ease: "linear"
                  },
                }}
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
          transition={{
            rotate: {
              duration: 0.2,
            },
          }}
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
            <AnimatePresence>
              <Plus className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <motion.span
                  key="new-project-label"
                  initial={{
                    opacity: 0,
                    width: 0,
                    marginLeft: 0
                  }}
                  animate={{
                    opacity: collapsed ? 0 : 1,
                    width: collapsed ? 0 : "auto",
                    marginLeft: collapsed ? 0 : "calc(.25rem * 2)" // == TailwindCSS className ml-2
                  }}
                  exit={{
                    opacity: 0,
                    width: 0,
                    marginLeft: 0
                  }}
                  transition={{
                    opacity: {
                      duration: FADE_DURATION,
                      ease: "easeInOut"
                    },
                    width: {
                      duration: FADE_DURATION,
                      ease: "easeInOut"
                    },
                    marginLeft: {
                      duration: FADE_DURATION,
                      ease: "linear"
                    },
                  }}
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
        <AnimatePresence>
          <motion.span
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
            transition={{
              opacity: {
                duration: FADE_DURATION,
                ease: "easeInOut"
              },
              width: {
                duration: FADE_DURATION,
                ease: "easeInOut"
              }
            }}
            className="mb-2 overflow-hidden px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            Projets récents
          </motion.span>
        </AnimatePresence>

        <AnimatePresence>
          <nav className="space-y-1">
            {projects.length === 0 && !collapsed && (
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
                transition={{
                  opacity: {
                    duration: FADE_DURATION,
                    ease: "easeInOut"
                  },
                  width: {
                    duration: FADE_DURATION,
                    ease: "easeInOut"
                  }
                }}
                className="overflow-hidden rounded-lg px-3 py-2 text-sm text-muted-foreground"
              >
                Aucun projet
              </motion.div>
            )}
            {projects.length > 0 && (
              <ScrollArea className="h-[80vh] px-3" >
                {projects.map((project, index) => {
                  const isActive = pathname.startsWith(
                    `/projects/${project.id}`,
                  );
                  return (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      
                      aria-label={collapsed ? project.name : undefined}
                      className={cn(
                        "flex items-start rounded-lg transition-colors hover:bg-accent m-2 p-4 gap-2",
                        isActive && "bg-accent",
                      )}
                    >
                      <FolderOpen
                        className={cn(
                          "mt-0.5 h-4 w-4 text-muted-foreground"
                        )}
                      />

                      <motion.div
                        initial={{
                          opacity: 0,
                          width: 0,
                          height: 0,
                        }}
                        animate={{
                          opacity: collapsed ? 0 : 1,
                          width: collapsed ? 0 : "auto",
                          height: collapsed ? 0 : "auto",
                        }}
                        exit={{
                          opacity: 0,
                          width: 0,
                          height: 0,
                        }}
                        transition={{
                          opacity: {
                            delay: !collapsed ? index * 0.05 : 0,
                            duration: FADE_DURATION,
                            ease: "easeInOut"
                          },
                          width: {
                            delay: !collapsed ? index * 0.05 : 0,
                            duration: FADE_DURATION,
                            ease: "easeInOut"
                          },
                          height: {
                            duration: FADE_DURATION,
                            ease: "linear"
                          }
                        }}
                        className="min-w-0 overflow-hidden"
                      >
                        <p className="truncate text-sm font-medium">
                          {project.name}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {project.updatedAt.toLocaleDateString("fr-FR")}
                        </p>
                      </motion.div>
                    </Link>
                  );
                })}
              </ScrollArea>
            )}
          </nav>
        </AnimatePresence>
      </div>

      {/* Réglages */}
      <div
        className={cn(
          "border-t",
          collapsed ? "p-2" : "p-3",
        )}
      >
        <Link href="/settings/ai">
          <Button
            variant="ghost"
            className={cn(
              "gap-2",
              pathname.startsWith("/settings") && "bg-accent",
              collapsed
                ? "w-full justify-center"
                : "w-full justify-start",
            )}
            aria-label={collapsed ? "Réglages" : undefined}
          >
            <Settings className="h-4 w-4 shrink-0" />

            <motion.span
              initial={false}
              animate={{
                opacity: collapsed ? 0 : 1,
                width: collapsed ? 0 : "auto",
              }}
              transition={{
                opacity: {
                  duration: FADE_DURATION,
                },
                width: {
                  duration: FADE_DURATION,
                },
              }}
              className="overflow-hidden whitespace-nowrap"
            >
              Réglages
            </motion.span>
          </Button>
        </Link>
      </div>
    </motion.aside>
  );
}