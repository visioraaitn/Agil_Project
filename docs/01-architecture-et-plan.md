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

### Phase 0 · Fondations (~2 j)
Monorepo, Docker Compose, Prisma + migration initiale, seed, CI lint/test/build, AppShell + sidebar
avec routes vides.
*Fin de phase :* `pnpm dev` lance API + web, `/health` répond, la coquille visuelle est en place.

### Phase 1 · MVP — Auth + Projets (A + B) (~1 sem.)
Login JWT + refresh, CRUD utilisateurs (admin), CRUD projets, affectation des membres avec rôle par
projet, guards RBAC bout en bout, vue portefeuille, sélecteur de projet.
*Fin de phase :* un admin crée un projet, ajoute un PO et un dev, chacun voit ce qu'il doit voir.

### Phase 2 · MVP — Backlog + Board (C.1, C.2, D) (~1,5 sem.)
Epics/Stories/Sous-tâches, backlog hiérarchique avec réordonnancement DnD, labels, priorité,
panneau de détail (description PO, notes dev, critères d'acceptation, story points, pièces jointes),
Task Board Kanban 5 colonnes avec DnD.
*Fin de phase :* **le MVP demandé est utilisable au quotidien.**

### Phase 3 · Sprints + Roadmap (C.3, C.4) (~1 sem.)
Création de sprint, affectation depuis le backlog, objectif, clôture avec figeage des points,
rétrospective, timeline des epics, snapshots quotidiens (job cron).

### Phase 4 · Git & approbation (E) (~1 sem.)
Dépôts référencés, branches (liste + création), déclaration de PR, statut « Prêt pour approbation »,
approbation/rejet par le PO avec commentaire, historique des statuts.
Intégration API GitHub/GitLab optionnelle, derrière une interface `GitProviderAdapter`.

### Phase 5 · Collaboration (G) (~1 sem.)
Commentaires + mentions, historique des modifications, notifications in-app temps réel (Socket.IO),
notifications email (BullMQ), préférences par utilisateur.

### Phase 6 · Reporting (F) (~1 sem.)
Burndown, vélocité, dashboard projet, calendrier, recherche globale (Postgres full-text + trigram),
filtres avancés persistables.

### Phase 7 · Durcissement (~1 sem.)
Tests E2E des parcours critiques, accessibilité clavier du DnD, rate limiting, sauvegardes, logs
structurés, déploiement.

---

## 4. Hypothèses retenues (à corriger si besoin)

1. **Mono-organisation** : instance interne VisioraAI, pas de multi-tenant. Un `Admin` voit tout.
2. **Authentification locale** (email + mot de passe) ; SSO Microsoft Entra prévu comme extension.
3. **Pas d'auto-inscription** : seul un Admin crée les comptes.
4. **Le Scrum Master** gère sprints/rétrospectives et le backlog, mais n'approuve pas les PR
   (le cahier des charges réserve l'approbation au PO).
5. **« Création de branche »** = enregistrement d'une référence dans l'app (`isLocalOnly`), sans
   appel à l'API Git en MVP ; la synchro réelle arrive en phase 4 si tu fournis un token.
6. **Suppression = soft delete** partout (utilisateurs, tickets, commentaires) pour préserver l'audit.
7. **Colonnes du board fixes** (les 5 du cahier des charges), personnalisation non prévue.
8. **Story points** : Fibonacci 1-2-3-5-8-13-21, portés par les Stories (les Epics agrègent).
9. **Interface en français**, i18n structurée dès le départ mais une seule langue livrée.
10. **Pièces jointes** : 25 Mo max, images + PDF + documents bureautiques.
