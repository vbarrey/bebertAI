import Link from "next/link";
import { createProjectAction } from "@/app/actions/projects";
import { AppSidebar, MobileHeader } from "@/components/app-sidebar";
import { projectService } from "@/modules/projects/project.service";

export default async function Home() {
  const projects = await projectService.listRecent();

  return (
    <main className="workspace">
      <AppSidebar projects={projects} />

      <section className="main-panel" id="accueil">
        <MobileHeader />

        <div className="starter">
          <h1>Commencer un projet</h1>
          <form className="composer" action={createProjectAction} aria-label="Créer un projet">
            <textarea id="project-name" name="name" placeholder="Nommer votre recherche…" rows={1} autoFocus />
            <div className="composer-actions">
              <span>Créez un espace pour organiser votre recherche</span>
              <button className="send-button" type="submit" aria-label="Créer le projet">↑</button>
            </div>
          </form>
        </div>

        <section className="recent-projects" aria-labelledby="recent-heading">
          <div className="section-heading">
            <h2 id="recent-heading">Projets récents</h2>
            <span>{projects.length}</span>
          </div>

          {projects.length === 0 ? (
            <div className="empty-projects">Aucun projet pour le moment.</div>
          ) : (
            <div className="project-grid">
              {projects.map((project) => (
                <Link className="project-card" href={`/projects/${project.id}`} key={project.id}>
                  <span className="project-icon" aria-hidden="true">⌕</span>
                  <span className="card-content">
                    <strong>{project.name}</strong>
                    <small>Modifié le {project.updatedAt.toLocaleDateString("fr-FR")}</small>
                  </span>
                  <span className="more" aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
