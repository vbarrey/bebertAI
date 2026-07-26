# Archivist BebertAI

Assistant local de recherche documentaire pour une collection personnelle d'archives de la Seconde Guerre mondiale.

## Principes non négociables

- Toute réponse est fondée sur les documents retrouvés et cite ses sources.
- En l'absence de source pertinente, l'assistant le dit explicitement.
- La recherche documentaire prévaut sur la génération de texte.
- Les traitements lourds (OCR, embeddings, indexation) sont conçus comme des services séparés.

## Architecture cible

```text
src/
  app/             Routes et interface Next.js
  modules/         Cas d'usage métier par domaine
  services/        Adaptateurs OCR, embeddings, Qdrant, Ollama
  repositories/    Persistance Prisma/SQLite
  components/      Composants UI réutilisables
prisma/            Schéma et migrations SQLite
```

## Démarrage

1. Copier `.env.example` vers `.env`.
2. Installer les dépendances : `npm install`.
3. Lancer l'application : `npm run dev`.

Les intégrations Ollama, Qdrant, PaddleOCR et le schéma Prisma seront introduits par modules au fur et à mesure du MVP, afin que l'interface, l'indexation et l'IA évoluent indépendamment.
