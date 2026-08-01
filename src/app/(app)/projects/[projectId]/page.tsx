import { notFound } from "next/navigation";
import { updateProject } from "@/lib/mutations/projects";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { prisma } from "@/lib/prisma";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  const [project, projects] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.project.findMany({ take: 20 }),
  ]);

  if (!project) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col p-6 lg:p-10">
      <form action={updateProject} className="space-y-6">
        <input type="hidden" name="projectId" value={project.id} />

        <div className="flex flex-col gap-3">
          <label htmlFor="project-name" className="text-sm font-medium pl-1">
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

        <Button type="submit">Enregistrer</Button>
      </form>

      <div className="mt-12 flex flex-1 items-center justify-center rounded-xl border border-dashed">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold">{project.name}</h1>

          {/** TODO : Find conversation's objects and display them */}
          <p className="mt-3 text-muted-foreground">
            Aucune conversation n'a encore été créée dans ce projet.
          </p>
        </div>
      </div>
    </div>
  );
}
