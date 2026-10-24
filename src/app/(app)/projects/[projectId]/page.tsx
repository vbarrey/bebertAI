import Link from "next/link";
import { notFound } from "next/navigation";
import { updateProject } from "@/lib/mutations/projects";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { MessagesSquare, Settings, Plus } from "lucide-react";

import { ConversationList } from "@/components/conversations/ConversationList";
import { ProjectDocuments } from "@/components/projects/ProjectDocuments";
import { getProjectDocuments } from "@/lib/queries/document";
import { cn } from "@/lib/utils";

import { getProjects, getProjectWithConversations } from "@/lib/queries/project";
import { requireUser } from "@/lib/session";
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
  // The tab shown: the conversations unless "documents".
  searchParams: Promise<{ tab?: string }>;
};

export default async function ProjectPage({ params, searchParams }: ProjectPageProps) {
  const { projectId } = await params;
  const tab = (await searchParams).tab === "documents" ? "documents" : "conversations";
  const user = await requireUser();
  const [project, projects, documents] = await Promise.all([
    getProjectWithConversations(projectId, user.id),
    getProjects(user.id),
    getProjectDocuments(projectId, user.id),
  ]);

  if (!project) notFound();

  const documentCount = documents.owned.length
    + (project.documentScope === "SELECTION" ? documents.selected.length : documents.selected.length + documents.library.length);

  const tabs = [
    { id: "conversations", label: "Conversations", count: project.conversations.length, href: `/projects/${project.id}` },
    { id: "documents", label: "Documents", count: documentCount, href: `/projects/${project.id}?tab=documents` },
  ];

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

      <nav aria-label="Sections du projet" className="mb-6 flex gap-1 border-b">
        {tabs.map(({ id, label, count, href }) => (
          <Link
            key={id}
            href={href}
            aria-current={tab === id ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{count}</span>
          </Link>
        ))}
      </nav>

      {tab === "documents" ? (
        <ProjectDocuments projectId={project.id} scope={project.documentScope} documents={documents} />
      ) : project.conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center">
          <MessagesSquare className="size-8 text-muted-foreground" />
          <p className="font-medium">Aucune conversation pour le moment</p>
          <p className="text-sm text-muted-foreground">
            Posez une première question sur vos documents avec « Nouvelle conversation ».
          </p>
        </div>
      ) : (
        <ConversationList
          projectId={project.id}
          conversations={project.conversations}
          projects={projects.map(({ id, name }) => ({ id, name }))}
        />
      )}
    </div>
  );
}
