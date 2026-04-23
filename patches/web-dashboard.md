# Patch F-P0-2 — `fetch()` bruts → `apiJson()` dans `pages/dashboard.tsx`

Exemple de migration mécanique à appliquer à **tous les fichiers listés** dans
l'audit (21 fichiers, 92 call-sites). Ce fichier sert de gabarit.

## Avant (version actuelle)

```ts
const { data } = useQuery({
  queryKey: ["rappels-vaccins"],
  queryFn: async () => {
    const res = await fetch("/api/dashboard/rappels-vaccins");
    if (!res.ok) throw new Error("Erreur de chargement");
    return res.json();
  },
});
```

## Après

```ts
import { apiJson } from "@/lib/queryClient";

const { data } = useQuery({
  queryKey: ["rappels-vaccins"],
  queryFn: () => apiJson<RappelsVaccinsResponse>("/api/dashboard/rappels-vaccins"),
});
```

## Bénéfices

1. Message backend `{success:false, error:{message}}` extrait automatiquement
   → toast user friendly au lieu de "Erreur 500".
2. 401 déclenche le handler global → signOut + redirect /sign-in.
3. Enveloppe `{success, data}` déballée → `data` est typé directement au lieu
   de `data.data`.

## Liste des fichiers à patcher (migration mécanique)

Dans l'ordre de priorité :

1. `pages/dashboard.tsx` (1 fetch) — petit warm-up.
2. `pages/consultations/nouvelle.tsx` (7 fetch) — critique, côté IA + dictée.
3. `pages/stock/index.tsx` (23 fetch) — gros morceau, à faire avec soin.
4. `pages/stupefiants/index.tsx` (3 fetch).
5. `pages/rappels/index.tsx` (4 fetch).
6. `pages/vaccinations/index.tsx` (5 fetch).
7. `pages/salle-attente/index.tsx` (3 fetch).
8. `pages/encaissements/index.tsx` — via API client orval, ok.
9. `pages/parametres/index.tsx` (2 fetch).
10. `pages/statistiques/index.tsx` (1 fetch).
11. `pages/portail/index.tsx` (1 fetch) — déjà utilise `unwrapResponse`, mais
    devrait passer par `apiJson` pour une seule source de vérité.
12. `pages/agenda/index.tsx` (13 fetch).
13. `pages/ordonnances/index.tsx` (1 fetch).
14. `pages/ordonnances/imprimer.tsx` (3 fetch).
15. `pages/certificats/index.tsx` (4 fetch).
16. `components/AnesthesieSection.tsx` (3 fetch).
17. `components/PatientTimeline.tsx` (2 fetch) — déjà via `__unwrapEnvelope`.
18. `components/DicteeOrdonnanceDialog.tsx` (1 fetch).
19. `components/CommandPalette.tsx` (1 fetch).
20. `pages/patients/detail.tsx` (2 fetch).
21. `pages/consultations/detail.tsx` (10 fetch).

## Pattern à suivre pour chaque fichier

- **GET simple** : `apiJson<Type>(url)` au lieu de `fetch(url).then(r=>r.json())`.
- **POST/PATCH/DELETE** : `apiJson<Type>(url, { method, headers:{...}, body: JSON.stringify(...) })`.
- **Gestion erreur spécifique** : `try { ... await apiJson(...) } catch (e) { ... }` —
  le message Error.message contient déjà le message backend parsé.
- **Les `mutationFn` dans useMutation** : remplacer directement par
  `mutationFn: (vars) => apiJson(...)` pour bénéficier du retry:0 + 401
  handler global.

## Sed script (attention, à relire fichier par fichier)

Pour accélérer la migration, pattern sed **indicatif** (ne pas appliquer
aveuglément) :

```bash
# Remplace les fetch().then(r=>r.json()) simples (GET) — relire chaque hit.
grep -rn 'fetch(.*).then(r.*json())' src/
```

Ne remplace **rien automatiquement** — le pattern varie (async/await,
destructuring, error handling). Migration manuelle conseillée par fichier.
