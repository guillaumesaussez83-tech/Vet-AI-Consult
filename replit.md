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

## AI Endpoints (POST /api/ai/...)

- `diagnostic` — diagnostic différentiel standard (texte uniquement)
- `diagnostic-enrichi` — diagnostic IA avec vision (images JPG/PNG + PDFs via GCS objectPaths)
- `reformuler-anamnese` — reformule transcript vocal en anamnèse structurée
- `structurer-examen-clinique` — structure transcript vocal en examen clinique médical
- `resume-client` — génère résumé vulgarisé pour propriétaire (non-médical, bienveillant)
- `generer-facture-voix` — extrait actes de facturation depuis transcript vocal, match DB actes

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
- `artifacts/api-server/src/routes/ai/index.ts` — 6 endpoints IA Claude
- `artifacts/api-server/src/routes/storage.ts` — upload presigned URLs + serving GCS objects
- `artifacts/api-server/src/lib/objectStorage.ts` — ObjectStorageService (GCS wrapper)
