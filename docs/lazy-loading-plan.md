# Plan Lazy Loading — VetoAI Consult Frontend

## Contexte

Le frontend `artifacts/vetcare-frontend` est une SPA React/Vite.
Au démarrage, **tous les modules sont chargés en bundle unique** — ce qui pénalise le Time-to-Interactive
notamment sur les routes peu fréquentes (admin, facturation, AI chat).

Objectif : réduire le bundle initial de ~40 % en appliquant `React.lazy()` + `Suspense`
sur les routes lourdes, et en splittant les composants à chargement coûteux.

---

## État actuel

```
artifacts/vetcare-frontend/src/
├── App.tsx                    ← router principal — toutes les routes importées statiquement
├── pages/
│   ├── Dashboard.tsx          ~80 KB (inclut AiBudgetWidget, recharts)
│   ├── AiConsult.tsx          ~120 KB (CodeMirror, streaming, historique)
│   ├── Facturx.tsx            ~95 KB (PDF preview, form complexe)
│   ├── Patients.tsx           ~60 KB
│   ├── Appointments.tsx       ~45 KB
│   ├── Settings.tsx           ~30 KB
│   └── Login.tsx              ~15 KB  ← route critique, NE PAS lazy-loader
```

**Bundle initial estimé (avant) :** ~450 KB gzippé
**Cible (après) :** < 280 KB gzippé sur le chemin critique (Login → Dashboard)

---

## Priorités de lazy loading

| Priorité | Page / Composant | Taille estimée | Raison |
|----------|-----------------|----------------|--------|
| P0 | `AiConsult.tsx` | ~120 KB | CodeMirror + streaming = jamais au démarrage |
| P0 | `Facturx.tsx` | ~95 KB | PDF preview + génération = route secondaire |
| P1 | `Dashboard.tsx` recharts | ~45 KB | Graphiques = pas critiques au premier paint |
| P1 | `AiBudgetWidget.tsx` | ~30 KB | Widget chargé dans Dashboard — peut être différé |
| P2 | `Patients.tsx` | ~60 KB | Route fréquente mais non critique au boot |
| P2 | `Appointments.tsx` | ~45 KB | Idem |
| P3 | `Settings.tsx` | ~30 KB | Route très peu fréquente |

**Ne pas lazy-loader :** `Login.tsx`, `AuthGuard`, `Layout`, providers globaux.

---

## Implémentation

### 1. Lazy loading des routes (App.tsx)

```tsx
// artifacts/vetcare-frontend/src/App.tsx
import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';       // critique — import statique
import Layout from './components/Layout'; // critique — import statique
import PageLoader from './components/PageLoader'; // spinner léger

// Routes lazy-loadées
const Dashboard    = lazy(() => import('./pages/Dashboard'));
const AiConsult    = lazy(() => import('./pages/AiConsult'));
const Facturx      = lazy(() => import('./pages/Facturx'));
const Patients     = lazy(() => import('./pages/Patients'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Settings     = lazy(() => import('./pages/Settings'));

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/"            element={<Dashboard />} />
          <Route path="/ai"          element={<AiConsult />} />
          <Route path="/facturx"     element={<Facturx />} />
          <Route path="/patients"    element={<Patients />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/settings"    element={<Settings />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
```

### 2. Composant PageLoader

```tsx
// artifacts/vetcare-frontend/src/components/PageLoader.tsx
export default function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}
```

### 3. Lazy loading intra-composant (Dashboard)

AiBudgetWidget est importé dans Dashboard mais non visible au premier paint :

```tsx
// artifacts/vetcare-frontend/src/pages/Dashboard.tsx
const AiBudgetWidget = lazy(() => import('../components/AiBudgetWidget'));
const RevenueChart   = lazy(() => import('../components/RevenueChart'));

// Dans le JSX :
<Suspense fallback={<div className="h-48 animate-pulse bg-gray-100 rounded" />}>
  <AiBudgetWidget clinicId={clinicId} />
</Suspense>
```

### 4. Prefetch sur hover (optionnel, Sprint 5+)

```tsx
// Prefetch AiConsult quand l'utilisateur survole le lien nav
const prefetchAiConsult = () => import('./pages/AiConsult');

<NavLink to="/ai" onMouseEnter={prefetchAiConsult}>
  AI Consult
</NavLink>
```

---

## Configuration Vite (vérification)

```ts
// vite.config.ts — s'assurer que le code splitting est actif
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Isoler les libs lourdes dans leurs propres chunks
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-editor': ['@codemirror/state', '@codemirror/view'],
        },
      },
    },
  },
});
```

---

## Mesure de la progression

```bash
# Avant
pnpm --filter vetcare-frontend build 2>&1 | grep "kB"

# Analyser la composition des chunks
npx vite-bundle-visualizer --outFile dist/bundle-report.html
```

| Métrique | Avant | Cible Sprint 4 | Cible Sprint 6 |
|----------|-------|----------------|----------------|
| Bundle initial (gzip) | ~450 KB | < 300 KB | < 200 KB |
| Time-to-Interactive | ~3.2 s | < 2.0 s | < 1.5 s |
| Chunks lazy > 30 KB | 0 | 4 | 7 |

---

## Ordre d'exécution recommandé

1. **Sprint 4** — `App.tsx` : lazy toutes les routes sauf Login/Layout
2. **Sprint 4** — `Dashboard.tsx` : lazy AiBudgetWidget + RevenueChart
3. **Sprint 4** — `vite.config.ts` : manualChunks vendor
4. **Sprint 5** — `AiConsult.tsx` : lazy CodeMirror (import dynamique interne)
5. **Sprint 5** — Prefetch sur hover pour les routes fréquentes
6. **Sprint 6** — Mesures finales + ajustements

---

## Notes

- `Suspense` doit envelopper **chaque** zone lazy indépendamment pour éviter qu'un seul
  composant lent bloque tout l'arbre.
- Les `ErrorBoundary` doivent envelopper les `Suspense` pour capturer les erreurs réseau
  lors du chargement des chunks.
- Ne pas lazy-loader les providers globaux (ClerkProvider, QueryClientProvider) — ils
  doivent être disponibles avant le rendu des routes.
