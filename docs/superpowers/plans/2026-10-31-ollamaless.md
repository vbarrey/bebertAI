# Ollamaless Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BebertAI tourne sans Ollama local : il disparaît du docker compose, du code et de la liste des fournisseurs ; chaque utilisateur configure ses propres fournisseurs (clé API) dès sa première connexion, et l'app l'avertit tant que la génération ou l'embedding ne sont pas utilisables.

**Architecture:** Ollama local était le seul fournisseur partagé (`userId` null) et la source des modèles par défaut du pipeline. On le supprime entièrement (données comprises, par migration) : un fournisseur appartient toujours à un utilisateur. Un état de configuration par utilisateur (`getSetupStatus`) réutilise les vérifications de `getPipelineProvider` ; il alimente un bandeau d'avertissement dans le layout de l'app et une redirection vers une page d'accueil `/bienvenue` tant que l'utilisateur n'a ni terminé ni reporté sa configuration (`User.onboardedAt`).

**Tech Stack:** Next.js (App Router, server actions), Prisma 7 + SQLite, Better Auth, zod, node:test via tsx, Tailwind + composants `src/components/ui`.

**Spec:** la demande de l'utilisateur du 2026-10-31 (pas de document séparé) : « Ollama local ne doit plus être un prérequis ; une branche `ollamaless`, Ollama hors du docker compose, Ollama local qu'on ne peut même plus ajouter comme fournisseur ; des avertissements si aucun fournisseur n'est configuré ; à la première connexion, une page pour saisir son premier fournisseur et ses modèles de génération et d'embedding. »

## Global Constraints

- Branche `ollamaless` créée depuis `feat/multi-user` (la branche courante, pas encore fusionnée dans `main`).
- Ollama local est supprimé, pas masqué : plus de type `OLLAMA_LOCAL`, plus de service `ollama`/`ollama-pull`, plus de variables `OLLAMA_HOST`, `OLLAMA_DEFAULT_MODEL`, `OLLAMA_EMBEDDING_MODEL`, `OLLAMA_NUM_PARALLEL`, `OLLAMA_MAX_LOADED_MODELS`, `OLLAMA_KEEP_ALIVE`. Ollama Cloud reste.
- Textes de l'interface en français ; commentaires du code en anglais, dans le style et la densité du code voisin.
- Jamais de commentaire préfixé `ponytail:`.
- Un texte coupé par « … » affiche sa valeur entière en infobulle : utiliser `TruncatedText`.
- Tests : `node:test` + `assert/strict`, lancés par `npm test` ; un test qui touche la base crée la sienne avec `npx prisma migrate deploy` dans un dossier temporaire (modèle : `src/lib/ownership.test.ts:8-12`).
- Commits en anglais au style du dépôt (`feat(scope): phrase descriptive`), terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Après les modifications de code : `graphify update .`.

## Review Focus

1. **Base existante avec Ollama local** (fournisseur, modèles, conversations dont `modelId` pointe sur un modèle Ollama, pipelines réglés dessus) : la migration passe, les conversations perdent leur modèle (`modelId` NULL, elles repartent sur le modèle du pipeline), les pipelines orphelins apparaissent « non configurés ». Vérifié par la Task 1, étape 4, sur une copie de la base de dev.
2. **Utilisateur déjà configuré sur ses propres fournisseurs au moment de la mise à jour** : il n'est pas envoyé sur `/bienvenue`, son `onboardedAt` est rempli à la première page. Test `needsOnboarding marks a configured user as onboarded` (Task 4).
3. **Un seul fournisseur sans embedding** (Anthropic seul) : la page d'accueil ne propose aucun modèle d'embedding, dit quels fournisseurs ajouter, et « Commencer » reste désactivé. Test `modelChoices keeps the models with the capability` (Task 5).
4. **Pipeline cassé après coup** (fournisseur ou modèle désactivé, supprimé) : pas de redirection, le bandeau donne la raison. Test `setup status gives the reason of each broken step` (Task 3).
5. **Boucle de redirection** : `/bienvenue` est hors du layout `(app)`, une page déjà configurée ou reportée y renvoie vers `/`. Vérifié à la main (Task 6, étape 3).

---

### Task 1: Branche et migration des données

**Files:**
- Modify: `prisma/schema.prisma` (enum `AIProviderType`, `AIProvider.userId`, `User`)
- Create: `prisma/migrations/<timestamp>_ollamaless/migration.sql`

