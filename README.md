# Bebert AI

Bebert AI est une application desktop personnelle destinée à centraliser et exploiter une documentation technique à l’aide de l’IA.

L’objectif est de regrouper des documents (PDF, TXT, DOCX, etc.), de les indexer automatiquement et de dialoguer avec un modèle de langage local en s’appuyant sur un moteur RAG.

L’application est conçue pour fonctionner principalement en local, avec une interface simple destinée à un usage quotidien et une configuration avancée séparée.

## Fonctionnalités

- Import de documents locaux par fichiers, dossiers ou drag & drop
- Détection des formats et calcul de checksum SHA-256
- Détection et gestion des doublons
- Gestion des conflits avec remplacement ou ignore
- Stockage persistant des documents
- Extraction de contenu depuis PDF, TXT et DOCX
- Découpage des documents en chunks configurables
- Génération d’embeddings
- Stockage des vecteurs dans Qdrant
- Recherche sémantique
- Chat avec un modèle de langage local
- Réponses générées avec contexte documentaire (RAG)
- Streaming des réponses
- Indexation asynchrone avec BullMQ
- Suivi de la progression de l’indexation en temps réel via SSE
- Configuration du pipeline d’import, d’extraction, de chunking, d’embedding, de retrieval et de génération

## Architecture

Bebert AI repose sur une application Next.js qui orchestre l’interface, les API et la logique métier. Prisma et SQLite assurent la persistance des données, Qdrant stocke les vecteurs et Ollama fournit les modèles locaux.

L’indexation documentaire est exécutée en arrière-plan par un worker BullMQ connecté à Redis.

Le pipeline d’indexation suit les étapes : **Import → Extraction → Chunking → Persistance → Embeddings → Qdrant**.

Lors d’une conversation, les chunks pertinents sont récupérés depuis Qdrant puis transmis au modèle de génération avec la question de l’utilisateur.

## Stack

### Application
- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

### Données
- Prisma
- SQLite

### IA
- Ollama
- AIProviderRegistry
- Qdrant

### Jobs
- BullMQ
- Redis
- Server-Sent Events (SSE)

### Traitement documentaire
- `unpdf` pour les PDF
- `mammoth` pour les DOCX
- Tesseract (CLI) pour l’OCR, Poppler (`pdftoppm`) pour le rendu des pages PDF
- `RecursiveCharacterTextSplitter` pour le chunking

## Structure du projet

```text
src/
├── app/                 # Pages et routes Next.js
├── components/          # Composants React
├── hooks/               # Hooks React
├── lib/
│   ├── ai/              # Providers et moteur IA
│   ├── documents/       # Import et stockage documentaire
│   ├── mutations/       # Écritures DB
│   ├── queries/         # Lectures DB
│   ├── rag/             # Extraction, chunking, embeddings, retrieval
│   └── queue/           # Files BullMQ
├── types/               # Types partagés
└── workers/             # Workers BullMQ
```

## Prérequis

- Bun
- Node.js
- Redis
- Qdrant
- Ollama

Les services Redis, Qdrant et Ollama peuvent être exécutés localement ou via Docker.

### OCR (optionnel)

L’OCR (activable dans Paramètres > Pipeline > Extraction) appelle deux exécutables qui doivent être dans le `PATH` du worker :

- `tesseract` avec les données des langues utilisées (`fra`, `eng`, `deu`, `rus`)
- `pdftoppm` (Poppler)

```bash
# Debian / Ubuntu
sudo apt install tesseract-ocr tesseract-ocr-fra tesseract-ocr-eng tesseract-ocr-deu tesseract-ocr-rus poppler-utils
# macOS
brew install tesseract tesseract-lang poppler
# Alpine (image Docker, déjà inclus dans le Dockerfile)
apk add tesseract-ocr tesseract-ocr-data-fra tesseract-ocr-data-eng tesseract-ocr-data-deu tesseract-ocr-data-rus poppler-utils
```

