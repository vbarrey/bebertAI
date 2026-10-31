# Déploiement de Bebert AI

Un serveur Linux, Docker et un nom de domaine. Tout tourne avec docker compose : l'app, le worker d'indexation,
Redis, Qdrant, Caddy (HTTPS) et les sauvegardes. Les modèles d'IA sont ceux des fournisseurs distants, ajoutés
par chaque utilisateur avec sa clé API : aucun GPU n'est nécessaire.

## 1. Prérequis

- Un serveur Linux (Ubuntu 24.04 par exemple) avec **Docker** et le plugin **docker compose**.
- Un **nom de domaine** dont l'enregistrement A (et AAAA en IPv6) pointe vers le serveur.
- Les ports **80 et 443 ouverts** : Caddy y obtient et renouvelle seul le certificat Let's Encrypt.

## 2. Installation

```sh
git clone <dépôt> bebert-ai && cd bebert-ai
cp .env.example .env
chmod 600 .env    # il contient les secrets : lisible par son propriétaire seulement
```

Dans `.env`, renseigner :

| Variable | Valeur |
|---|---|
| `DOMAIN` | le domaine, par exemple `bebert.exemple.fr` |
| `APP_URL` | `https://<DOMAIN>` (liens des emails, cookies sécurisés) |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` : **à ne jamais changer ni perdre**, les clés API et les connexions Google Drive enregistrées en dépendent |
| `ADMIN_EMAIL` | l'adresse du premier administrateur |

L'app refuse de démarrer sans `BETTER_AUTH_SECRET` ni `ENCRYPTION_KEY`.

```sh
docker compose up -d --build
docker compose ps    # tous les services « running », l'app « healthy »
```

### Premier administrateur

Tant qu'aucun compte n'existe, chaque démarrage crée une invitation pour `ADMIN_EMAIL`. En attendant l'envoi des
emails (voir 8), le lien est dans les logs :

```sh
docker compose logs app | grep invitation
```

Ouvrir le lien, choisir un mot de passe. Les autres comptes s'invitent ensuite depuis Réglages > Utilisateurs.

### Fournisseurs d'IA

À sa première connexion, chaque utilisateur arrive sur la page de bienvenue (`/bienvenue`) : il y ajoute ses
fournisseurs avec leur clé API (Anthropic ou Ollama Cloud pour la génération, Voyage AI ou Google Gemini pour
l'embedding) et choisit ses modèles. Il peut remettre cette étape à plus tard et la faire ensuite dans Réglages >
Fournisseurs et Réglages > Pipeline.

### Google Drive (facultatif)

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` et `GOOGLE_REDIRECT_URI=https://<DOMAIN>/api/google-drive/callback`, la même
adresse étant déclarée dans la console Google. Tant que l'app OAuth est en mode « test », chaque utilisateur doit y être
ajouté comme utilisateur de test (100 au plus) et sa connexion expire au bout de 7 jours.

## 3. Mise à jour

```sh
docker compose exec backup npm run backup    # une sauvegarde avant
git pull
docker compose up -d --build
```

Les migrations de la base s'appliquent seules au démarrage de l'app.

## 4. Sauvegardes

Le service `backup` sauvegarde chaque nuit à 3 h (UTC), dans `./backups/<date>` sur le serveur :

- `bebertai.db` : la base, copiée à chaud ;
- `documents.tar.gz` : les fichiers importés ;
- `qdrant/` : un snapshot de chaque collection et la liste des alias.

Sont gardées les **4 dernières sauvegardes et les 2 derniers dimanches**. Une sauvegarde à la main :

```sh
docker compose exec backup npm run backup
```

Les sauvegardes restent sur le serveur : elles ne protègent pas d'une panne de son disque. Les copier ailleurs
(un autre serveur, un stockage S3) dès que possible.

**Ne pas copier `bebertai.db` à la main pendant que l'app tourne** : une copie prise au milieu d'une écriture est
incohérente. Utiliser le script de sauvegarde, qui copie la base de façon sûre.

## 5. Restauration

```sh
docker compose stop caddy app worker backup    # plus d'écriture pendant la restauration
docker compose up -d qdrant
docker compose run --rm --no-deps backup npx tsx scripts/restore.ts /app/backups/<date>
docker compose up -d
```

La base, les documents et les collections Qdrant sont remplacés par ceux de la sauvegarde.

## 6. Charge

Dans `.env` :

- `INDEXING_CONCURRENCY` (2) : documents indexés en même temps par le worker.

Mesurer avec le test de charge (`npm run bench:load`, voir `scripts/load-test.ts`).

Limites d'import : 100 Mo par fichier, 300 Mo par import.

## 7. Surveillance

- `https://<DOMAIN>/api/health` répond `{"ok":true}` quand l'app est prête : à brancher sur un service de
  surveillance (UptimeRobot, Uptime Kuma…).
- `docker compose ps` et `docker compose logs -f <service>` ; les logs sont limités à 30 Mo par service.
- Tous les services redémarrent seuls après un plantage ou un redémarrage du serveur.

## 8. Pas encore en place

- **L'envoi des emails** (invitations, mot de passe oublié) : ils sont écrits dans les logs de l'app
  (`docker compose logs app | grep -A3 "\[email\]"`). À brancher sur un serveur SMTP dans `src/lib/email.ts`.
- La copie des sauvegardes hors du serveur.
