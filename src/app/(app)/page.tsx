import { ProjectGrid } from "@/components/projects/ProjectGrid";
import { getProjects } from "@/lib/queries/project";
import { requireUser } from "@/lib/session";

export default async function Home() {
  const user = await requireUser();
  const projects = await getProjects(user.id);

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
