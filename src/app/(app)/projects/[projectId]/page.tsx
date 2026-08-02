import { notFound } from "next/navigation";
import { updateProject } from "@/lib/mutations/projects";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Settings, Plus } from "lucide-react";

import { ConversationGrid } from "@/components/conversations/ConversationGrid";

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
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col p-6 lg:p-10">
      <div className="flex gap-4 justify-between w-full">
        <h1 className="text-4xl">{project.name}</h1>

        <Dialog>
          <DialogTrigger>
            <Settings />
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
      </div>

      <p className="text-muted-foreground">{project.description}</p>

      <br />

      <div className="flex justify-end gap-2 mb-4">
        <form action={createConversation}>
          <input type="hidden" name="projectId" value={project.id} />

          <Button type="submit">
            <Plus />
            Nouvelle conversation
          </Button>
        </form>
      </div>

      <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed w-full">
        <div className="max-w-md text-center w-full">
          <h1 className="text-2xl font-semibold mt-4 mb-2">Conversations</h1>
          <ConversationGrid conversations={project.conversations} />
        </div>
      </div>
    </div>
  );
}
