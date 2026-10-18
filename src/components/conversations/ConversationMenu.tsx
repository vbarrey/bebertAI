"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FolderInput, FolderMinus, FolderOpen, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteConversation, moveConversation, renameConversation } from "@/lib/mutations/conversation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ConversationMenuProps = {
  conversation: { id: string; title: string | null };
  // The project of the conversation, null outside any project.
  projectId: string | null;
  // Where it can be moved.
  projects: { id: string; name: string }[];
  className?: string;
};

/** The actions on a conversation: rename, move to another project or out of it, delete. */
export function ConversationMenu({ conversation, projectId, projects, className }: ConversationMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(false);

  const title = conversation.title ?? "Nouvelle conversation";
  const otherProjects = projects.filter((project) => project.id !== projectId);

  async function run(action: () => Promise<unknown>, error: string, success?: string) {
    setLoading(true);
    try {
      await action();
      if (success) toast.success(success);
      return true;
    } catch {
      toast.error(error);
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function rename(formData: FormData) {
    const next = formData.get("title")?.toString().trim();
    setRenaming(false);
    if (!next || next === conversation.title) return;
    await run(() => renameConversation(conversation.id, next), "Impossible de renommer la conversation.");
  }

  async function move(target: { id: string; name: string } | null) {
    await run(
      () => moveConversation(conversation.id, target?.id ?? null),
      "Impossible de déplacer la conversation.",
      target ? `Conversation déplacée dans « ${target.name} ».` : "Conversation sortie du projet.",
    );
  }

  async function remove() {
    const deleted = await run(() => deleteConversation(conversation.id), "Impossible de supprimer la conversation.", "Conversation supprimée.");
    // The open conversation no longer exists: back to its project, or home.
    if (deleted && pathname === `/conversations/${conversation.id}`) {
      router.push(projectId ? `/projects/${projectId}` : "/");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("size-7 text-muted-foreground", className)}
            aria-label={`Actions de la conversation « ${title} »`}
            disabled={loading}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => setRenaming(true)}>
            <Pencil />
            Renommer
          </DropdownMenuItem>

          {(otherProjects.length > 0 || projectId) && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInput />
                Déplacer vers
              </DropdownMenuSubTrigger>

              <DropdownMenuSubContent>
                {otherProjects.map((project) => (
                  <DropdownMenuItem key={project.id} onSelect={() => move(project)}>
                    <FolderOpen />
                    <span className="truncate">{project.name}</span>
                  </DropdownMenuItem>
                ))}

                {projectId && (
                  <>
                    {otherProjects.length > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuItem onSelect={() => move(null)}>
                      <FolderMinus />
                      Hors projet
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
            <Trash2 />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer la conversation</DialogTitle>
          </DialogHeader>

          <form action={rename} className="space-y-4">
            <Input name="title" defaultValue={conversation.title ?? ""} maxLength={100} autoFocus aria-label="Titre" />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenaming(false)}>Annuler</Button>
              <Button type="submit">Renommer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette conversation ?</AlertDialogTitle>

            <AlertDialogDescription>
              La conversation « <strong>{title}</strong> » et tous ses messages seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Annuler</AlertDialogCancel>

            <AlertDialogAction
              disabled={loading}
              onClick={remove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
