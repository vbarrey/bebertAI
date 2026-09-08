import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ReactNode } from "react";

export default function SettingsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <main className="flex min-h-screen">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize="15%" className="p-4">
          <div className="mb-6 px-2">
            <h2 className="font-semibold">Paramètres</h2>
          </div>

          <nav className="space-y-1">
            <a
              href="/settings/provider"
              className="flex items-center rounded-md px-3 py-2 text-sm font-medium border"
            >
              Fournisseurs et modèles d&apos;IA
            </a>
            <a
              href="/settings/pipeline"
              className="flex items-center rounded-md px-3 py-2 text-sm font-medium border"
            >
              Pipeline
            </a>
          </nav>
        </ResizablePanel>
        <ResizableHandle withHandle={true} />

        <ResizablePanel className="flex-1">{children}</ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}
