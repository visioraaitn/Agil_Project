# Production et exploitation

## Commandes de validation

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

## Logs structures

L'API emet un log JSON par requete HTTP avec :

- `timestamp`
- `service`
- `event`
- `method`
- `path`
- `statusCode`
- `durationMs`
- `requestId`
- `ip`
- `userAgent`

Chaque reponse renvoie aussi `X-Request-Id`. En production, rediriger stdout/stderr vers le collecteur de logs choisi.

## Sauvegarde PostgreSQL

Prerequis : les outils client PostgreSQL doivent etre installes et `pg_dump` / `pg_restore` accessibles dans le `PATH`.

Creer une sauvegarde :

```powershell
pnpm db:backup
```

Le fichier est ecrit dans `backups/` au format custom PostgreSQL.

Restaurer une sauvegarde :

```powershell
pnpm db:restore -- .\backups\visiora-YYYYMMDD-HHMMSS.dump
```

La restauration utilise `--clean --if-exists`. Elle est destructive pour la base cible.

## Variables sensibles

En production, remplacer toutes les valeurs `changeme` :

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `DATABASE_URL`
- secrets SMTP/S3 si actives

Les secrets JWT doivent faire au moins 32 caracteres.

## Deploiement Docker cible

Un compose production est fourni :

```powershell
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Variables minimales dans `.env.production` :

```dotenv
POSTGRES_PASSWORD=change-me
JWT_ACCESS_SECRET=generer-une-valeur-longue-aleatoire
JWT_REFRESH_SECRET=generer-une-autre-valeur-longue-aleatoire
APP_ORIGIN=https://votre-domaine.example
WEB_PORT=80
```

Appliquer les migrations avant ouverture aux utilisateurs :

```powershell
docker compose -f docker-compose.prod.yml exec api pnpm --filter @visiora/api prisma:deploy
```

Le front Nginx sert l'application et proxifie `/api/` vers l'API, y compris le flux SSE
`/api/v1/notifications/stream`.
