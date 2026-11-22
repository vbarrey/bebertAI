# Import fichier par fichier — conception

## Pourquoi

Aujourd'hui l'import est un lot : tous les fichiers sont envoyés pour l'analyse (empreinte + recherche de doublons),
puis renvoyés en entier pour l'import. Pour Drive, l'analyse télécharge chaque fichier. L'utilisateur reste devant
« Analyse... » sans savoir où il en est. But : chaque fichier avance seul, l'indexation du premier commence pendant
que les autres sont encore vérifiés, et un panneau montre où en est chacun.

## Objectifs

- Local et Google Drive : chaque fichier passe par ses étapes indépendamment des autres.
- Un panneau de suivi, à droite de la fenêtre d'import, liste les fichiers et leur étape :
  en attente → empreinte → vérification → (conflit) → envoi (avec %) → indexation → terminé / erreur / ignoré.
- Conflits (un document avec la même empreinte existe déjà) : réglés ligne par ligne dans le panneau
  (Remplacer / Ignorer) sans bloquer les autres fichiers, ou d'avance par une règle (Demander / Ignorer / Remplacer).
- Chaque fichier n'est envoyé qu'une fois, après que son conflit éventuel est réglé.
- Drive : taille affichée pour la sélection (total) et pour les dossiers cochés (calculée en arrière-plan).

## Non-objectifs

- Import qui survit à un rechargement de page (approche B, écartée).
- Détection de doublons après coup par une tâche de fond (option 3, écartée : la base impose une empreinte unique par utilisateur).
- L'import `.bebert` ne change pas.

## Approches

- **A. File pilotée par le navigateur (choisie).** Le navigateur fait avancer chaque fichier par de petits appels ;
  2-3 fichiers à la fois ; la file vit sur la page, pas dans la fenêtre. Peu de neuf côté serveur.
- B. Tâche de fond côté serveur avec zone d'attente : survit au rechargement, mais nouvelle table, nettoyage disque,
  et les fichiers locaux partent du navigateur de toute façon. Trop lourd pour le gain.
- C. Mixte (local en A, Drive en B) : deux mécanismes pour un panneau ; l'empreinte fournie par Drive rend B inutile.

## Conception

### Serveur

- `POST /api/documents/import/check` — `{ checksums: string[] }` → `{ conflicts: Record<checksum, { documentId, displayName }> }`.
  Utilisé par le local et Drive.
- `POST /api/documents/import` (existant) — appelé avec **un** fichier et sa décision. Il recalcule l'empreinte et
  renvoie 409 si un conflit apparu entre-temps n'a pas de décision : la ligne repasse en conflit.
- `POST /api/google-drive/import` (existant) — appelé avec **un** fichier.
- Drive : `sha256Checksum` ajouté aux champs demandés ; `DriveItem.checksum: string | null`.
- `GET /api/google-drive/folder-files?id=` — fichiers d'un dossier, sous-dossiers compris (`listDriveFilesRecursive`),
  avec taille, format et empreinte. Sert à la taille affichée et à remplir la file.
- `POST /api/google-drive/import/checksum` — `{ fileId }` → `{ checksum }` : télécharge et calcule, pour un fichier
  dont Drive ne donne pas l'empreinte.
- Supprimés : `/api/documents/import/analyze`, `/api/google-drive/import/analyze`, `DocumentImportReview`,
  `DocumentImportConflictDialog`, les types d'analyse devenus inutiles.

### Navigateur

- `useImportQueue` (dans `DocumentImportPopover`, présent sur la page Documents et la page Projet) : la file, ses
  étapes, la règle de conflit, 3 fichiers traités à la fois (un fichier en conflit ne prend pas de place).
- Local : empreinte calculée avec `crypto.subtle.digest("SHA-256")`, envoi par `XMLHttpRequest` pour le pourcentage.
- Doublon dans la file même (même empreinte qu'un fichier déjà en file) : ignoré, « déjà dans cet import ».
- Format non pris en charge : ligne « ignoré » ; plus de 100 Mo : ligne en erreur.
- Indexation : la file ouvre sa propre connexion d'événements (`/api/indexing-jobs/events`) pour ses tâches et
  affiche En attente / En cours / Indexé / Échec. Sans « Indexer maintenant », la ligne finit à « Importé ».
- La page Documents est rafraîchie après chaque import (`addDocuments`) et reçoit les tâches (`onIndexingStarted`).
- Avertissement `beforeunload` tant que des fichiers ne sont pas envoyés.

### Écran

- Fenêtres d'import (local et Drive) : le bouton « Importer » met la sélection dans la file et vide la sélection ;
  la fenêtre reste ouverte pour en ajouter d'autres. La règle de conflit et « Indexer maintenant » sont dans la fenêtre.
- Tant que la file n'est pas vide, la fenêtre s'élargit et affiche le panneau dans une colonne de droite.
- Fenêtre fermée : le même panneau flotte en bas à droite de la page, repliable, avec « Effacer les terminés ».
- Plusieurs conflits en attente : « Tout remplacer » / « Tout ignorer » en tête du panneau.
- Drive : « 12 fichiers et 2 dossiers sélectionnés · 84,3 Mo » ; un dossier coché affiche « calcul… » puis
  « 37 fichiers · 52,1 Mo » ; tant qu'un calcul est en cours, le total dit « au moins … ».

## Laissé au développeur

- Libellés exacts, icônes, disposition fine du panneau.
- Projet : « Ignorer » ajoute le document existant à la sélection du projet (déjà fait par les routes d'import).
