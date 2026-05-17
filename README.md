# VetoAI — Logiciel de gestion vétérinaire IA

Monorepo TypeScript — API Express + Frontend React (Vite) + Facturation Factur-X + IA Claude.

## Stack

| Couche | Techno |
|--------|--------|
| Runtime | Node 20, TypeScript 5.9 |
| Package manager | pnpm 9 (workspaces) |
| API | Express 5, Drizzle ORM, PostgreSQL 15 |
| Auth | Clerk (JWT) |
| Frontend | React 18, Vite, Tailwind CSS |
| IA | Anthropic Claude (Sonnet) via SDK |
| Facturation | Factur-X EN16931-BASIC (ZUGFeRD PDF/A-3) |
| CI | GitHub Actions (lint → tests → e2e) |
| Déploiement | Railway (PostgreSQL + Node monolithique) |

## Structure

```
├── artifacts/
│   ├── api-server/          # Backend Express (port 3000)
│   └── vetcare/             # Frontend React/Vite
├── lib/
│   ├── db/                  # Schéma Drizzle ORM + migrations
│   ├── api-zod/             # Schémas Zod partagés
│   ├── integrations-anthropic-ai/  # Client Claude SDK
│   └── facturx/             # Générateur XML Factur-X
├── migrations/              # Fichiers SQL (000-013)
├── scripts/                 # Seed, utilitaires
└── .github/workflows/ci.yml # CI GitHub Actions
```

## Prérequis

- Node 20+
- pnpm 9+ (`npm install -g pnpm@9`)
- PostgreSQL 15 (local ou Railway)

## Installation locale

```bash
# 1. Installer les dépendances
pnpm install

# 2. Copier les variables d'environnement
cp .env.example .env
# Remplir : DATABASE_URL, CLERK_SECRET_KEY, VITE_CLERK_PUBLISHABLE_KEY, ANTHROPIC_API_KEY

# 3. Appliquer les migrations
for m in migrations/0*.sql; do psql $DATABASE_URL -f "$m"; done

# 4. Lancer le dev
pnpm --filter @workspace/api-server dev   # API sur :3000
pnpm --filter @workspace/vetcare dev      # Frontend sur :5173
```

## Variables d'environnement

| Variable | Description | Requis |
|----------|-------------|--------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `CLERK_SECRET_KEY` | Clé secrète Clerk (sk_live_… ou sk_test_…) | ✅ |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clé publique Clerk (pk_live_… ou pk_test_…) | ✅ |
| `ANTHROPIC_API_KEY` | Clé API Anthropic Claude | ✅ |
| `CORS_ALLOWED_ORIGINS` | Origines autorisées (défaut : https://app.vetoai.fr) | |
| `PORT` | Port API (défaut : 3000) | |
| `BASE_PATH` | Base path Vite (défaut : /) | |
| `OBJECT_STORAGE_PROVIDER` | Fournisseur stockage (replit-sidecar, s3) | |

## Scripts

```bash
pnpm typecheck          # Typecheck tous les packages
pnpm -w build           # Build complet
pnpm -r --if-present run test  # Tests unitaires
pnpm test:e2e           # Tests e2e Playwright
pnpm -w lint            # Lint (si configuré)
```

## CI

4 jobs GitHub Actions sur chaque push/PR sur `main` :

| Job | Description | Bloquant |
|-----|-------------|----------|
| Lint & typecheck | tsc + lint | ✅ |
| Tests unitaires | vitest (packages) | ✅ |
| Tests e2e backend | Postgres + API tests | ✅ |
| Build complet | Vite + esbuild | ❌ (continue-on-error) |

## Migrations

Migrations numérotées dans `migrations/`. S'appliquent en ordre croissant. Toutes idempotentes (`IF NOT EXISTS`).

Dernière migration : **013** — Factur-X XML generation + budget IA view.

## Déploiement Railway

```bash
# Appliquer migration en prod
psql $DATABASE_URL -f migrations/013_facturx_generation.sql
```

Service Railway : API monolithique (Express sert le frontend depuis `artifacts/vetcare/dist/public`).

## Endpoints clés

| Route | Description | Auth |
|-------|-------------|------|
| `GET /health` | Health check (pas d'auth) | — |
| `GET /healthz` | Health check Zod-validé | — |
| `POST /api/factures/:id/generate-xml` | Génère XML Factur-X + PDF | Clerk |
| `GET /api/factures/:id/facturx.xml` | Télécharge XML | Clerk |
| `GET /api/factures/:id/facturx.pdf` | Télécharge PDF | Clerk |
| `GET /api/ai/budget` | Budget IA par clinique (30j) | Clerk |

## Rate limiting

- `/api/*` : 200 req/min (général)
- `/api/ai/*` : 10 req/min (IA)
- `/api/facturx/*` : 10 req/min (génération)

## Licence

MIT
