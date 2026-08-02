import type { Project } from "@prisma/client";
import { FolderSearch } from "lucide-react";
import { ProjectCard } from "./ProjectCard";

type ProjectGridProps = {
  projects: Project[];
};

export function ProjectGrid({ projects }: ProjectGridProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
        <FolderSearch className="mb-4 h-10 w-10 text-muted-foreground" />

        <h2 className="text-lg font-semibold">
          Aucun projet
        </h2>

        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Crée ton premier projet pour commencer à discuter avec
          tes documents.
        </p>
      </div>
    );
  }

  return (
    <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
        />
      ))}
    </section>
  );
}