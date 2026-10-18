import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ReactNode } from "react";

import { SettingsNav } from "@/components/settings/SettingsNav";

export default function SettingsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex h-full flex-col">
      {/* Phone: tabs above the page instead of the side panel. */}
      <SettingsNav className="flex gap-2 space-y-0 overflow-x-auto border-b p-3 [scrollbar-width:none] md:hidden [&>a]:shrink-0 [&>a]:whitespace-nowrap" />

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="15%" className="hidden p-4 md:block">
          <div className="mb-6 px-2">
            <h2 className="font-semibold">Réglages</h2>
          </div>

          <SettingsNav />
        </ResizablePanel>
        <ResizableHandle withHandle={true} className="hidden md:flex" />

        <ResizablePanel className="flex-1">{children}</ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
