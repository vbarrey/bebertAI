import { notFound } from "next/navigation";
import { renameProjectAction } from "@/app/actions/projects";
import { AppSidebar, MobileHeader } from "@/components/app-sidebar";
import { projectService } from "@/modules/projects/project.service";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  const [project, projects] = await Promise.all([
    projectService.getById(projectId),
    projectService.listRecent(),
  ]);

  if (!project) notFound();

  return (
    <main className="workspace">
      <AppSidebar projects={projects} activeProjectId={project.id} />
      <section className="main-panel">
        <MobileHeader />
        <div className="project-page">
          <form action={renameProjectAction} className="project-title-form">
            <input type="hidden" name="projectId" value={project.id} />
            <label htmlFor="project-name">Nom du projet</label>
            <div>
              <input id="project-name" name="name" defaultValue={project.name} />
              <button type="submit">Enregistrer</button>
            </div>
          </form>

          <section className="conversation-empty" aria-labelledby="conversation-heading">
            <h1 id="conversation-heading">{project.name}</h1>
            <p>Aucune conversation dans ce projet.</p>
          </section>
        </div>
      </section>
    </main>
  );
}
