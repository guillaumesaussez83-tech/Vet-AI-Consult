# Workspace

## Overview

pnpm workspace monorepo using TypeScript — VetCare Pro, logiciel vétérinaire complet en français.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Clerk (with proxy middleware)
- **AI**: Anthropic Claude (`claude-sonnet-4-6`, max_tokens 8192) via `@workspace/integrations-anthropic-ai`
- **Object Storage**: Replit App Storage (GCS-backed presigned URL uploads)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Modules complets (8 modules ajoutés)

1. **Vaccinations** (`/patients/:id/vaccinations`) — timeline par patient, alertes rappel, bilan IA
2. **Stock médicaments** (`/stock`) — gestion CRUD, alertes rupture/expiration, mouvements
3. **Statistiques** (`/statistiques`) — CA, consultations, recharts AreaChart+BarChart, top actes, par veto
4. **Agenda** (`/agenda`) — calendrier semaine, RDV CRUD, click sur créneau, dialogues
5. **Certificats** (`/certificats`) — 5 types, génération Claude AI, aperçu + impression
6. **Protocole anesthésie** — section collapsible dans chaque consultation, génération IA
7. **Portail client** (`/portail/:token`) — accès public par token, vaccinations, dernier RDV
8. **DB tables** — vaccinations, stock_medicaments, rendez_vous, anesthesie_protocoles, portail_tokens

## AI Endpoints (POST /api/ai/...)

- `diagnostic` — diagnostic différentiel standard (texte uniquement)
- `diagnostic-enrichi` — diagnostic IA avec vision (images JPG/PNG + PDFs via GCS objectPaths)
- `reformuler-anamnese` — reformule transcript vocal en anamnèse structurée
- `structurer-examen-clinique` — structure transcript vocal en examen clinique médical
- `resume-client` — génère résumé vulgarisé pour propriétaire (non-médical, bienveillant)
- `generer-facture-voix` — extrait actes de facturation depuis transcript vocal, match DB actes
- `certificat` — génère certificat vétérinaire officiel (5 types) avec données patient
- `carnet-vaccinations` — bilan vaccinal IA depuis historique vaccinations

## Backend Routes

- `GET/POST/PATCH/DELETE /api/vaccinations` — carnet vaccinal par patient
- `GET/POST/PATCH/DELETE /api/stock` + `PATCH /api/stock/:id/mouvement` — stock médicaments
- `GET/POST/PATCH/DELETE /api/rendez-vous` — agenda avec filtres date/vet, join patient+owner
- `GET/POST /api/anesthesie` + `/api/anesthesie/generer-ia` — protocoles anesthésie par consultation
- `GET /api/portail/:token` + `POST /api/portail/generate/:ownerId` — portail public client
- `GET /api/statistiques` — KPIs, mensuel 12 mois, top actes, par vétérinaire

## File Upload Architecture

- Frontend → `POST /api/storage/uploads/request-url` (JSON metadata) → presigned GCS URL
- Frontend → `PUT <presigned-url>` (file bytes, direct to GCS)
- Backend serves files via `GET /api/storage/objects/*`
- For enriched diagnostic: objectPaths sent to `diagnostic-enrichi`, server fetches from GCS, encodes base64, sends to Claude with image/document content blocks

## Voice Dictation (useSpeechRecognition hook)

- `fr-FR` continuous mode, Web Speech API
- Exports: `isListening`, `isSupported`, `transcript`, `liveText`, `fullText`, `startListening`, `stopListening`, `resetTranscript`
- Used in: Step 2 Anamnèse (nouvelle.tsx), Step 3 Examen clinique (nouvelle.tsx), Facturation (detail.tsx)

## Key Files

- `artifacts/vetcare/src/pages/consultations/nouvelle.tsx` — wizard 5 étapes avec dictée vocale, upload fichiers, diagnostic enrichi, résumé client, PatientBarre
- `artifacts/vetcare/src/pages/consultations/detail.tsx` — détail consultation avec dictée vocale facturation, PatientBarre
- `artifacts/vetcare/src/components/PatientBarre.tsx` — barre patient (photo, nom, espèce, race, âge calculé, poids, sexe, stérilisé)
- `artifacts/vetcare/src/hooks/useSpeechRecognition.ts` — hook dictée vocale fr-FR
- `artifacts/api-server/src/routes/ai/index.ts` — 8 endpoints IA Claude (+ certificat + carnet-vaccinations)
- `artifacts/api-server/src/routes/statistiques/index.ts` — KPIs + monthly + top actes + par vet
- `artifacts/api-server/src/routes/vaccinations/index.ts` — CRUD carnet vaccinal
- `artifacts/api-server/src/routes/stock/index.ts` — CRUD stock + mouvements
- `artifacts/api-server/src/routes/rendez-vous/index.ts` — CRUD agenda + join patient/owner
- `artifacts/api-server/src/routes/anesthesie/index.ts` — CRUD protocoles + génération IA
- `artifacts/api-server/src/routes/portail/index.ts` — portail public token-based
- `artifacts/api-server/src/routes/storage.ts` — upload presigned URLs + serving GCS objects
- `artifacts/api-server/src/lib/objectStorage.ts` — ObjectStorageService (GCS wrapper)
- `artifacts/vetcare/src/components/AnesthesieSection.tsx` — section collapsible protocole anesthésie
- `artifacts/vetcare/src/pages/statistiques/index.tsx` — dashboard recharts
- `artifacts/vetcare/src/pages/stock/index.tsx` — gestion stock médicaments
- `artifacts/vetcare/src/pages/vaccinations/index.tsx` — carnet vaccinations par patient
- `artifacts/vetcare/src/pages/agenda/index.tsx` — calendrier semaine interactif
- `artifacts/vetcare/src/pages/certificats/index.tsx` — générateur certificats IA
- `artifacts/vetcare/src/pages/portail/index.tsx` — portail public propriétaire (sans auth)