Sous Windows : installer Tesseract (`winget install UB-Mannheim.TesseractOCR`) et Poppler (`winget install oschwartz10612.Poppler`), ajouter `C:\Program Files\Tesseract-OCR` au `PATH`, puis copier les fichiers `fra` / `deu` / `rus.traineddata` (dépôt [tesseract-ocr/tessdata](https://github.com/tesseract-ocr/tessdata)) dans son dossier `tessdata`. Redémarrer VS Code / le terminal ensuite : `tesseract --list-langs` doit lister les langues.

Le panneau propose les langues installées pour Tesseract (`tesseract --list-langs`) : pour en ajouter une, il suffit de déposer son fichier `.traineddata` dans le dossier `tessdata` puis de recharger la page.

Pour un PDF, chaque page est d’abord extraite nativement ; seules les pages contenant moins de lettres/chiffres que le seuil configuré (50 par défaut) sont rendues en image et passées à Tesseract. Les images PNG/JPEG ne passent jamais par l’OCR (voir « Indexation des images »).

## Installation

Cloner le projet :

```bash
git clone https://github.com/vbarrey/bebertAI.git
cd bebertAI
```

Installer les dépendances :

```bash
bun install
```

Configurer les variables d’environnement nécessaires.

Exemple :

```env
DATABASE_URL="file:./data/database/myDB.db"

DOCUMENTS_STORAGE_PATH="./data/documents"

REDIS_HOST="localhost"
REDIS_PORT="6379"

OLLAMA_BASE_URL="http://localhost:11434"
```

Initialiser Prisma :

```bash
bunx prisma generate
bunx prisma migrate dev
```

Lancer l’application et le worker :

```bash
bun dev
```

L’application est ensuite disponible sur `http://localhost:3000`.

Lancer les tests :

```bash
bun run test
```

Les tests utilisant le vrai moteur OCR sont ignorés si `tesseract` ou `pdftoppm` est absent.

## Stockage des documents

Les fichiers locaux sont stockés en dehors de la base SQLite.

La base contient uniquement un chemin relatif associé au document.

Chaque fichier est physiquement nommé avec l’UUID du document :

```text
data/documents/
└── <document-id>
```

Le nom original est conservé dans `Document.displayName`.

## Pipeline d’indexation

Lorsqu’un document est indexé, il suit le pipeline :

**Document → Extraction (native, puis OCR si nécessaire) → Chunking → Prisma → Embedding → Qdrant**

Les chunks sont conservés dans SQLite avec leur contenu et leurs métadonnées (page, bounding box, etc.).

Les embeddings sont stockés dans Qdrant avec les identifiants du document et du chunk.

### Indexation des images

Les images PNG et JPEG sont indexées par le même worker, sans OCR ni analyse visuelle : leur texte indexé est leur nom de fichier (nettoyé des `_`, `-` et de l’extension) et les métadonnées textuelles saisies par une personne, quand elles existent :

- PNG : blocs texte `Title`, `Description`, `Comment`, `Keywords` ;
- JPEG : commentaire (`COM`) et champs EXIF `ImageDescription`, `XPTitle`, `XPSubject`, `XPComment`, `XPKeywords` (Titre, Objet, Commentaires et Mots-clés des propriétés Windows).

Les métadonnées techniques (appareil, dates, GPS) sont ignorées. Un nom de fichier explicite (`char_renault_FT_1917.jpg`) suffit donc à retrouver une image par recherche sémantique.

## Pipeline configurable

Les paramètres du pipeline sont stockés dans `PipelineParameters` sous forme de JSON validé avec Zod.

Les étapes configurables sont :

- Import
- Extraction
- Chunking
- Embedding
- Retrieval
- Generation

Les capacités réellement disponibles sont décrites séparément dans `pipelineCapabilities`.

## Sources documentaires

Le modèle prévoit actuellement trois types de sources :

- `LOCAL`
- `GOOGLE_DRIVE`
- `DROPBOX`

L’import local est actuellement fonctionnel.

Google Drive et Dropbox sont prévus mais leur intégration réelle n’est pas encore implémentée.

## État du projet

### Fonctionnel

- Import local
- Stockage persistant
- Gestion des doublons et conflits
- Extraction PDF / TXT / DOCX
- OCR Tesseract (pages PDF sans texte exploitable)
- Indexation des images PNG/JPEG par leur nom et leurs métadonnées textuelles
- Chunking configurable
- Persistance des chunks
- Embeddings
- Qdrant
- Indexation BullMQ
- Progression SSE
- Retrieval documentaire
- Chat avec génération locale via Ollama
- Configuration du pipeline

### À venir

- Intégration Google Drive
- Intégration Dropbox
- Nettoyage des anciens vecteurs Qdrant lors des suppressions/réindexations
- Finalisation de certains paramètres de retrieval et génération
- Suppression des dernières configurations IA hard-codées
- Raffinement du suivi d’état des `IndexingJob`

## Philosophie du projet

Bebert AI privilégie une architecture simple et progressive.
Le projet évite volontairement les couches d’abstraction inutiles : pas de Repository ou Service générique lorsque Prisma et les fonctions métier existantes suffisent.
Les responsabilités sont séparées entre interface utilisateur, orchestration, logique métier, accès aux données, traitement documentaire et infrastructure IA.
L’objectif est de conserver une application locale fiable et facile à maintenir tout en permettant au moteur RAG d’évoluer progressivement.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE.txt) file for details.

## Contacts

- **Auteur :** Victor Barrey
- **GitHub :** [@vbarrey](https://github.com/vbarrey)
- **Projet :** [Bebert AI](https://github.com/vbarrey/bebertAI)