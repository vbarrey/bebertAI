const recentProjects = [
  { title: "Archives Normandie", meta: "Mis à jour aujourd’hui" },
  { title: "Correspondances 1944", meta: "Mis à jour hier" },
  { title: "Collection véhicules", meta: "Mis à jour le 18 juillet" },
  { title: "Documents à classer", meta: "Mis à jour le 12 juillet" },
];

function ArchiveMark() {
  return <span className="archive-mark" aria-hidden="true">A</span>;
}

export default function Home() {
  return (
    <main className="workspace">
      <aside className="sidebar">
        <a className="brand" href="#accueil" aria-label="Archivist BebertAI, accueil">
          <ArchiveMark />
          <span>Archivist</span>
        </a>

        <button className="new-project" type="button">
          <span aria-hidden="true">＋</span>
          Nouveau projet
        </button>

        <nav className="project-navigation" aria-label="Projets récents">
          <p>Récents</p>
          <ul>
            {recentProjects.map((project) => (
              <li key={project.title}>
                <button className="project-link" type="button">
                  <span>{project.title}</span>
                  <small>{project.meta}</small>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-bottom">
          <button type="button">Bibliothèque</button>
          <button type="button">Réglages</button>
        </div>
      </aside>

      <section className="main-panel" id="accueil">
        <header className="mobile-header">
          <a className="brand" href="#accueil"><ArchiveMark /><span>Archivist</span></a>
          <button type="button" aria-label="Créer un projet">＋</button>
        </header>

        <div className="starter">
          <h1>Bonjour, Victor</h1>
          <form className="composer" action="#" aria-label="Créer un projet">
            <textarea id="project-prompt" name="project-prompt" placeholder="Commencer une recherche…" rows={1} />
            <div className="composer-actions">
              <button className="attach-button" type="button" aria-label="Ajouter des documents">＋</button>
              <span>Décrivez votre recherche ou ajoutez des documents</span>
              <button className="send-button" type="submit" aria-label="Créer le projet">↑</button>
            </div>
          </form>
          <div className="quick-actions" aria-label="Démarrages rapides">
            <button type="button">Rechercher dans les archives</button>
            <button type="button">Indexer un dossier</button>
            <button type="button">Créer une collection</button>
          </div>
        </div>

        <section className="recent-projects" aria-labelledby="recent-heading">
          <div className="section-heading">
            <h2 id="recent-heading">Projets récents</h2>
            <button type="button">Tout afficher</button>
          </div>
          <div className="project-grid">
            {recentProjects.slice(0, 3).map((project) => (
              <button className="project-card" type="button" key={project.title}>
                <span className="project-icon" aria-hidden="true">⌕</span>
                <span className="card-content"><strong>{project.title}</strong><small>{project.meta}</small></span>
                <span className="more" aria-hidden="true">•••</span>
              </button>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
