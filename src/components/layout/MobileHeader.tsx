import Link from "next/link";
import { FileSearch, Menu, Plus } from "lucide-react";

import { createProject } from "@/lib/mutations/projects";
import { Button } from "@/components/ui/button";

export function MobileHeader() {
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
          <input
            type="hidden"
            name="name"
            value="Nouveau projet"
          />

          <Button
            size="icon"
            variant="ghost"
            aria-label="Créer un projet"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        <Button
          size="icon"
          variant="ghost"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>
    </header>
  )
}