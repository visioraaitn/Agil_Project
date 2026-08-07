# VisioraAI Agile

Plateforme interne de gestion de projets agile — inspirée d'Azure DevOps.
Périmètre fonctionnel : `Cahier_des_Charges_Fonctionnel.pdf`.
Architecture, décisions et plan de livraison : [`docs/01-architecture-et-plan.md`](docs/01-architecture-et-plan.md).

## Prérequis

- Node.js ≥ 20.11
- pnpm 9 (`npm i -g pnpm@9.15.4`)
- Docker Desktop (PostgreSQL, Redis, MinIO, Mailhog)

## Démarrage

```bash
pnpm install
cp .env.example .env          # puis remplacer les deux secrets JWT
pnpm infra:up                 # postgres + redis + minio + mailhog
pnpm db:migrate               # crée le schéma
pnpm db:seed                  # jeu de données de démonstration
pnpm dev                      # API + front en parallèle
```

| Service | URL |
|---|---|
| Front | http://localhost:5173 |
| API | http://localhost:3000/api/v1 |
| Swagger | http://localhost:3000/api/v1/docs |
| Prisma Studio | `pnpm db:studio` |
| Console MinIO | http://localhost:9001 (`visiora` / `visiora123`) |
| Mailhog | http://localhost:8025 |

### Comptes de démonstration

Mot de passe commun : `Visiora2026!`

| Email | Rôle |
|---|---|
| admin@visiora.ai | Admin plateforme |
| po@visiora.ai | Product Owner |
| sm@visiora.ai | Scrum Master |
| dev1@visiora.ai · dev2@visiora.ai | Développeurs |

## Commandes

```bash
pnpm dev          # tout en mode watch
pnpm build        # build de production
pnpm typecheck    # vérification TypeScript
pnpm lint         # ESLint
pnpm test         # tests unitaires
pnpm db:reset     # réinitialise la base et rejoue le seed
```

## Organisation

```
apps/api        API NestJS + Prisma
apps/web        Front React + Vite + Tailwind
packages/shared Types, enums, schémas Zod, matrice de permissions, LexoRank
docs/           Architecture et décisions
```

Le `.env` est unique et vit à la racine : l'API et Vite le lisent tous les deux.
