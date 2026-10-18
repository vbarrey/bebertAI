"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteConversation } from "@/lib/mutations/conversation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type DeleteConversationButtonProps = {
  projectId: string;
  conversationId: string;
  title: string;
};

export function DeleteConversationButton({ projectId, conversationId, title }: DeleteConversationButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);

    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("conversationId", conversationId);

    try {
      await deleteConversation(formData);
      toast.success("Conversation supprimée.");
    } catch {
      toast.error("Impossible de supprimer la conversation.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          // Shown on hover on a pointer, always on touch screens.
          className="size-8 text-muted-foreground opacity-100 transition-opacity hover:text-destructive focus-visible:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
          aria-label={`Supprimer la conversation « ${title} »`}
        >
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>

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
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
