"use client";

import { useState } from "react";
import Link from "next/link";
import { FileSearch, Menu, SquarePen } from "lucide-react";

import { createConversation } from "@/lib/mutations/conversation";
import type { SidebarTree } from "@/lib/queries/conversation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { SidebarNav, type SidebarUser } from "./SidebarNav";

type MobileHeaderProps = {
  tree: SidebarTree;
  user: SidebarUser;
};

export function MobileHeader({ tree, user }: MobileHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur md:hidden">
      <Link
        href="/"
        className="flex items-center gap-2 text-sm font-semibold"
      >
        <FileSearch className="h-5 w-5" />
        <span>Bebert AI</span>
      </Link>

      <div className="flex items-center gap-2">
        <form action={createConversation}>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Nouvelle conversation"
          >
            <SquarePen className="h-4 w-4" />
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
          <DialogContent
            showCloseButton={false}
            className="top-0 left-0 flex h-full max-w-[min(20rem,85vw)] translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:max-w-xs data-open:slide-in-from-left data-closed:slide-out-to-left"
          >
            <DialogTitle className="flex h-14 shrink-0 items-center border-b px-4 text-sm font-semibold">Bebert AI</DialogTitle>

            <div className="min-h-0 flex-1">
              <SidebarNav tree={tree} user={user} onNavigate={() => setMenuOpen(false)} />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  )
}
