# Patch P2-7 — Rate-limit sur `/api/ai/*`

## Contexte

Le budget Anthropic peut être siphonné en minutes si un bug côté front
(infinite loop) ou une clinique malveillante boucle sur un endpoint IA.
Aujourd'hui, le `apiLimiter` global appliqué à `/api/*` limite à 100
req/min/IP — pas suffisant : une clinique avec 3 vétérinaires peut
théoriquement faire 300 req/min d'IA.

## Patch

Dans `artifacts/api-server/src/routes/ai/index.ts` (haut de fichier),
ajouter :

```ts
import { aiLimiter } from "../../middlewares/aiRateLimiter";
```

Puis, **juste après `const router = Router();`**, ajouter :

```ts
router.use(aiLimiter);
```

De cette manière, TOUS les endpoints exposés sous `/api/ai/*` passent par
le limiteur, y compris les prochains qu'on ajoutera.

## Alternative — au montage dans `app.ts`

Si tu préfères ne pas modifier le router (pour préserver la compatibilité
des tests ou garder le router "pur"), monte-le au niveau de `app.ts` :

```ts
import aiRouter from "./routes/ai";
import { aiLimiter } from "./middlewares/aiRateLimiter";

app.use("/api/ai", aiLimiter, aiRouter);
```

Un seul des deux est nécessaire — pas les deux.

## Tester

```bash
# Spam un endpoint IA plus de 20 fois en 60s depuis la même clinique :
for i in {1..25}; do
  curl -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -X POST https://app.vetoai.fr/api/ai/diagnostic \
    -d '{"espece":"chien","poids":20,"examClinique":"test","motif":"test"}'
done
```

Les 20 premiers retournent 200/500 normaux, les 5 derniers retournent 429
avec le message `AI_RATE_LIMIT`.

## Configuration prod

Dans Railway, ajouter :
```
AI_RATE_LIMIT_PER_MIN=20
```

Monter à 50 si une grosse clinique le demande (et uniquement celle-là —
note qu'ici c'est global, pas par clinique. Pour un plafond par-clinique
configurable, il faudra une table `clinique_limits` — pas prioritaire).
