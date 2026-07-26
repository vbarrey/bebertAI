const principles = [
  ["Recherche ancrée", "Chaque réponse part des documents de la collection."],
  ["Sources visibles", "Les références, extraits et fichiers restent accessibles."],
  ["Local par nature", "Les archives et l'historique restent sous votre contrôle."],
];

export default function Home() {
  return (
    <main className="shell">
      <header>
        <p className="eyebrow">ARCHIVIST · BEBERTAI</p>
        <h1>Retrouvez l&apos;histoire<br />dans vos archives.</h1>
        <p className="lede">Un assistant documentaire conçu pour explorer, recouper et comprendre une collection personnelle sur la Seconde Guerre mondiale.</p>
      </header>

      <section className="search-card" aria-label="Recherche documentaire">
        <label htmlFor="question">Que cherchez-vous ?</label>
        <div className="search-row">
          <input id="question" placeholder="Ex. Les documents sur la bataille de Normandie…" disabled />
          <button disabled>Rechercher</button>
        </div>
        <p>Configurez d&apos;abord vos dossiers d&apos;archives pour démarrer l&apos;indexation.</p>
      </section>

      <section className="principles">
        {principles.map(([title, description], index) => (
          <article key={title}>
            <span>0{index + 1}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <footer>Version fondatrice · Le moteur de recherche documentaire avant tout.</footer>
    </main>
  );
}
