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
              href="/settings/ai"
              className="flex items-center rounded-md bg-muted px-3 py-2 text-sm font-medium"
            >
              Fournisseurs et modèles d&apos;IA
            </a>
          </nav>
        </ResizablePanel>
        <ResizableHandle withHandle={true} />

        <ResizablePanel className="flex-1">{children}</ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}