**Interfaces:**
- Produces: `User.onboardedAt DateTime?` ; `AIProvider.userId String` (obligatoire) ; `AIProviderType` sans `OLLAMA_LOCAL`.

- [ ] **Step 1: Créer la branche**

Run: `git switch -c ollamaless`
Expected: `Switched to a new branch 'ollamaless'`

- [ ] **Step 2: Modifier le schéma**

Dans `prisma/schema.prisma` : retirer `OLLAMA_LOCAL` de `AIProviderType` ; `AIProvider.userId` devient `String` et `user` devient `User` (non optionnel), commentaire « The user who added it, with their API key. » ; ajouter à `User`, après le bloc admin : `// Set once the user finished or postponed the welcome page (src/lib/onboarding.ts). onboardedAt DateTime?`. Garder `AIProviderSource` (LOCAL inutilisé mais futur fournisseur local) et `AIProvider.isDefault`.

- [ ] **Step 3: Générer la migration puis y ajouter le nettoyage des données**

Run: `npx prisma migrate dev --create-only --name ollamaless`
Puis, en tête du `migration.sql` généré (avant la redéfinition de `AIProvider`), ajouter, avec un commentaire anglais d'une ligne :

```sql
-- Ollama local is gone: its models, and the providers without owner nobody could see.
UPDATE "Conversation" SET "modelId" = NULL WHERE "modelId" IN (SELECT "m"."id" FROM "AIModel" "m" JOIN "AIProvider" "p" ON "m"."providerId" = "p"."id" WHERE "p"."type" = 'OLLAMA_LOCAL' OR "p"."userId" IS NULL);
UPDATE "AIProvider" SET "defaultModelId" = NULL WHERE "type" = 'OLLAMA_LOCAL' OR "userId" IS NULL;
DELETE FROM "_AIModelToAIModelCapability" WHERE "A" IN (SELECT "m"."id" FROM "AIModel" "m" JOIN "AIProvider" "p" ON "m"."providerId" = "p"."id" WHERE "p"."type" = 'OLLAMA_LOCAL' OR "p"."userId" IS NULL);
DELETE FROM "AIModel" WHERE "providerId" IN (SELECT "id" FROM "AIProvider" WHERE "type" = 'OLLAMA_LOCAL' OR "userId" IS NULL);
DELETE FROM "AIProvider" WHERE "type" = 'OLLAMA_LOCAL' OR "userId" IS NULL;
```

- [ ] **Step 4: Vérifier la migration sur une copie de la base de dev**

