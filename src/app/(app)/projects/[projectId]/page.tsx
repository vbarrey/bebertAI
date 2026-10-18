import { notFound } from "next/navigation";
import { updateProject } from "@/lib/mutations/projects";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { MessagesSquare, Settings, Plus } from "lucide-react";

import { ConversationList } from "@/components/conversations/ConversationList";

import { getProjectWithConversations } from "@/lib/queries/project";
import { createConversation } from "@/lib/mutations/conversation";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  const project = await getProjectWithConversations(projectId);

  if (!project) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl p-6 lg:p-10">
      <header className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-semibold tracking-tight">{project.name}</h1>

          {project.description && (
            <p className="mt-1 text-muted-foreground">{project.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Modifier le projet">
                <Settings />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-xl">Modifier le projet</DialogTitle>
              </DialogHeader>
              <form action={updateProject} className="space-y-6">
                <input type="hidden" name="projectId" value={project.id} />

                <div className="flex flex-col gap-3">
                  <label
                    htmlFor="project-name"
                    className="text-sm font-medium pl-1"
                  >
                    Nom du projet
                  </label>

                  <Input
                    id="project-name"
                    name="name"
                    defaultValue={project.name}
                    className="max-w-md"
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <label
                    htmlFor="project-description"
                    className="text-sm font-medium pl-1"
                  >
                    Description
                  </label>
                  <Input
                    id="project-description"
                    name="description"
                    defaultValue={project.description || ""}
                    className="max-w-md"
                  />
                </div>

                <DialogFooter className="sm:justify-start">
                  <DialogClose asChild>
                    <Button type="submit">Enregistrer</Button>
                  </DialogClose>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <form action={createConversation}>
            <input type="hidden" name="projectId" value={project.id} />

            <Button type="submit">
              <Plus />
              Nouvelle conversation
            </Button>
          </form>
        </div>
      </header>

      <h2 className="mb-4 text-sm font-medium text-muted-foreground">
        {project.conversations.length} conversation{project.conversations.length !== 1 && "s"}
      </h2>

      {project.conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center">
          <MessagesSquare className="size-8 text-muted-foreground" />
          <p className="font-medium">Aucune conversation pour le moment</p>
          <p className="text-sm text-muted-foreground">
            Posez une première question sur vos documents avec « Nouvelle conversation ».
          </p>
        </div>
      ) : (
        <ConversationList projectId={project.id} conversations={project.conversations} />
      )}
    </div>
  );
}
