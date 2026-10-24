import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ReactNode } from "react";

import { SettingsNav } from "@/components/settings/SettingsNav";
import { requireUser } from "@/lib/session";

export default async function SettingsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const isAdmin = (await requireUser()).role === "admin";

  return (
    <div className="flex h-full flex-col">
      {/* Phone: tabs above the page instead of the side panel. */}
      <SettingsNav className="flex gap-2 space-y-0 overflow-x-auto border-b p-3 [scrollbar-width:none] md:hidden [&>a]:shrink-0 [&>a]:whitespace-nowrap" isAdmin={isAdmin} />

      {/* The panels set their display inline: only an important rule hides the side one. */}
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1 max-md:[&>[data-slot=resizable-panel]:first-child]:hidden!">
        <ResizablePanel defaultSize="15%" className="p-4">
          <div className="mb-6 px-2">
            <h2 className="font-semibold">Réglages</h2>
          </div>

          <SettingsNav isAdmin={isAdmin} />
        </ResizablePanel>
        <ResizableHandle withHandle={true} className="hidden md:flex" />

        {/* Relative: the hidden native inputs of the Radix fields (absolute) stay inside its scroll. */}
        <ResizablePanel className="relative flex-1">{children}</ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