Copier `data/database/bebertai.db` dans le scratchpad, puis `DATABASE_URL=file:<copie> npx prisma migrate deploy`, puis compter avec `better-sqlite3` (`node -e`) : `SELECT COUNT(*) FROM AIProvider WHERE type='OLLAMA_LOCAL' OR userId IS NULL` → 0 ; `SELECT COUNT(*) FROM Conversation WHERE modelId IS NOT NULL AND modelId NOT IN (SELECT id FROM AIModel)` → 0 ; `PRAGMA foreign_key_check` → aucune ligne.
Expected: migration appliquée, les trois contrôles à 0 / vide.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(providers): Ollama local removed from the data: its provider, models and conversation links deleted by migration, every provider owned by a user, User.onboardedAt for the welcome page"
```

---

### Task 2: Ollama local retiré du code, du compose et de la documentation

**Files:**
- Delete: `src/lib/ai/ollama-local/client.ts`, `config.ts`, `provider.ts` ; `src/lib/startup/initializer/ollama-local/` ; `src/lib/pipeline/default.test.ts`
- Move (git mv): `src/lib/ai/ollama-local/{types,errors,transform}.ts` → `src/lib/ai/ollama-cloud/` (seul consommateur) ; retirer les types qui n'y servent plus (`OllamaEmbedRequest`, `OllamaEmbedResponse`…)
- Modify: `src/lib/ai/provider-factory.ts:4-5,21-22`, `src/lib/ai/provider.ts:13` (retirer `remove?`), `src/lib/ai/provider-access.ts`, `src/lib/queries/aiProvider.ts`, `src/lib/mutations/aiModel.ts` (retirer `deleteModel` et ses imports), `src/lib/mutations/aiProvider.ts:38`, `src/types/augmented-prisma.ts`, `src/lib/startup/initialize-ai.ts`, `src/lib/startup/initializer/remote-providers-initializer.ts:7`, `src/lib/pipeline/runtime.ts:2,23-32,51,98-120`, `src/lib/pipeline/default.ts:61-81`, `src/lib/env.ts:32-34`, `src/lib/ai/anthropic/provider.ts:82`, `src/lib/ai/ollama-cloud/provider.ts:50`, `src/components/settings/providers/model-list.tsx`, `model-list-item.tsx`, `provider-details.tsx:134`, `provider-type-selector.tsx:13`, `scripts/bench-indexing.ts`, `scripts/eval-retrieval/{common,evaluate,generate-questions}.ts`
- Modify (config/docs): `docker-compose.yml`, `.env.example`, `.exemple.env`, `DEPLOY.md`, `README.md`, `scripts/eval-retrieval/README.md:41`
- Test: `src/lib/ai/provider-access.test.ts`, `src/lib/ownership.test.ts:118-162`

**Interfaces:**
- Consumes: le schéma de la Task 1.
- Produces:
  - `usableProviders(userId: string): Prisma.AIProviderWhereInput` → `{ userId }`
  - `manageableProviders(user: User): Prisma.AIProviderWhereInput` → `{ userId: user.id }`
  - `isManageable(provider: { userId: string }, user: User): boolean` → `provider.userId === user.id`
  - `getPipelineConfig(userId)` inchangé en signature, sans repli sur des modèles par défaut : un pipeline neuf a ses étapes génération et embedding à `UNSET`.
  - `Model` (augmented-prisma) sans `isDefault` ; `ModelList`/`ModelListItem` sans prop `removable` ni bouton Supprimer.

- [ ] **Step 1: Réécrire les tests d'accès pour le modèle « chacun ses fournisseurs »**

Dans `src/lib/ai/provider-access.test.ts`, remplacer le bloc `isManageable` :

```ts
describe("isManageable", () => {
  it("a user manages their own providers only, the admin included", () => {
    const alices = { userId: "alice" };
    assert.equal(isManageable(alices, { id: "alice" }), true);
    assert.equal(isManageable(alices, { id: "bob" }), false);
    assert.equal(isManageable(alices, { id: "bob", role: "admin" }), false);
  });
});
```

Dans `src/lib/ownership.test.ts`, remplacer les trois tests qui créent ou lisent le fournisseur `OLLAMA_LOCAL` :
- `"providers: each user sees and manages their own only"` : Alice et Bob créent chacun un fournisseur `ANTHROPIC` avec un modèle `m` ; `getEnableProvidersWithModels(b)` → `[bobs.id]` ; `getProvidersWithModels({ id: b, role: "admin" })` → `[{ id: bobs.id, manageable: true }]` (jamais celui d'Alice).
- `"pipeline: each user's own, on their own providers only"` : même déroulé qu'aujourd'hui avec le fournisseur de Bob à la place du partagé ; en plus `assert.equal(bobs.generation.providerId, "...")` et `assert.equal(bobs.embedding.providerId, "...")` sur un pipeline neuf.
- `"pipeline provider: …"` : même trois rejets sur le fournisseur de Bob.

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npx tsx --conditions=react-server --test src/lib/ai/provider-access.test.ts src/lib/ownership.test.ts`
Expected: FAIL (le partagé est encore visible, `isManageable` accepte l'admin sur `userId: null`, le schéma refuse `OLLAMA_LOCAL`).

- [ ] **Step 3: Retirer Ollama local du code serveur**

- `provider-access.ts` : supprimer `SHARED` et les trois fonctions selon les signatures ci-dessus ; commentaires mis à jour.
- `provider-factory.ts` : supprimer le cas `OLLAMA_LOCAL` et ses imports.
- `initialize-ai.ts` : ne garder que `RemoteProvidersInitializer` ; supprimer le dossier `initializer/ollama-local`.
- `runtime.ts` : supprimer `withLocalDefaultModels` et son appel ; `getPipelineConfig` n'enregistre que si `!stored` ; message ligne 51 : `"Fournisseur inconnu : choisissez l'un de vos fournisseurs."`.
- `default.ts` : supprimer `withDefaultModels` ; supprimer `default.test.ts` (il ne teste que cette fonction).
- `aiModel.ts` : supprimer `deleteModel` (seuls les modèles d'un fournisseur local se supprimaient) et les imports Ollama ; `provider.ts` : retirer `remove?`.
- `queries/aiProvider.ts` : supprimer le calcul `isDefault` des modèles ; `augmented-prisma.ts` : retirer `isDefault` de `Model` et la mention d'Ollama dans `manageable`.
- `env.ts` : retirer les trois variables `OLLAMA_*`.
- Messages d'embedding (`anthropic/provider.ts:82`, `ollama-cloud/provider.ts:50`) : `"… Choisissez Voyage AI ou Google Gemini pour l'embedding dans Réglages > Pipeline."`.
- Commentaires restants qui parlent d'Ollama local : `aiProvider.ts:38`, `remote-providers-initializer.ts:7`, `provider-type-selector.tsx:13`, schéma.
- Scripts : `ollama()` de `scripts/eval-retrieval/common.ts` est remplacé par les clients du pipeline de l'utilisateur évalué, via `getPipelineProvider(parameters.embedding, "embedding")` et `getPipelineProvider(parameters.generation, "génération")` (`src/lib/pipeline/config.ts`) ; même chose pour `scripts/bench-indexing.ts:60` avec l'embedding.

- [ ] **Step 4: Retirer la suppression de modèle de l'interface**

`model-list.tsx`, `model-list-item.tsx`, `provider-details.tsx:134` : supprimer la prop `removable`, le bouton « Supprimer », l'`AlertDialog` de suppression et l'import de `deleteModel`.

- [ ] **Step 5: Lancer les tests, le typage et le lint**

Run: `npm test && npx tsc --noEmit && npx eslint .`
Expected: tout passe, aucune référence restante : `grep -rn "OLLAMA_LOCAL\|ollama-local\|OllamaLocal\|OLLAMA_HOST\|OLLAMA_DEFAULT_MODEL\|OLLAMA_EMBEDDING_MODEL" src scripts` ne renvoie rien.

- [ ] **Step 6: Compose et documentation**

- `docker-compose.yml` : supprimer les services `ollama` et `ollama-pull`, la dépendance `ollama-pull` de `app` (lignes 58-59), `OLLAMA_HOST`, `OLLAMA_DEFAULT_MODEL`, `OLLAMA_EMBEDDING_MODEL` de `services-env`, le volume `ollama`.
- `.env.example`, `.exemple.env` : retirer les lignes et commentaires Ollama (section « Load » réduite à `INDEXING_CONCURRENCY`).
- `DEPLOY.md` : plus de GPU dans les prérequis, plus de téléchargement de modèles au premier démarrage, section 6 réduite à `INDEXING_CONCURRENCY` ; ajouter après « Premier administrateur » : à la première connexion, chaque utilisateur ajoute ses fournisseurs (une clé API Anthropic ou Ollama Cloud pour la génération, Voyage AI ou Google Gemini pour l'embedding).
- `README.md` (lignes 31, 53, 95-97, 176-184, 291) et `scripts/eval-retrieval/README.md:41` : même mise à jour.

Run: `docker compose config --quiet`
Expected: aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(providers): Ollama local removed from the app: no shared provider any more, each user works on their own providers; no default models from the .env, a new pipeline starts unset; the model deletion of local providers removed; ollama and ollama-pull out of docker compose, with their variables and the GPU prerequisites of the docs; the evaluation and benchmark scripts use the evaluated user's pipeline providers"
```

---

### Task 3: État de configuration et bandeau d'avertissement

**Files:**
- Create: `src/lib/pipeline/setup.ts`, `src/components/layout/SetupWarning.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Test: `src/lib/onboarding.test.ts` (créé ici, base temporaire comme `ownership.test.ts:8-12`)

**Interfaces:**
- Consumes: `getPipelineConfig(userId)` (runtime.ts), `getPipelineProvider(step, name)` (config.ts).
- Produces:
  - `type SetupStatus = { providerCount: number; generation: string | null; embedding: string | null }` (null : étape utilisable ; sinon le message de `getPipelineProvider`)
  - `getSetupStatus(userId: string): Promise<SetupStatus>`, enveloppé dans `cache` de React (une fois par requête)
  - `isSetupComplete(status: SetupStatus): boolean`
  - `SetupWarning({ status }: { status: SetupStatus })` : rien quand la configuration est complète.

- [ ] **Step 1: Écrire les tests**

```ts
it("setup status: a new user has no provider and both steps unset", async () => {
  const status = await setup.getSetupStatus(bob.id);
  assert.equal(status.providerCount, 0);
  assert.match(status.generation!, /Pipeline non configuré/);
  assert.match(status.embedding!, /Pipeline non configuré/);
  assert.equal(setup.isSetupComplete(status), false);
});

it("setup status: complete once both steps are on usable models", async () => {
  // Bob's provider with a generation model "g" and an embedding model "e", set in his pipeline.
  const status = await setup.getSetupStatus(bob.id);
  assert.deepEqual(status, { providerCount: 1, generation: null, embedding: null });
});

it("setup status gives the reason of each broken step", async () => {
  await prisma.aIModel.updateMany({ where: { name: "e" }, data: { enabled: false } });
  const status = await setup.getSetupStatus(bob.id);
  assert.equal(status.generation, null);
  assert.match(status.embedding!, /est désactivé/);
});
```

`getSetupStatus` étant mis en cache par requête avec `cache` de React, vérifier que les appels successifs d'un test lisent bien l'état à jour (hors rendu React, `cache` ne mémorise pas) ; sinon exposer la fonction non mise en cache pour le test.

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npx tsx --conditions=react-server --test src/lib/onboarding.test.ts`
Expected: FAIL, module `@/lib/pipeline/setup` introuvable.

- [ ] **Step 3: Implémenter `src/lib/pipeline/setup.ts`**

`import "server-only"`. Compter `prisma.aIProvider.count({ where: usableProviders(userId) })`, lire `getPipelineConfig(userId)`, puis pour chaque étape appeler `getPipelineProvider` dans un try/catch qui garde `error.message`. Aucune vérification dupliquée : les règles restent dans `getPipelineProvider`.

- [ ] **Step 4: Lancer les tests pour les voir passer**

Run: `npx tsx --conditions=react-server --test src/lib/onboarding.test.ts`
Expected: PASS

- [ ] **Step 5: Bandeau et layout**

`SetupWarning` (composant serveur, sans `"use client"`) : un bloc `role="alert"` en haut de la zone de contenu, icône `TriangleAlert` de lucide-react, couleurs du thème (bordure et fond `destructive/…` ou ambre, lisibles en clair et en sombre). Textes :
- `providerCount === 0` : « Aucun fournisseur d'IA n'est configuré : la discussion et l'indexation des documents ne fonctionneront pas. » + lien « Ajouter un fournisseur » vers `/settings/provider`.
- sinon une ligne par étape en échec : « Discussion indisponible : {message} » (génération), « Indexation et recherche indisponibles : {message} » (embedding), + lien « Configurer le pipeline » vers `/settings/pipeline`.

Dans `src/app/(app)/layout.tsx`, lire `getSetupStatus(user.id)` et rendre `<SetupWarning status={status} />` au-dessus de `{children}`.

- [ ] **Step 6: Vérifier à la main**

Run: `npm run dev`, se connecter avec un compte sans fournisseur sur une base migrée.
Expected: le bandeau « Aucun fournisseur… » apparaît sur toutes les pages de l'app, y compris sur téléphone (largeur 375 px), et disparaît une fois la génération et l'embedding configurés dans les réglages.

- [ ] **Step 7: Commit**

```bash
git add src/lib/pipeline/setup.ts src/components/layout/SetupWarning.tsx "src/app/(app)/layout.tsx" src/lib/onboarding.test.ts
git commit -m "feat(setup): a warning at the top of every page while the user has no provider, or while the generation or the embedding step of their pipeline cannot run, with the reason getPipelineProvider gives and a link to the settings"
```

---

### Task 4: Suivi de la première configuration

**Files:**
- Create: `src/lib/onboarding.ts`, `src/lib/mutations/onboarding.ts`
- Modify: `src/app/(app)/layout.tsx`
- Test: `src/lib/onboarding.test.ts`

**Interfaces:**
- Consumes: `getSetupStatus`, `isSetupComplete` (Task 3) ; `getPipelineConfig`, `updatePipelineParameters` (runtime.ts) ; `getPipelineProvider` (config.ts).
- Produces:
  - `type StepChoice = { providerId: string; modelName: string }`
  - `needsOnboarding(userId: string): Promise<boolean>` : `false` si `onboardedAt` est rempli ; sinon, si la configuration est déjà complète, remplit `onboardedAt` et renvoie `false` ; sinon `true`.
  - `completeOnboarding(userId: string, choice: { generation: StepChoice; embedding: StepChoice }): Promise<void>` : vérifie chaque choix avec `getPipelineProvider` (erreur explicite sinon), enregistre les deux étapes par `updatePipelineParameters` (qui refuse le fournisseur d'un autre), puis remplit `onboardedAt`.
  - `skipOnboarding(userId: string): Promise<void>` : remplit `onboardedAt`.
  - Server actions (`"use server"`, `requireUser`) : `finishOnboarding(choice): Promise<{ error: string } | undefined>` (puis `redirect("/")` hors du try) et `postponeOnboarding(): Promise<void>` (puis `redirect("/")`).

- [ ] **Step 1: Écrire les tests**

```ts
it("needsOnboarding: a new user without setup goes to the welcome page until they postpone it", async () => {
  assert.equal(await onboarding.needsOnboarding(carol.id), true);
  await onboarding.skipOnboarding(carol.id);
  assert.equal(await onboarding.needsOnboarding(carol.id), false);
});

it("needsOnboarding marks a configured user as onboarded", async () => {
  // Bob is configured (Task 3 tests) with onboardedAt still null.
  assert.equal(await onboarding.needsOnboarding(bob.id), false);
  assert.ok((await prisma.user.findUniqueOrThrow({ where: { id: bob.id } })).onboardedAt);
});

it("completeOnboarding sets both steps on the user's own models only", async () => {
  await assert.rejects(onboarding.completeOnboarding(dave.id, { generation: bobsG, embedding: bobsE }), /Fournisseur inconnu/);
  await onboarding.completeOnboarding(dave.id, { generation: davesG, embedding: davesE });
  const { parameters } = await runtime.getPipelineConfig(dave.id);
  assert.deepEqual([parameters.generation.modelName, parameters.embedding.modelName], ["g", "e"]);
  assert.equal(await onboarding.needsOnboarding(dave.id), false);
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npx tsx --conditions=react-server --test src/lib/onboarding.test.ts`
Expected: FAIL, module `@/lib/onboarding` introuvable.

- [ ] **Step 3: Implémenter `src/lib/onboarding.ts` et `src/lib/mutations/onboarding.ts`**

`onboarding.ts` : `import "server-only"`, signatures ci-dessus. Dans les actions, le message d'une erreur levée (`error.message`) est renvoyé en `{ error }`, comme dans `createApiKeyProvider`.

- [ ] **Step 4: Lancer les tests pour les voir passer**

Run: `npx tsx --conditions=react-server --test src/lib/onboarding.test.ts`
Expected: PASS

- [ ] **Step 5: Redirection dans le layout de l'app**

Dans `src/app/(app)/layout.tsx`, après `requireUser()` : `if (await needsOnboarding(user.id)) redirect("/bienvenue");`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/onboarding.ts src/lib/mutations/onboarding.ts "src/app/(app)/layout.tsx" src/lib/onboarding.test.ts
git commit -m "feat(onboarding): a user who neither set up their pipeline nor postponed it is sent to the welcome page; finishing it saves the generation and embedding models chosen, checked like any pipeline step; a user already set up is never sent there"
```

---

### Task 5: Page d'accueil `/bienvenue`

**Files:**
- Create: `src/app/(auth)/bienvenue/page.tsx`, `src/components/onboarding/OnboardingWizard.tsx`, `src/components/onboarding/model-choices.ts`
- Modify: `src/app/(auth)/layout.tsx:3` (commentaire : aussi la page d'accueil après la connexion)
- Test: `src/components/onboarding/model-choices.test.ts`

**Interfaces:**
- Consumes: `getProvidersWithModels(user)` (queries/aiProvider.ts), `ProviderTypeSelector`, `ApiKeyProviderForm`, `synchronizeProviderModels`, `finishOnboarding`, `postponeOnboarding` (Task 4), `needsOnboarding` (Task 4), type `Provider` (augmented-prisma).
- Produces:
  - `type ModelChoice = { providerId: string; providerName: string; modelName: string; label: string }` (`label` : nom affiché du modèle, sinon son nom)
  - `modelChoices(providers: Provider[], capability: Capability): ModelChoice[]` : modèles activés, avec la capacité, de fournisseurs activés.

- [ ] **Step 1: Écrire le test**

```ts
it("modelChoices keeps the models with the capability", () => {
  const anthropic = provider("a", [model("claude", ["GENERATION"]), model("off", ["GENERATION"], false)]);
  const voyage = provider("v", [model("voyage-4", ["EMBEDDING"])]);
  assert.deepEqual(modelChoices([anthropic, voyage], "GENERATION").map((choice) => choice.modelName), ["claude"]);
  assert.deepEqual(modelChoices([anthropic], "EMBEDDING"), []);
  assert.deepEqual(modelChoices([{ ...voyage, enabled: false }], "EMBEDDING"), []);
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx tsx --conditions=react-server --test src/components/onboarding/model-choices.test.ts`
Expected: FAIL, module introuvable.

- [ ] **Step 3: Implémenter `modelChoices`**

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `npx tsx --conditions=react-server --test src/components/onboarding/model-choices.test.ts`
Expected: PASS

- [ ] **Step 5: Page et assistant**

`page.tsx` : `metadata = { title: "Bienvenue" }` ; `requireUser()` ; `if (!(await needsOnboarding(user.id))) redirect("/")` ; rend `<OnboardingWizard providers={await getProvidersWithModels(user)} />`.

`OnboardingWizard` (`"use client"`), une seule carte en deux parties :
1. **Vos fournisseurs** : la liste de ceux déjà ajoutés (nom en `TruncatedText`, badges des capacités disponibles ; un fournisseur sans modèle affiche « Aucun modèle » et un bouton « Synchroniser » qui appelle `synchronizeProviderModels` puis `router.refresh()`) ; un bouton « Ajouter un fournisseur » qui affiche `ProviderTypeSelector` puis `ApiKeyProviderForm` (`onBack` : retour au choix du type ; `onSuccess` : fermeture et `router.refresh()`).
2. **Vos modèles** : deux `Select` « Génération » et « Embedding » remplis par `modelChoices` ; quand une liste est vide, le `Select` est désactivé avec « Ajoutez Anthropic ou Ollama Cloud pour la génération. » / « Ajoutez Voyage AI ou Google Gemini pour l'embedding. ». Le premier modèle de chaque liste est présélectionné.

Pied : « Configurer plus tard » (`postponeOnboarding`) et « Commencer » (`finishOnboarding`, désactivé tant qu'un des deux choix manque, erreur affichée sous le formulaire). Phrase d'introduction : « Bebert AI s'appuie sur des fournisseurs d'IA : ajoutez vos clés API, puis choisissez le modèle qui répond à vos questions et celui qui indexe vos documents. » Mise en page lisible à 375 px de large.

- [ ] **Step 6: Typage et lint**

Run: `npx tsc --noEmit && npx eslint .`
Expected: aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(auth)" src/components/onboarding
git commit -m "feat(onboarding): the welcome page, after the first sign-in: the user adds their providers with their API keys and picks the generation and embedding models among the ones synchronized, or postpones it"
```

---

### Task 6: Vérification complète

**Files:** aucun nouveau.

- [ ] **Step 1: Tests, typage, lint, build**

Run: `npm test && npx tsc --noEmit && npx eslint . && npm run build`
Expected: tout passe.

- [ ] **Step 2: Compose sans Ollama**

Run: `docker compose up -d --build && docker compose ps`
Expected: `caddy`, `app` (healthy), `worker`, `backup`, `redis`, `qdrant`, sans `ollama` ; `docker compose logs app` sans erreur d'initialisation d'Ollama.

- [ ] **Step 3: Parcours à la main**

Sur l'app du compose :
- un compte neuf arrive sur `/bienvenue` ; Anthropic seul → « Commencer » désactivé et message embedding ; ajout de Voyage AI → choix possibles → « Commencer » → `/` sans bandeau ; une question reçoit une réponse et un document s'indexe ;
- un second compte choisit « Configurer plus tard » → `/` avec le bandeau, pas de retour forcé sur `/bienvenue` ;
- `/bienvenue` pour un compte déjà configuré → renvoie vers `/` ;
- désactiver le modèle d'embedding dans les réglages → le bandeau donne la raison ;
- la liste « Ajouter un fournisseur » ne propose pas Ollama local.

- [ ] **Step 4: Graphe**

Run: `graphify update .`
Expected: graphe mis à jour (`graphify-out/` est ignoré par git : rien à committer).
