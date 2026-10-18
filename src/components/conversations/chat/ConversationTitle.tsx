"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { renameConversation } from "@/lib/mutations/conversation";
import { Button } from "@/components/ui/button";

type ConversationTitleProps = {
  conversationId: string;
  projectId: string;
  title: string | null;
  onRename: (title: string) => void;
};

/** The conversation title, renamed in place: Enter or leaving the field saves, Escape cancels. */
export function ConversationTitle({ conversationId, projectId, title, onRename }: ConversationTitleProps) {
  const [editing, setEditing] = useState(false);

  async function save(value: string) {
    setEditing(false);

    const next = value.trim();
    if (!next || next === title) return;

    const previous = title;
    onRename(next);

    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("conversationId", conversationId);
    formData.set("title", next);

    try {
      await renameConversation(formData);
    } catch {
      if (previous) onRename(previous);
      toast.error("Impossible de renommer la conversation.");
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        defaultValue={title ?? ""}
        aria-label="Titre de la conversation"
        maxLength={100}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={(event) => save(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setEditing(false);
        }}
        className="mb-5 w-full rounded-md bg-transparent text-2xl font-bold outline-none ring-1 ring-ring/50"
      />
    );
  }

  return (
    <div className="group mb-5 flex min-w-0 items-center gap-2">
      <h1 className="min-w-0 truncate text-2xl font-bold">
        {/* The provisional title, then the generated one: a crossfade between them. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={title ?? ""}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {title ?? "Nouvelle conversation"}
          </motion.span>
        </AnimatePresence>
      </h1>

      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        onClick={() => setEditing(true)}
        aria-label="Renommer la conversation"
      >
        <Pencil className="size-4" />
      </Button>
    </div>
  );
}
