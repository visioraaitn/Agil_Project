# VisioraAI Agile — Architecture & plan de livraison

> Document de référence. Le périmètre fonctionnel fait foi dans `Cahier_des_Charges_Fonctionnel.pdf` ;
> le contexte projet est dans `CLAUDE.md`.

---

## 1. Décisions de stack

| Sujet | Choix | Raison |
|---|---|---|
| Monorepo | **pnpm workspaces + Turborepo** | cache de build, types partagés front/back sans publication |
| Backend | **NestJS** (plutôt qu'Express) | modules/DI/guards = RBAC par projet propre ; Swagger auto ; WebSocket gateway intégré |
| ORM | Prisma + PostgreSQL 16 | conforme à la demande |
| Validation | **Zod** dans `packages/shared` | un seul schéma pour valider côté API et côté formulaire |
| Front data | TanStack Query v5 + React Router v6 | conforme à la demande |
| État local UI | **Zustand** (filtres board, panneaux) | léger, pas de Redux |
| Drag & drop | **dnd-kit** | `react-beautiful-dnd` n'est plus maintenu ; dnd-kit gère board + arbre backlog |
| Temps réel | **Socket.IO** | rooms par projet/utilisateur, reconnexion et fallback gérés |
| Graphiques | **Recharts** | burndown/vélocité, suffisant et léger |
| Pièces jointes | **S3-compatible** (MinIO en local) via URL présignées | ne jamais servir les binaires depuis l'API Node |
| Emails | Nodemailer + **BullMQ/Redis** (phase 5) | l'envoi ne doit pas bloquer la requête HTTP |
| Tests | Vitest (front), Jest + Supertest (API), Playwright (E2E) | |

### Deux choix de modélisation à valider

1. **Ticket unifié (`WorkItem`) plutôt que 3 tables Epic/Story/Subtask.**
   Un seul modèle avec `type` (`EPIC | STORY | SUBTASK | BUG`) et une hiérarchie `parentId`.
   → commentaires, historique, labels, pièces jointes et recherche globale ne sont écrits qu'une fois.
   C'est le modèle d'Azure DevOps et de Jira.

2. **Matrice de permissions en code** (`packages/shared/src/permissions.ts`), pas en base.
   Typée, testable, versionnée avec le code. Les rôles sont fixes (Admin, PO, SM, Dev, Viewer).
   Si un jour il faut des permissions personnalisables par projet, on ajoute une table
   `RolePermissionOverride` sans casser l'existant.

### Ordonnancement du backlog

Champ `rank` en **LexoRank** (chaîne de caractères) plutôt qu'un entier `position`.
Déplacer un ticket entre deux voisins = 1 seul `UPDATE`, au lieu de renuméroter toute la liste.

---

## 2. Architecture de dossiers

```
projets-agil/
├─ apps/
│  ├─ api/                          # NestJS
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma
│  │  │  ├─ migrations/
│  │  │  └─ seed.ts                 # jeu de données de démo (users, projet, sprint)
│  │  ├─ src/
│  │  │  ├─ main.ts
│  │  │  ├─ app.module.ts
│  │  │  ├─ common/
│  │  │  │  ├─ guards/              # JwtAuthGuard, ProjectRoleGuard
│  │  │  │  ├─ decorators/          # @CurrentUser, @RequirePermission
│  │  │  │  ├─ filters/             # exceptions -> réponse d'erreur normalisée
│  │  │  │  ├─ interceptors/        # ActivityLogInterceptor, pagination
│  │  │  │  └─ pipes/               # ZodValidationPipe
│  │  │  ├─ prisma/                 # PrismaService (module global)
│  │  │  ├─ config/                 # env typé (Zod)
│  │  │  ├─ events/                 # bus interne -> notifications + audit
│  │  │  ├─ realtime/               # Socket.IO gateway, rooms
│  │  │  └─ modules/
│  │  │     ├─ auth/                # login, refresh, logout, me
│  │  │     ├─ users/               # A.1
│  │  │     ├─ projects/            # B.1, B.2 (+ members/)
│  │  │     ├─ repositories/        # dépôts + branches référencés
│  │  │     ├─ work-items/          # C.1, D.2, D.3 (+ criteria, attachments)
│  │  │     ├─ labels/              # C.2
│  │  │     ├─ sprints/             # C.3 (+ retrospective, snapshots)
│  │  │     ├─ board/               # D.1 (lecture optimisée + move)
│  │  │     ├─ pull-requests/       # E.1
│  │  │     ├─ comments/            # G.2
│  │  │     ├─ activity/            # G.2 historique
│  │  │     ├─ notifications/       # G.1
│  │  │     ├─ reports/             # F.1 burndown, vélocité
│  │  │     ├─ search/              # F.4
│  │  │     └─ storage/             # S3 presign
│  │  └─ test/
│  │
│  └─ web/                          # React + Vite
│     ├─ index.html
│     └─ src/
│        ├─ main.tsx
│        ├─ app/
│        │  ├─ router.tsx
│        │  ├─ providers.tsx        # QueryClient, Auth, Socket, Toaster
│        │  └─ guards.tsx           # RequireAuth, RequireProjectRole
│        ├─ layouts/
│        │  ├─ AppShell.tsx         # topbar + sidebar (style Azure DevOps)
│        │  ├─ Sidebar.tsx          # sélecteur projet + sections
│        │  └─ ProjectLayout.tsx
│        ├─ components/
│        │  ├─ ui/                  # Button, Dialog, Select, Table, Tabs...
│        │  └─ common/              # UserAvatar, PriorityBadge, StatusPill...
│        ├─ features/
│        │  ├─ auth/
│        │  ├─ portfolio/           # B.2 vue multi-projets
│        │  ├─ projects/            # B.1 CRUD + membres + paramètres
│        │  ├─ backlog/             # C.1 arbre hiérarchique + DnD
│        │  ├─ board/               # D.1 kanban DnD
│        │  ├─ work-items/          # panneau de détail (PO/dev/critères/PJ/sous-tâches)
│        │  ├─ sprints/             # C.3 + rétrospective
│        │  ├─ roadmap/             # C.4 timeline
│        │  ├─ repos/               # E.1 dépôts, branches, PR
│        │  ├─ dashboard/           # F.1 F.2
│        │  ├─ calendar/            # F.3
│        │  ├─ search/              # F.4
│        │  ├─ notifications/       # G.1
│        │  └─ admin/               # A.1 A.2
│        │     └─ (chaque feature : api.ts · hooks.ts · components/ · pages/ · types.ts)
│        ├─ lib/
│        │  ├─ api-client.ts        # fetch + refresh token automatique
│        │  ├─ query-keys.ts
│        │  ├─ socket.ts
│        │  └─ utils.ts
│        └─ styles/globals.css
│
├─ packages/
│  ├─ shared/                       # types, enums, DTO Zod, matrice de permissions, LexoRank
│  └─ tsconfig/                     # configs TS partagées (base / node / react)
│
├─ docs/
├─ docker-compose.yml               # postgres + redis + minio + mailhog
├─ eslint.config.mjs                # config ESLint plate, unique pour tout le dépôt
├─ turbo.json
├─ pnpm-workspace.yaml
├─ .env                             # unique, lu par l'API et par Vite (envDir)
└─ CLAUDE.md
```

> **Note ESLint.** La règle `consistent-type-imports` est désactivée sur `apps/api` :
> NestJS résout ses dépendances à l'exécution via les métadonnées de décorateurs, et
> réécrire `import { PrismaService }` en `import type` efface le symbole du JS compilé,
> ce qui casse l'injection au démarrage. Elle reste active sur le front et `shared`.

Convention API : `/api/v1/projects/:projectId/work-items` — le `projectId` dans l'URL permet au
`ProjectRoleGuard` de résoudre le rôle **par projet** de façon uniforme.

---

## 3. Plan de livraison par phases

> **Avancement** — phases 0 à 7 livrées fonctionnellement.
> Prochaine étape : stabilisation finale et choix infra cible.

### Phase 0 · Fondations (~2 j) — ✔ livrée
Monorepo, Docker Compose, Prisma + migration initiale, seed, CI lint/test/build, AppShell + sidebar
avec routes vides.
*Fin de phase :* `pnpm dev` lance API + web, `/health` répond, la coquille visuelle est en place.

### Phase 1 · MVP — Auth + Projets (A + B) (~1 sem.) — ✔ livrée
Login JWT + refresh, CRUD utilisateurs (admin), CRUD projets, affectation des membres avec rôle par
projet, guards RBAC bout en bout. Écrans : connexion, portefeuille, vue d'ensemble projet avec
panneau membres, administration des comptes, sélecteur de projet, déconnexion.

**Annuaire des comptes.** `GET /users` exige `user:manage`, réservé à l'admin. Un Product Owner
détient `project:member:manage` sans être admin : il ne pouvait donc désigner personne à affecter.
D'où `GET /users/directory`, ouvert à tout utilisateur authentifié et volontairement pauvre
(`id`, `name`, `email`, `avatarUrl`). Les sélecteurs d'assigné de la phase 2 s'appuieront dessus.

#### Chaîne d'authentification

```
POST /auth/login
  └─ IdentityProvider « local »  ── vérifie le mot de passe (bcrypt)
       └─ access token JWT 15 min   → en mémoire côté front (jamais localStorage)
       └─ refresh token opaque 7 j  → cookie httpOnly, path /api/v1/auth
                                      empreinte HMAC en base (table Session)

POST /auth/refresh → rotation : l'ancien est révoqué, un nouveau est émis.
                     Rejouer un token consommé échoue → vol détectable.
```

Le point d'extension SSO est l'interface `IdentityProvider` : un provider transforme des
informations d'entrée en une identité vérifiée (une adresse email), et rien d'autre. Le
rattachement au compte, les rôles et les sessions restent côté `AuthService`.

#### Chaîne d'autorisation

```
requête ─→ JwtAuthGuard          vérifie le JWT, RELIT l'utilisateur en base
        │                        (désactivation effective immédiatement)
        └─→ ProjectPermissionGuard
              1. résout :projectId (UUID ou clé courte « VIS »)
              2. lit le rôle de l'utilisateur SUR CE PROJET (table ProjectMember)
              3. appartenance = droit de lecture ; sinon 403 NOT_A_PROJECT_MEMBER
              4. @RequirePermission(...) → can() sur la matrice partagée
```

Le token ne contient aucun rôle : il prouve l'identité, pas les droits. Un changement de rôle ou
un retrait de membre prend donc effet à la requête suivante, sans révocation de token à gérer.

### Phase 2 · MVP — Backlog + Board (C.1, C.2, D) (~1,5 sem.) — ✔ livrée
Epics/Stories/Bugs/Sous-tâches, backlog hiérarchique avec réordonnancement DnD, étiquettes,
priorité, panneau de détail (description PO, notes dev, critères d'acceptation, story points,
étiquettes, sous-tâches), Task Board Kanban 5 colonnes avec DnD.
*Livré ensuite :* pièces jointes stockées localement en dev, avec métadonnées compatibles stockage objet.

#### Deux ordres, pas un

`rank` ordonne le backlog entre frères ; `boardRank` ordonne les cartes dans une colonne.
Les partager aurait signifié qu'un simple glissement de carte sur le board rejoue la
priorisation du backlog — deux gestes de sens opposés pour le même champ.

Le client n'envoie jamais d'index mais les **voisins** de la position visée
(`beforeId` au-dessus, `afterId` en dessous). Le serveur calcule un rang entre les deux
(LexoRank) : un seul UPDATE, et deux personnes qui déplacent des cartes en même temps
n'écrasent pas leurs positions respectives.

#### Hiérarchie

`ALLOWED_PARENT_TYPES` dans `@visiora/shared` est la seule autorité : le formulaire de
création n'affiche que les parents légaux, et le service revalide avant écriture. Les cycles
sont détectés en parcourant la descendance.

### Phase 3 · Sprints + Roadmap (C.3, C.4) (~1 sem.) — ✔ livrée
Création de sprint, affectation depuis le backlog, objectif, clôture avec figeage des points,
rétrospective, timeline des epics, snapshots quotidiens (job cron).
*Reporté :* snapshots quotidiens automatisés, à raccorder au module reporting/jobs.

### Phase 4 · Git & approbation (E) (~1 sem.) — ✔ livrée
Dépôts référencés, branches (liste + création), déclaration de PR, statut « Prêt pour approbation »,
approbation/rejet par le PO avec commentaire, historique des statuts.
Intégration API GitHub/GitLab optionnelle, derrière une interface `GitProviderAdapter`.
*Reporté :* synchronisation API GitHub/GitLab réelle ; l'app référence les dépôts et branches
localement conformément à l'hypothèse “lecture seule / pas d'écriture Git”.

### Phase 5 · Collaboration (G) (~1 sem.) — ◐ livrée
Commentaires + mentions, historique des modifications, notifications in-app temps réel (Socket.IO),
notifications email (BullMQ), préférences par utilisateur.
*Livré :* commentaires sur tickets, mentions, notifications in-app stockées et consultables,
marquage lu, activité `commented` par ticket, diffusion temps réel SSE, email SMTP simple.
*Reporté :* BullMQ/Redis pour file d'attente email robuste, préférences fines et audit automatique de tous les champs.

### Phase 6 · Reporting (F) (~1 sem.) — ✔ livrée
Burndown, vélocité, dashboard projet, calendrier, recherche globale (Postgres full-text + trigram),
filtres avancés persistables.
*Livré :* dashboard projet, burndown calculé depuis snapshots ou sprint actif, vélocité des
sprints clôturés, tâches bloquées, calendrier sprints/jalons/échéances, recherche globale simple.
*Reporté :* full-text/trigram avancé.

### Phase 7 · Durcissement (~1 sem.) — ● en cours
Tests E2E des parcours critiques, accessibilité clavier du DnD, rate limiting, sauvegardes, logs
structurés, déploiement.
*Livré :* filtres backlog/board persistés dans l'URL, rate limiting API configurable par
`RATE_LIMIT_WINDOW_MS` et `RATE_LIMIT_MAX`, tests E2E Playwright login/navigation/filtres,
poignées DnD focusables et capteurs clavier DnD-kit, profil utilisateur, changement de mot de passe,
logs JSON HTTP, scripts sauvegarde/restauration PostgreSQL.
*Livré ensuite :* pièces jointes tickets, notifications SSE/email SMTP, Dockerfiles API/Web,
Nginx front avec proxy `/api/`, `docker-compose.prod.yml`.
*Reste :* choix final d'hébergement, DNS/TLS, supervision externe.

---

## 4. Hypothèses retenues (à corriger si besoin)

1. **Mono-organisation** : instance interne VisioraAI, pas de multi-tenant. Un `Admin` voit tout.
2. ✔ **Confirmé** — **Authentification locale** (email + mot de passe). SSO Microsoft Entra reporté,
   architecturé comme provider d'identité ajoutable (`IdentityProvider`).
3. **Pas d'auto-inscription** : seul un Admin crée les comptes.
4. ✔ **Confirmé** — **Le Scrum Master** gère sprints, rétrospectives et backlog, mais n'approuve pas
   les PR : `pr:approve` n'est détenue que par le Product Owner.
5. ✔ **Confirmé** — **Dépôts en lecture seule.** L'application lit les branches via l'API GitHub et
   n'écrit jamais sur le dépôt. La « création de branche » de E.1 enregistre une référence locale
   (`Branch.isLocalOnly`) que la synchronisation rapprochera de la branche réelle.
6. **Suppression = soft delete** partout (utilisateurs, tickets, commentaires) pour préserver l'audit.
7. **Colonnes du board fixes** (les 5 du cahier des charges), personnalisation non prévue.
8. **Story points** : Fibonacci 1-2-3-5-8-13-21, portés par les Stories (les Epics agrègent).
9. **Interface en français**, i18n structurée dès le départ mais une seule langue livrée.
10. **Pièces jointes** : 25 Mo max, images + PDF + documents bureautiques.
