# Plan de nettoyage des @ts-nocheck

## Contexte

Lors des sprints CI (commits #580–593), des directives `// @ts-nocheck` ont été ajoutées en masse sur ~40 fichiers pour passer le typecheck en bloquant les erreurs TypeScript réelles. C'est une dette technique à résorber.

## Inventaire (mai 2026)

### api-server/src/routes (~25 fichiers)
- actes/, admin/, ai/, analytics/, anesthesie/
- communications/, comptabilite/, consultations/
- cremation/, dashboard/, encaissements/
- equipe/, factures/, facturx/, fournisseurs/
- groupe/, ordonnances/, owners/, portail/
- rapports/, reports/, vaccinations/, ventes/

### api-server/src/lib + middleware (~10 fichiers)
- lib/aiService.ts
- middleware/auditLogger.ts, rateLimiter.ts
- middlewares/responseWrapper.ts

### vetcare/src (~5 fichiers)
- Composants App, tests, hooks

## Stratégie de nettoyage

### Principe
Un `@ts-nocheck` = une dette. On ne supprime pas aveuglément — on fixe les vraies erreurs, une route à la fois.

### Ordre de priorité (impact décroissant)

| Priorité | Fichiers | Raison |
|----------|----------|--------|
| P0 | `middleware/`, `lib/aiService.ts` | Transversal — erreur ici = bug partout |
| P1 | `routes/factures/`, `routes/facturx/` | Facturation = critique business |
| P1 | `routes/consultations/` | Cœur métier |
| P2 | `routes/patients/`, `routes/owners/` | Données fondamentales |
| P3 | Reste des routes | Long tail |

### Process par fichier

```bash
# 1. Retirer @ts-nocheck du fichier
# 2. Lancer tsc ciblé
pnpm --filter @workspace/api-server exec tsc --noEmit --skipLibCheck 2>&1 | grep "routes/factures"

# 3. Corriger les erreurs une par une :
#    - TS2345 : type mismatch → typer explicitement
#    - TS2339 : property does not exist → ajouter à l'interface
#    - TS7006 : parameter implicitly any → typer req/res avec Request/Response
#    - TS2304 : cannot find name → import manquant

# 4. Commit avec message :
#    fix(types): remove @ts-nocheck from routes/factures — N errors fixed
```

### Types Express courants à ajouter

```typescript
import type { Request, Response, NextFunction } from 'express';

// req.auth vient de Clerk
declare module 'express-serve-static-core' {
  interface Request {
    auth?: { userId: string; orgId: string };
    clinic?: { id: string; name: string; /* ... */ };
  }
}
```

## Métriques cibles

| Métrique | Aujourd'hui | Cible Sprint 4 | Cible Sprint 6 |
|----------|-------------|----------------|----------------|
| Fichiers @ts-nocheck | ~40 | < 20 | 0 |
| Erreurs TS bloquées | ~200+ | < 100 | 0 |

## Notes

- Ne pas utiliser `// @ts-ignore` ligne par ligne comme substitut — ça masque sans corriger.
- Les erreurs sur `req.clinic` et `req.auth` se règlent une seule fois en étendant le type `Request` dans `types/express.d.ts`.
- Prioriser les corrections qui permettent au build esbuild de passer (actuellement `continue-on-error: true`).
