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

**Phase courante : phase 0 terminée — scaffolding + schéma DB.**
Prochaine étape : phase 1 (Auth + Utilisateurs + Projets + RBAC).

Lire en début de session : [`docs/01-architecture-et-plan.md`](docs/01-architecture-et-plan.md)
(décisions de stack, arborescence, plan par phases, hypothèses retenues).

## Décisions structurantes déjà actées

- **Monorepo** pnpm + Turborepo : `apps/api` (NestJS), `apps/web` (React/Vite), `packages/shared`, `packages/tsconfig`.
- **Ticket unifié `WorkItem`** avec `type` (EPIC/STORY/SUBTASK/BUG) et hiérarchie `parentId` — pas de tables séparées.
- **Ordonnancement LexoRank** (`rank` textuel) pour le backlog et le board : un déplacement = un seul UPDATE.
- **Permissions en code** dans `packages/shared/src/permissions.ts` (`can()`), appliquées par le serveur, utilisées par l'UI seulement pour masquer les commandes.
- **Zod partagé** front/back : un schéma valide le formulaire et le body de la requête.
- `.env` **unique à la racine**, lu par l'API (`@nestjs/config`) et par Vite (`envDir`).
- ESLint : `consistent-type-imports` désactivée sur `apps/api` (casse l'injection de dépendances NestJS).

## Conventions

- Routes API : `/api/v1/projects/:projectId/...` — le `projectId` dans l'URL permet au guard de résoudre le rôle par projet.
- Erreurs API normalisées via `AllExceptionsFilter` → `ApiErrorBody` (`code` applicatif stable, `details` par champ).
- Suppression = **soft delete** (`deletedAt`) sur users, tickets et commentaires.
- Interface en français ; l'API renvoie toujours des codes, jamais du texte affiché (libellés dans `LABELS_FR`).

## Commandes

`pnpm infra:up` · `pnpm db:migrate` · `pnpm db:seed` · `pnpm dev` · `pnpm typecheck` · `pnpm lint`

## Questions encore ouvertes

1. « Création de branche » : appel réel à l'API Git, ou simple référence enregistrée dans l'app ? (hypothèse : référence seule)
2. Authentification locale ou SSO Microsoft Entra ? (hypothèse : locale)
3. Le Scrum Master peut-il approuver une PR ? (hypothèse : non, PO et Admin uniquement)