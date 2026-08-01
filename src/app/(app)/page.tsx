import { ProjectGrid } from "@/components/projects/ProjectGrid";

import { getProjects } from "@/lib/queries/project";

export default async function Home() {
  
  const projects = await getProjects();

  return (
      <div className="mx-auto w-full max-w-7xl p-6">
        <section className="space-y-4">
          <h1 className="text-2xl font-bold">Mes projets</h1>
          <p className="text-muted-foreground">
            Retrouvez vos projets récents.
          </p>

          <ProjectGrid projects={projects} />
        </section>
      </div>
  );
}
