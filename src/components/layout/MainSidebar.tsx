"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, cubicBezier } from "motion/react";
import { ChevronsLeft, Files, FolderPlus, LogOut, Settings, SquarePen } from "lucide-react";

import { createConversation } from "@/lib/mutations/conversation";
import { createProject } from "@/lib/mutations/projects";
import type { SidebarTree } from "@/lib/queries/conversation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { SidebarNav, type SidebarUser } from "./SidebarNav";
import { useSignOut } from "./useSignOut";
import { useThemeChoice } from "./useThemeChoice";

type MainSidebarProps = {
  tree: SidebarTree;
  user: SidebarUser;
};

// A fixed width: the sidebar no longer follows the length of its content.
const EXPANDED_WIDTH = 272;
const COLLAPSED_WIDTH = 56;

const SIDEBAR_TRANSITION = {
  duration: 0.2,
  ease: cubicBezier(0.9, 0, 0.1, 1),
};

export function MainSidebar({ tree, user }: MainSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const theme = useThemeChoice();
  const signOut = useSignOut();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
      transition={SIDEBAR_TRANSITION}
      className="sticky top-0 left-0 hidden h-screen min-h-0 shrink-0 flex-col overflow-hidden border-r bg-sidebar md:flex"
    >
      <div className={cn("flex h-14 shrink-0 items-center border-b px-3", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <Link href="/" className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight">
            <Image src="/logo.png" alt="" width={24} height={24} className="size-6 shrink-0" />
            <span className="truncate">Bebert AI</span>
          </Link>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Agrandir la barre latérale" : "Réduire la barre latérale"}
        >
          <ChevronsLeft className={cn("size-4 transition-transform duration-200", collapsed && "rotate-180")} />
        </Button>
      </div>

      {collapsed ? (
        // Collapsed: the actions and pages as icons, the lists hidden.
        <div className="flex flex-1 flex-col items-center gap-1 py-2">
          <form action={createConversation}>
            <Button size="icon" aria-label="Nouvelle conversation" title="Nouvelle conversation">
              <SquarePen />
            </Button>
          </form>

          <form action={createProject}>
            <Button variant="ghost" size="icon" aria-label="Nouveau projet" title="Nouveau projet">
              <FolderPlus />
            </Button>
          </form>

          <div className="mt-auto flex flex-col items-center gap-1">
            <Button variant="ghost" size="icon" asChild className={cn(pathname.startsWith("/documents") && "bg-accent")}>
              <Link href="/documents" aria-label="Documents" title="Documents"><Files /></Link>
            </Button>

            {user.role === "admin" && (
              <Button variant="ghost" size="icon" asChild className={cn(pathname.startsWith("/settings") && "bg-accent")}>
                <Link href="/settings" aria-label="Réglages" title="Réglages"><Settings /></Link>
              </Button>
            )}

            <Button variant="ghost" size="icon" onClick={theme.cycle} aria-label={theme.label} title={theme.label}>
              <theme.Icon />
            </Button>

            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Se déconnecter" title={`Se déconnecter (${user.email})`}>
              <LogOut />
            </Button>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1" style={{ width: EXPANDED_WIDTH }}>
          <SidebarNav tree={tree} user={user} />
        </div>
      )}
    </motion.aside>
  );
}
