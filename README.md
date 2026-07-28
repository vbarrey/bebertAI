# Bebert AI

**Bebert AI** est un assistant documentaire local conçu pour mon père, maquettiste confirmé ayant accumulé au fils des années un nombre considérable de documentation en lien avec sa passion.

L’objectif est de lui permettre d'explorer facilement sa collection personnelle d'archives (livres, PDF, photographies, scans, cartes, etc.) grâce à l'intelligence artificielle, tout en garantissant que chaque réponse s'appuie exclusivement sur les documents de sa bibliothèque.

Le projet est entièrement pensé pour fonctionner en local, préserver la confidentialité des données et fournir des réponses transparentes accompagnées de leurs sources.

## Fonctionnalités

- 📚 Gestion de plusieurs bibliothèques documentaires

- 🔍 Recherche sémantique en langage naturel

- 🤖 Assistant IA basé sur un système RAG

- 📄 OCR des documents numérisés

- 📖 Citations automatiques des sources

- 💻 Fonctionnement 100 % local avec Ollama



## Stack technique

### Frontend

- Next.js 16

- React 19

- TypeScript

- Tailwind CSS v4

- shadcn/ui

- Radix UI

### Backend

- Next.js Server Actions

- Prisma

- SQLite

### IA

- Ollama

- bge-m3

- PaddleOCR

- Qdrant


## Installation

```bash

git clone <repository-url>

cd bebert-ai

npm install

npm run dev

```

L'application est ensuite accessible à l'adresse :

```

http://localhost:3000

```



## État du projet

🚧 Projet en cours de développement.

Les fonctionnalités seront intégrées progressivement, en commençant par la gestion des projets documentaires, l'indexation, puis la recherche assistée par IA.
