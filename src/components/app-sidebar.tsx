import Link from "next/link";
import type { Project } from "@prisma/client";
import { createProjectAction } from "@/app/actions/projects";

type AppSidebarProps = {
  projects: Project[];
  activeProjectId?: string;
};

function ArchiveMark() {
  return <span className="archive-mark" aria-hidden="true">A</span>;
}

export function AppSidebar({ projects, activeProjectId }: AppSidebarProps) {
  return (
    <aside className="sidebar">
      <Link className="brand" href="/" aria-label="Archivist BebertAI, accueil">
        <ArchiveMark />
        <span>Archivist</span>
      </Link>

      <form action={createProjectAction}>
        <input type="hidden" name="name" value="Nouveau projet" />
        <button className="new-project" type="submit">
          <span aria-hidden="true">+</span>
          Nouveau projet
        </button>
      </form>

      <nav className="project-navigation" aria-label="Projets récents">
        <p>Récents</p>
        {projects.length === 0 ? (
          <span className="empty-sidebar">Aucun projet</span>
        ) : (
          <ul>
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  className={`project-link${project.id === activeProjectId ? " is-active" : ""}`}
                  href={`/projects/${project.id}`}
                >
                  <span>{project.name}</span>
                  <small>Modifié le {project.updatedAt.toLocaleDateString("fr-FR")}</small>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <div className="sidebar-bottom">
        <button type="button">Bibliothèque</button>
        <button type="button">Réglages</button>
      </div>
    </aside>
  );
}

export function MobileHeader() {
  return (
    <header className="mobile-header">
      <Link className="brand" href="/"><ArchiveMark /><span>Archivist</span></Link>
      <form action={createProjectAction}>
        <input type="hidden" name="name" value="Nouveau projet" />
        <button type="submit" aria-label="Créer un projet">+</button>
      </form>
    </header>
  );
}
