Contexte

Je développe une plateforme de gestion de projets agile en interne pour ma société VisioraAI. L'expérience utilisateur et l'interface doivent s'inspirer d'Azure DevOps (navigation latérale, boards, backlog, sprints, look sobre et dense en informations).

Stack souhaitée

Adapte si tu recommandes mieux, mais propose avant de changer.

Frontend : React + TypeScript, Vite, TailwindCSS, TanStack Query, React Router
Backend : Node.js + TypeScript (NestJS ou Express), API REST
Base de données : PostgreSQL + Prisma
Auth : JWT + rôles/permissions (RBAC par projet)
Temps réel : WebSocket (notifications in-app)
Périmètre fonctionnel

Le cahier des charges complet est dans le fichier joint Cahier_des_Charges_Fonctionnel.pdf. Modules à livrer :

A · Accès : utilisateurs (CRUD), rôles (Admin, Product Owner, Développeur, Scrum Master), permissions par rôle et par projet
B · Projets : CRUD projet, métadonnées (date début, entreprise, repos Git référencés), affectation membres, vue portefeuille multi-projets
C · Backlog & planification : Epics, User Stories, labels, priorités, sprints (objectif, clôture, rétrospective), roadmap/timeline
D · Suivi : Task Board Kanban (À faire → En cours → En test → Prêt pour approbation → Terminé), détails story (PO + dev, pièces jointes, critères d'acceptation, story points), sous-tâches
E · Git & approbation : workflow Pull Request (déclaration PR, sélection/création de branche, statut "Prêt pour approbation", approbation/rejet par le PO, historique des statuts). ⚠️ Les repos sont sur une plateforme Git externe — l'app ne fait que référencer branches et PR.
F · Reporting : burndown chart, vélocité, dashboard, calendrier, recherche globale + filtres avancés
G · Collaboration : notifications in-app + email, commentaires, historique des modifications
Exigences UX (style Azure DevOps)
Barre latérale gauche avec sélecteur de projet en haut, puis sections (Overview, Boards, Backlog, Sprints, Repos, Dashboards)
Board Kanban avec drag & drop entre colonnes
Backlog en liste hiérarchique (Epic > Story > Sous-tâche) avec priorisation par glisser-déposer
Thème clair et dense, accents bleus, typographie compacte
Ce que je veux de toi maintenant
Pose-moi les questions bloquantes s'il y en a (sinon prends des hypothèses raisonnables et note-les).
Propose une architecture de dossiers (monorepo frontend/backend) et le schéma de base de données (modèles Prisma).
Établis un plan de livraison par phases (MVP d'abord : Auth + Projets + Backlog + Board).
Ne génère pas encore tout le code : commençons par le scaffolding + le schéma DB, puis on itère module par module.

Commence par les points 2 et 3.

---

# État du projet (mis à jour à chaque phase)

**Phase courante : phase 7 en cours — Durcissement produit.**
Livré dans cette phase : filtres backlog/board persistés dans l'URL, rate limiting API configurable,
tests E2E Playwright des parcours critiques, poignées DnD focusables et capteurs clavier,
profil utilisateur, changement de mot de passe, logs JSON HTTP, scripts sauvegarde/restauration DB.
Prochaine étape : stabilisation finale et choix infra cible.

Écrans livrés : connexion, portefeuille, vue d'ensemble projet + membres, administration
des comptes, **backlog arborescent avec glisser-déposer, Task Board Kanban 5 colonnes,
panneau de détail (description PO, notes dev, critères d'acceptation, points, étiquettes,
sous-tâches)**, **sprints (création, objectif, clôture, points figés, rétrospective)**,
**roadmap des epics datés**, **dépôts Git référencés, branches locales, déclaration de PR,
statut prête pour approbation, approbation/rejet PO avec historique**.
**Commentaires sur tickets, mentions avec notifications in-app, historique d'activité par ticket,
menu notifications utilisateur.** **Dashboard projet, burndown, vélocité, tâches bloquées,
calendrier projet, recherche globale.** **Filtres backlog/board partageables par URL,
rate limiting HTTP configurable, tests E2E login/navigation/filtres, DnD clavier,
profil/mot de passe, logs structurés, sauvegardes DB.**
Durcissement livré : notifications temps réel SSE + email SMTP, pièces jointes tickets,
artefacts Docker de déploiement cible.

Lire en début de session : [`docs/01-architecture-et-plan.md`](docs/01-architecture-et-plan.md)
(décisions de stack, arborescence, plan par phases, hypothèses retenues).

## Décisions structurantes déjà actées

- **Monorepo** pnpm + Turborepo : `apps/api` (NestJS), `apps/web` (React/Vite), `packages/shared`, `packages/tsconfig`.
- **Ticket unifié `WorkItem`** avec `type` (EPIC/STORY/SUBTASK/BUG) et hiérarchie `parentId` — pas de tables séparées.
- **Ordonnancement LexoRank** : un déplacement = un seul UPDATE. **Deux champs distincts** —
  `rank` (ordre du backlog, entre frères) et `boardRank` (ordre dans la colonne du board).
  Réordonner une carte sur le board ne doit jamais bousculer la priorisation du backlog.
- **Le client envoie des voisins, pas un index** (`beforeId` = au-dessus, `afterId` = en dessous) :
  deux utilisateurs qui déplacent des cartes simultanément ne s'écrasent pas.
- **Permissions en code** dans `packages/shared/src/permissions.ts` (`can()`), appliquées par le serveur, utilisées par l'UI seulement pour masquer les commandes.
- **Zod partagé** front/back : un schéma valide le formulaire et le body de la requête.
- `.env` **unique à la racine**, lu par l'API (`@nestjs/config`) et par Vite (`envDir`).
- ESLint : `consistent-type-imports` désactivée sur `apps/api` (casse l'injection de dépendances NestJS).

## Sécurité et RBAC (phase 1) — règles à ne pas contourner

- **Le token ne porte que l'identité** (`sub`, `email`). Aucun rôle, aucune permission dedans.
  Rôles et droits sont relus en base à chaque requête : un retrait de membre ou un changement
  de rôle prend effet immédiatement, sans attendre l'expiration du token.
- **Jamais de test de rôle en dur.** Interdiction d'écrire `role === 'PRODUCT_OWNER'` : toute
  décision passe par `@RequirePermission('...')` et la matrice `can()`. L'approbation de PR est
  la permission `pr:approve`, détenue par le seul PO.
- **Deux guards globaux** (`app.module.ts`) : `JwtAuthGuard` puis `ProjectPermissionGuard`.
  Sécurité fermée par défaut — une route est authentifiée sauf `@Public()`, et toute route
  portant `:projectId` exige l'appartenance au projet.
- **Refresh token** : valeur aléatoire opaque (pas un JWT), stockée en base sous forme d'empreinte
  HMAC, transmise en cookie `httpOnly` limité à `…/auth`. Rotation à chaque usage ; rejouer un
  token déjà consommé échoue.
- **Accès SSO** : `IdentityProvider` (`modules/auth/identity/`) est le point d'extension.
  Ajouter Entra = écrire `EntraIdentityProvider` et l'inscrire dans `IDENTITY_PROVIDERS`.
  Rien d'autre dans la chaîne d'authentification ne bouge.
- **Invariants** : la plateforme garde au moins un Admin ; un projet garde au moins un Product
  Owner (sans lui, plus personne ne peut approuver de PR).
- **`GET /users` est réservé à `user:manage` (admin)**. Pour les sélecteurs de personnes
  (affecter un membre, assigner un ticket), utiliser **`GET /users/directory`** : ouvert à tout
  utilisateur authentifié, il n'expose que `id`, `name`, `email`, `avatarUrl`. Sans lui, un
  Product Owner — qui gère les membres mais n'est pas admin — ne pourrait désigner personne.
- Le token porte un **`jti`** unique : deux JWT signés dans la même seconde seraient sinon
  identiques (`iat` est en secondes), donc indistinguables dans les journaux.

## Règles des tickets (phase 2)

- **Hiérarchie contrainte par `ALLOWED_PARENT_TYPES`** (dans `@visiora/shared`) :
  EPIC racine · STORY et BUG sous un EPIC ou racine · SUBTASK obligatoirement sous STORY ou BUG.
  Le service refuse tout rattachement hors table et détecte les cycles.
- **Les epics ne vont pas sur le board** : ils ne sont pas du travail réalisable. Le board
  ne montre que STORY, BUG et SUBTASK.
- **Un epic n'est pas estimé** : son `rolledUpPoints` est la somme de ses descendants.
- **Étiquettes et critères d'acceptation se remplacent en bloc** (`labelIds`,
  `acceptanceCriteria` dans le PATCH) : le client envoie l'état voulu, pas un diff.
- **L'assigné doit être membre du projet** — sinon 400 `ASSIGNEE_NOT_MEMBER`.
- **Numérotation `VIS-142`** : `project.lastItemNumber` est incrémenté dans la même
  transaction que la création, deux créations simultanées ne peuvent pas collisionner.
- **Suppression = soft delete en cascade** sur toute la descendance.
- Le glisser-déposer du backlog reprioorise **entre frères uniquement** ; changer de parent
  se fait explicitement (sélecteur « Rattacher à » à la création).

## Conventions front (phase 1)

- Alias **`@/`** vers `apps/web/src` — pas d'imports relatifs profonds.
- **Token d'accès en mémoire** (jamais `localStorage`) ; la session se restaure au chargement
  via `POST /auth/refresh` et le cookie `httpOnly`.
- **`useProjectPermissions(projectRef)`** interroge `GET /projects/:id/access` et expose `can()`.
  L'UI ne s'en sert que pour masquer ou désactiver les commandes — l'API reste seule juge.
- Formulaires : `react-hook-form` + `zodResolver` sur **les schémas de `@visiora/shared`**,
  ceux-là mêmes que l'API applique.
- Erreurs : `ApiError` expose `code`, `message` et `details` par champ ; les erreurs métier
  s'affichent telles quelles (`InlineError`), les erreurs de champ se posent sur le formulaire.
- **Glisser-déposer : `@dnd-kit`** (`react-beautiful-dnd` n'est plus maintenu). Le déplacement
  d'une carte est appliqué au cache TanStack Query **avant** la réponse serveur, sinon la carte
  reviendrait visiblement à sa place le temps de l'aller-retour ; `onError` restaure l'état.

## Surface API livrée

```
POST   /auth/login · /auth/refresh · /auth/logout · /auth/change-password
GET    /auth/me
GET    /users/directory                        (annuaire léger, tout authentifié)
GET    /users · POST /users · GET|PATCH|DELETE /users/:userId
POST   /users/:userId/reset-password · PATCH /users/me
GET    /projects · POST /projects
GET|PATCH|DELETE /projects/:projectId          (DELETE = archivage)
GET    /projects/:projectId/access             (rôle + permissions effectives)
GET|POST /projects/:projectId/members
PATCH|DELETE /projects/:projectId/members/:userId

GET    /projects/:projectId/backlog             (arbre Epic > Story > Sous-tâche)
GET    /projects/:projectId/board               (5 colonnes, epics exclus)
POST   /projects/:projectId/work-items
GET|PATCH|DELETE /projects/:projectId/work-items/:itemId
POST   /projects/:projectId/work-items/:itemId/move      (board : statut + position)
POST   /projects/:projectId/work-items/:itemId/reorder   (backlog : position entre frères)
GET|POST /projects/:projectId/labels
PATCH|DELETE /projects/:projectId/labels/:labelId

GET|POST /projects/:projectId/sprints
GET|PATCH /projects/:projectId/sprints/:sprintId
POST   /projects/:projectId/sprints/:sprintId/close
PATCH  /projects/:projectId/sprints/:sprintId/retrospective
GET    /projects/:projectId/roadmap

GET|POST /projects/:projectId/repositories
PATCH    /projects/:projectId/repositories/:repositoryId
GET|POST /projects/:projectId/repositories/:repositoryId/branches
GET|POST /projects/:projectId/pull-requests
GET      /projects/:projectId/pull-requests/:pullRequestId
PATCH    /projects/:projectId/pull-requests/:pullRequestId/ready
PATCH    /projects/:projectId/pull-requests/:pullRequestId/review

GET|POST /projects/:projectId/work-items/:itemId/comments
DELETE   /projects/:projectId/work-items/:itemId/comments/:commentId
GET      /projects/:projectId/work-items/:itemId/activity
GET      /notifications
PATCH    /notifications/:notificationId/read

GET      /projects/:projectId/dashboard
GET      /projects/:projectId/calendar
GET      /search?q=...
```

Backlog et board partagent les mêmes filtres en query string (`search`, `type`, `status`,
`priority`, `assigneeId`, `labelId`, `sprintId`, `isBlocked`, `hideDone`).

`:projectId` accepte l'UUID **ou** la clé courte (`VIS`) ; le guard résout l'identifiant réel
une fois et l'expose aux contrôleurs via `@ProjectId()`.

## Conventions

- Routes API : `/api/v1/projects/:projectId/...` — le `projectId` dans l'URL permet au guard de résoudre le rôle par projet.
- Erreurs API normalisées via `AllExceptionsFilter` → `ApiErrorBody` (`code` applicatif stable, `details` par champ).
- Suppression = **soft delete** (`deletedAt`) sur users, tickets et commentaires.
- Interface en français ; l'API renvoie toujours des codes, jamais du texte affiché (libellés dans `LABELS_FR`).

## Commandes

`pnpm infra:up` · `pnpm db:migrate` · `pnpm db:seed` · `pnpm dev` · `pnpm typecheck` · `pnpm lint`

## Questions tranchées par le client (07/08/2026)

1. **Auth locale JWT.** SSO Entra reporté, architecturé comme provider ajoutable. ✔ fait
2. **Aucun rôle dans le token** ; permissions par projet résolues en base à chaque requête. ✔ fait
3. **Branches Git référencées uniquement** — lecture via API GitHub, jamais d'écriture. → phase 4
4. **Approbation PR = permission RBAC réservée au PO**, jamais de test de rôle en dur. ✔ matrice en place

## À trancher avant la phase 4

- Quel compte/token GitHub pour la lecture des branches : une app GitHub d'organisation,
  ou un token par projet saisi dans les paramètres ? (impacte le modèle `Repository`)
