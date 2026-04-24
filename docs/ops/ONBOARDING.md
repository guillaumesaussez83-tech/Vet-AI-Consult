# Onboarding dev — Vet-AI-Consult

**Objectif** : passer de "j'ai cloné le repo" à "j'ai un PR prêt à merger" en < 2 heures.

---

## 1. Prérequis machine

- Node.js **20** (nvm recommandé : `nvm install 20 && nvm use 20`)
- pnpm **9+** (`npm i -g pnpm`)
- Git
- Un éditeur : VS Code recommandé, avec extensions `ESLint`, `Prettier`, `Tailwind CSS IntelliSense`
- Compte GitHub avec accès au repo `guillaumesaussez83-tech/Vet-AI-Consult`

---

## 2. Clone + install

```bash
git clone git@github.com:guillaumesaussez83-tech/Vet-AI-Consult.git
cd Vet-AI-Consult
pnpm install
```

## 3. Configuration `.env`

Copier le template et remplir les secrets :

```bash
cp .env.example .env
```

Variables minimales pour `pnpm dev` (API server + vetcare) :

| Variable | Où la récupérer |
|---|---|
| `DATABASE_URL` | Demander à Guillaume — DB preview dédiée (**jamais** la prod) |
| `CLERK_SECRET_KEY` | Clerk dashboard → instance Development → API Keys |
| `VITE_CLERK_PUBLISHABLE_KEY` | idem, clé `pk_test_*` |
| `ANTHROPIC_API_KEY` | Clé personnelle dev, jamais la prod |
| `PORT` | `3000` |
| `APP_URL` | `http://localhost:3000` |
| `SESSION_SECRET` | `openssl rand -hex 32` (local, pas besoin d'être long-terme) |
| `RESEND_API_KEY` | Optionnel en dev (emails désactivés sans la clé) |

> **Règle absolue** : pas d'accès direct à la DB de prod pour développer. Si Guillaume ne peut pas fournir une DB preview, créer une Postgres locale via `docker run` (voir plus bas).

## 4. Structure du monorepo

```
.
├── artifacts/
│   ├── api-server/       # Express 5 + Drizzle + Clerk (backend)
│   ├── vetcare/          # Vite + React + Tailwind (frontend principal)
│   └── mockup-sandbox/   # Maquettes isolées
├── lib/                  # packages internes (db, api-zod, intégrations)
├── scripts/              # outils CLI
├── package.json          # workspace root (pnpm)
├── pnpm-workspace.yaml   # déclare les workspaces
└── railway.json          # config déploiement
```

**Packages internes** (import via `@workspace/…`) :
- `@workspace/db` — Drizzle schema + client Postgres
- `@workspace/api-zod` — schémas de validation partagés front/back
- `@workspace/integrations-anthropic-ai` — wrapper Claude API

## 5. Lancer en local

**Option A — backend + frontend simultanés** (recommandé) :

```bash
# terminal 1
pnpm --filter @workspace/api-server run dev

# terminal 2
pnpm --filter vetcare run dev
```

Frontend sur http://localhost:5173 (Vite), backend sur http://localhost:3000.
Vite proxy vers `/api/*` est configuré dans `artifacts/vetcare/vite.config.ts`.

**Option B — mono-process prod-like** :

```bash
pnpm build
pnpm start
```

Le backend sert alors le frontend buildé. Utile pour tester la prod avant push.

## 6. Base de données

### 6.1 DB Postgres locale (Docker)
```bash
docker run --name veto-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=veto \
  -p 5432:5432 -d postgres:16
```

`DATABASE_URL=postgres://postgres:dev@localhost:5432/veto`

### 6.2 Migrations (Drizzle Kit)
```bash
# générer une migration après modif de schéma
pnpm --filter @workspace/db run generate

# appliquer les migrations
pnpm --filter @workspace/db run migrate
```

### 6.3 Seed données de test
```bash
# si un script seed existe
pnpm --filter @workspace/db run seed
```

Si pas de seed : créer 1 clinique + 1 véto + 2 owners + 3 patients via l'UI à la main la 1ʳᵉ fois. À terme, automatiser.

## 7. Conventions

### 7.1 Commits
Conventional Commits (obligatoire) :
- `feat(scope): ajouter nouvelle feature`
- `fix(scope): corriger bug X`
- `refactor(scope): renommer sans changer le comportement`
- `chore(deps): bump package@version`
- `docs(scope): clarifier …`
- `test(scope): ajouter test pour …`
- `ci(scope): modifier workflow …`

Les scopes les plus courants : `api`, `vetcare`, `db`, `auth`, `ai`, `portail`, `factures`.

### 7.2 Branches
- `main` = prod (auto-deploy Railway)
- `fix/*`, `feat/*`, `chore/*` pour les PR
- Pas de push direct sur `main` **sauf** config triviale (dependabot.yml, typos docs)

### 7.3 Tests
- Unit : `vitest` dans chaque workspace (`pnpm test`)
- E2E : Playwright (suite `e2e/`, `pnpm test:e2e`)
- Chaque PR doit passer CI (typecheck + vitest + e2e si touche prod flow)

### 7.4 Style code
- Prettier (config dans `package.json` root) — run automatique via pre-commit (à configurer)
- ESLint — warnings tolérés, erreurs bloquantes
- TypeScript strict — pas de `any` implicite, préférer `unknown` + zod parse

## 8. Où trouver quoi

| Besoin | Fichier/dir |
|---|---|
| Ajouter une route API | `artifacts/api-server/src/routes/<feature>/` |
| Ajouter une validation Zod | `lib/api-zod/src/<feature>.ts` |
| Ajouter une table DB | `lib/db/src/schema/<feature>.ts` |
| Ajouter une page frontend | `artifacts/vetcare/src/pages/<feature>/` |
| Modifier la navigation | `artifacts/vetcare/src/components/Sidebar.tsx` (vérifier le nom réel) |
| Modifier le thème | `artifacts/vetcare/tailwind.config.ts` |
| Ajouter un workflow CI | `.github/workflows/*.yml` |
| Config Clerk | variables env + `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts` |

## 9. Qui contacter

| Sujet | Personne | Canal |
|---|---|---|
| Architecture / décisions produit | Guillaume | Email / WhatsApp |
| DB prod | Guillaume uniquement | — |
| Clerk config | Guillaume | — |
| Questions "comment on fait X" | Guillaume + ce doc + lire le code | — |
| CI cassée | Regarder logs → fix rapide → PR si compliqué | — |

## 10. Premières contributions recommandées

Pour se familiariser sans casser :
1. Lire `artifacts/api-server/src/routes/dashboard/index.ts` + la page dashboard frontend
2. Ajouter un test unitaire manquant
3. Fixer un label d'accessibilité signalé dans `ACCESSIBILITY-AUDIT.md`
4. Ajouter une métrique dans `metricsMiddleware.ts`

## 11. FAQ

**"Pourquoi pnpm et pas npm ?"**
Monorepo + workspaces catalog. `preinstall` refuse npm explicitement.

**"Pourquoi Express 5 et pas Fastify ?"**
Choix historique. Stable, bien documenté, middlewares faciles. Pas prévu de changer.

**"Pourquoi Drizzle et pas Prisma ?"**
Bundle plus léger, pas de binaire Rust, contrôle SQL fin. Stay.

**"Pourquoi Clerk et pas un auth maison ?"**
Compliance email + MFA built-in, portail utilisateur, SOC2. Coût acceptable vs temps dev.
