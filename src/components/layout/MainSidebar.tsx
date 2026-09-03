"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Project } from "@prisma/client";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";

import {
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
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

const SIDEBAR_WIDTH = 256;
const SIDEBAR_COLLAPSED_WIDTH = 98;

const FADE_DURATION = 0.18;
const RESIZE_DURATION = 0.35;

export function MainSidebar({ projects }: MainSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((value) => !value);
  };

  return (
    <motion.aside
      initial={false}
      animate={{
        width: collapsed
          ? SIDEBAR_COLLAPSED_WIDTH
          : SIDEBAR_WIDTH,
      }}
      transition={{
        width: {
          duration: RESIZE_DURATION,
          ease: "easeInOut",
          delay: collapsed ? FADE_DURATION : 0,
        },
      }}
      className="group hidden h-screen shrink-0 overflow-hidden border-r bg-background md:flex md:flex-col"
    >
      {/* Header */}
      <div
        className={cn(
          "relative flex h-16 shrink-0 items-center border-b",
          collapsed ? "justify-center px-2" : "px-6",
        )}
      >
        <Link
          href="/"
          aria-label="Bebert AI"
          className="flex min-w-0 shrink-0 items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <Image
            src="/logo.png"
            alt="Logo"
            width={24}
            height={24}
            className="size-6 shrink-0"
          />

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
            Bebert AI
          </motion.span>
        </Link>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          aria-label={
            collapsed
              ? "Agrandir la barre latérale"
              : "Réduire la barre latérale"
          }
          className={cn(
            "absolute right-2 z-10 shrink-0",
            "opacity-0 pointer-events-none",
            "transition-opacity duration-150",
            "group-hover:pointer-events-auto group-hover:opacity-100",
            "focus-visible:pointer-events-auto focus-visible:opacity-100",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Nouveau projet */}
      <div
        className={cn(
          "shrink-0",
          collapsed ? "p-2" : "p-4",
        )}
      >
        <form action={createProject}>
          <Button
            className={cn(
              "gap-2",
              collapsed
                ? "w-full justify-center"
                : "w-full justify-start",
            )}
            aria-label="Créer un projet"
          >
            <Plus className="h-4 w-4 shrink-0" />

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
              Nouveau projet
            </motion.span>
          </Button>
        </form>
      </div>

      {/* Projets */}
      <ScrollArea className="min-h-0 flex-1 px-3">
        <motion.div
          initial={false}
          animate={{
            opacity: collapsed ? 0 : 1,
            height: collapsed ? 0 : 20,
          }}
          transition={{
            duration: FADE_DURATION,
          }}
          className="mb-2 overflow-hidden px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          Projets récents
        </motion.div>

        <nav className="space-y-1">
          {projects.length === 0 ? (
            <motion.div
              initial={false}
              animate={{
                opacity: collapsed ? 0 : 1,
                height: collapsed ? 0 : "auto",
              }}
              transition={{
                duration: FADE_DURATION,
              }}
              className="overflow-hidden rounded-lg px-3 py-2 text-sm text-muted-foreground"
            >
              Aucun projet
            </motion.div>
          ) : (
            projects.map((project) => {
              const isActive = pathname.startsWith(
                `/projects/${project.id}`,
              );

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  aria-label={collapsed ? project.name : undefined}
                  className={cn(
                    "flex items-start rounded-lg py-2 transition-colors hover:bg-accent",
                    collapsed
                      ? "justify-center px-0"
                      : "gap-3 px-3",
                    isActive && "bg-accent",
                  )}
                >
                  <FolderOpen
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground",
                      collapsed && "mt-0",
                    )}
                  />

                  <motion.div
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
            })
          )}
        </nav>
      </ScrollArea>

      {/* Réglages */}
      <div
        className={cn(
          "shrink-0 border-t",
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