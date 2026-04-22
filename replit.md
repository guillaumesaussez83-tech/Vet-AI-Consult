# Workspace

## Overview

pnpm workspace monorepo using TypeScript — **VétoAI**, logiciel vétérinaire SaaS complet en français.

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

## Quality Sprint (completé)

- TypeScript: 0 erreurs (réduit de 60 → 0) dans `artifacts/vetcare`
- `tvaRate` ajouté à la table `actes` (DB + schéma + types générés)
- `Acte.tvaRate` et `CreateActeBody.tvaRate` ajoutés aux types API générés
- `useListPatients()` corrigé : retourne `PatientWithOwner[]` directement (pas `{ patients: [...] }`)
- `ListPatientsParams` : paramètre `limit` supprimé (non supporté par le backend)
- `FactureWithDetails.lignes` et `montantTVA` : accès via cast type-safe
- `queryKey` requis ajouté dans `useGetFacture` et `useListPatientConsultations`
- `api-client-react` dist/ rebuildet après chaque changement de schéma
- Colonne `code` auto-générée lors de la création d'un acte

## Modules complets (12 modules ajoutés)

1. **Vaccinations** (`/patients/:id/vaccinations`) — timeline par patient, alertes rappel, bilan IA
2. **Stock médicaments** (`/stock`) — gestion CRUD Phase 2 : alertes rupture/expiration, mouvements, lots FEFO, commandes CENTRAVET, réception BL, IA (ADC+EOQ+safety stock), anomalies, export TransNet CSV
3. **Statistiques** (`/statistiques`) — CA, consultations, recharts AreaChart+BarChart, top actes, par veto
4. **Agenda multi-vétérinaire** (`/agenda`) — 3 onglets : Agenda (grille semaine multi-vet avec colonnes colorées par vétérinaire, RDV cliquables, création rapide par clic), Planning (calendrier mensuel par vétérinaire, exceptions), Configuration (CRUD vétérinaires, planning type par jour, rotations weekend automatiques). Engine de créneaux disponibles (planning type + exceptions + rotations + chevauchements RDV)
5. **Certificats** (`/certificats`) — 5 types, génération Claude AI, aperçu + impression
6. **Protocole anesthésie** — section collapsible dans chaque consultation, génération IA
7. **Portail client** (`/portail/:token`) — accès public par token, vaccinations, dernier RDV
8. **Ordonnances** (`/ordonnances`) — prescriptions IA depuis consultation, vue liste + impression, mise en page professionnelle avec en-tête clinique, zone signature
9. **Paramètres clinique** (`/parametres`) — formulaire complet : nom, adresse, SIRET, N° Ordre vétérinaire, TVA, horaires, mentions légales — données utilisées dans ordonnances et factures
10. **Intégration FEFO→Facture** — décrément automatique du stock (FEFO par lot) quand une facture est marquée comme payée (hook dans `PATCH /api/factures/:id`)
11. **DB tables** — vaccinations, stock_medicaments, rendez_vous, anesthesie_protocoles, portail_tokens + stock phase 2 (commandes_centravet, bons_livraison, stock_lots, mouvements_stock, lignes_commande, alertes_stock) + ordonnances + parametres_clinique (21 tables total)
12. **Salle d'attente** (`/salle-attente`) — tableau kanban plein écran avec 5 colonnes (en_attente_arrivee→arrive→en_consultation→a_encaisser→termine), drag & drop natif HTML5, boutons flèches, badge temps d'attente amber/rouge (>15min/>30min), auto-refresh 30s, horloge live, résumé en-tête, colonne `statut_salle` dans `rendez_vous`, route API GET `/salle-attente` + PATCH `/:id/statut-salle`, optimistic updates

## Sprint Refactoring Senior-Grade — completé

### BLOC 2 — Validation Zod middleware
- `artifacts/api-server/src/middlewares/validate.ts` — `validate(schema)` + `validateQuery(schema)` génériques
- Retourne 400 avec `details: fieldErrors` Zod si invalide
- Prêt à appliquer sur tous les `POST/PUT` handlers

### BLOC 3 — Error handling robuste
- `artifacts/api-server/src/middlewares/errorHandler.ts` — hiérarchie AppError : `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ValidationError`, `ConflictError`
- `artifacts/api-server/src/middlewares/asyncWrapper.ts` — `asyncHandler(fn)` wrapper pour éviter try/catch répétitifs
- Gestion Postgres 23505 (duplicate) et 23503 (foreign key) automatique
- Ajouté dans `app.ts` en dernier middleware

### BLOC 4 — Sécurité & Performance
- `express-rate-limit` installé : `apiLimiter` (300 req/15min) sur `/api/*`, `aiLimiter` (15 req/min) sur `/api/ai/*`
- `helmet` installé : headers HTTP sécurisés (CSP désactivé pour compatibilité Clerk)
- `artifacts/api-server/src/middlewares/rateLimiter.ts`

### BLOC 5 — Service layer
- `artifacts/api-server/src/services/factureService.ts` — `FactureService` : recalcul montants, génération numéro, validation paiement, vérif existence
- `artifacts/api-server/src/services/stockService.ts` — `StockService` : vérif disponibilité, création mouvement (transactionnel), alerte seuil

### BLOC 7 — Frontend error handling
- `artifacts/vetcare/src/hooks/useApiMutation.ts` — `useApiMutation<TData, TError, TVariables, TContext>` wrapper `useMutation` avec toast automatique succès/erreur

### BLOC 8 — Config typée
- `artifacts/api-server/src/config.ts` — Zod env schema, `process.exit(1)` si variable manquante au démarrage

### TypeScript
- `0 erreurs` après typecheck complet frontend (`pnpm run typecheck`)
- Corrigé `DicteeOrdonnanceDialog.tsx` (consultationId hors scope)
- Corrigé `factures/detail.tsx` (modePaiement via facAny)

## Mega Sprint (Bloc 1-6) — completé

### Bloc 2 — Modes de paiement + Rendu monnaie espèces
- `montantEspecesRecu` ajouté à la table `factures` (DB + schéma)
- PATCH factures : validation mode paiement, calcul + retour `renduMonnaie` côté serveur
- Frontend detail.tsx : champ "Montant reçu" si mode espèces, affichage rendu en temps réel + confirmé

### Bloc 3 — Dictée ordonnance IA (T008)
- `POST /api/ai/dictee-ordonnance` : Claude extrait prescriptions depuis transcript (JSON), stock matching ILIKE
- `POST /api/ai/confirmer-dictee-ordonnance` : crée ordonnance ORD-YYYY-NNNNN, décrémente stock
- Wizard consultation step 5 : bouton "Dicter l'ordonnance", dialog 3 phases (dictée→analyse→récap)
- Flux différé : prescriptions stockées en state, créées en DB au submit consultation

### Bloc 4 — RGPD (T006)
- Page `/confidentialite` statique (sans auth)
- Checkbox consentement RGPD dans formulaire patient
- Modal disclaimer IA (localStorage), mentions obligatoires sur résultats IA

### Bloc 5 — Stupéfiants (T007 + table officielle)
- Table `registre_stupefiants` (entree/sortie, N° lot, solde courant)
- `POST /api/stock/stupefiants/entree` — avec validation stupéfiant, calcul solde courant
- `POST /api/stock/stupefiants/sortie` — obligatoire : numeroLot + animalId + veterinaire (400 sinon)
- `GET /api/stock/stupefiants/registre?produitId=` — tableau avec join patient
- Page `/stupefiants` dédiée avec tableau chronologique, filtre par produit, dialogs entrée/sortie

### Bloc 6 — Branding VétoAI
- Composant `Logo.tsx` SVG inline (croix vétérinaire bleue + "AI" vert)
- Palette couleurs officielle : `--primary: 210 55% 40%` (bleu médical), `--secondary: 145 63%` (vert santé)
- Sidebar : fond `210 57% 23%` (bleu nuit professionnel), texte blanc
- Logo affiché dans sidebar desktop + mobile header + sheet mobile
- Favicon SVG mis à jour (croix bleue + AI vert)
- Lien "Stupéfiants" ajouté au menu navigation

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
- `GET /api/agenda/veterinaires` — vétérinaires actifs (couleur, initiales)
- `POST /api/agenda/veterinaires` + `PUT /:id` + `DELETE /:id` — CRUD vétérinaires
- `GET /api/agenda/slots/:vetId/:date` — créneaux disponibles pour un vétérinaire (planning type + exceptions + rotations + chevauchements)
- `GET /api/agenda/slots/multi/:date` — créneaux pour tous les vétérinaires d'un jour
- `GET /api/agenda/rendez-vous/semaine/:dateDebut` — RDV de la semaine avec join vet+patient+owner
- `GET /api/agenda/planning/mois/:annee/:mois` — vue mensuelle (travaille/nbRdv/exception/garde)
- `POST /api/agenda/rendez-vous` — créer RDV avec validation créneau (409 si pris + prochains disponibles)
- `PUT /api/agenda/rendez-vous/:id` + `/statut-salle` — mise à jour RDV ou statut salle
- `GET/POST /api/agenda/planning/semaine-type/:vetId` — planning type hebdomadaire (upsert)
- `POST/DELETE /api/agenda/planning/exception` — exceptions (congé/maladie/formation/garde/fermeture)
- `POST /api/agenda/rotations/generer` — génération rotations weekend équitables (aperçu + confirmation)
- `GET /api/agenda/prochain-creneau?vetId=` — prochain créneau disponible
- `GET/POST /api/anesthesie` + `/api/anesthesie/generer-ia` — protocoles anesthésie par consultation
- `GET /api/portail/:token` + `POST /api/portail/generate/:ownerId` — portail public client
- `GET /api/statistiques` — KPIs, mensuel 12 mois, top actes, par vétérinaire
- `GET/POST/PATCH/DELETE /api/ordonnances` + `POST /api/ordonnances/ia/generer` — prescriptions IA Claude
- `GET/PUT /api/parametres-clinique` — paramètres clinique (SIRET, RPPS, adresse, horaires)
- Stock Phase 2 : 16+ routes commandes CENTRAVET, réception BL, alertes, mouvements FEFO, export TransNet CSV

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
- `artifacts/vetcare/src/pages/agenda/index.tsx` — agenda multi-vet 3 onglets (WeekGrid, PlanningTab, ConfigTab)
- `artifacts/api-server/src/routes/agenda/index.ts` — engine créneaux + toutes routes agenda
- `lib/db/src/schema/veterinaires.ts` — table veterinaires (UUID, couleur, initiales)
- `lib/db/src/schema/planning-semaine-type.ts` — planning hebdomadaire type par vétérinaire/jour
- `lib/db/src/schema/exceptions-planning.ts` — congés/exceptions par vétérinaire
- `lib/db/src/schema/rotations-weekend.ts` — rotations gardes weekend
- `artifacts/vetcare/src/pages/certificats/index.tsx` — générateur certificats IA
- `artifacts/vetcare/src/pages/portail/index.tsx` — portail public propriétaire (sans auth)
- `artifacts/vetcare/src/components/DicteeOrdonnanceDialog.tsx` — dialog dictée vocale + IA parsing + récapitulatif stock
- `artifacts/vetcare/src/components/IaDisclaimerModal.tsx` — modal disclaimer IA (localStorage par user Clerk)
- `artifacts/vetcare/src/pages/confidentialite.tsx` — page RGPD complète
- `artifacts/vetcare/src/pages/stupefiants/index.tsx` — registre stupéfiants officiel

## Sprint T001-T008 Status (Avril 2026)

- **T001** Facture à zéro — FIXED: POST /:id/facture recalcule depuis actes si facture existante + arrondi .toFixed(2)
- **T002** DB Schema — COMPLETE: tous les champs existent (estStupefiant, numeroOrdonnance, consentementRgpd, ia_audit_log)
- **T003** Mode paiement UI — COMPLETE: 6 modes avec icônes (carte/NFC/espèces/chèque/virement/autre) + rendu monnaie live
- **T004** Branding VétoAI — COMPLETE: aucune trace VetCare Pro
- **T005** Ordonnance numérotation — COMPLETE: ORD-YYYY-NNNNN affiché sur PDF + backend séquentiel
- **T006** RGPD — COMPLETE: IaDisclaimerModal localStorage + /confidentialite page + consentementRgpd checkbox
- **T007** Stupéfiants — COMPLETE: badge STUPÉFIANT rouge dans table produits + auto-détection POST+PATCH + registre onglet
- **T008** Dictée ordonnance → stock — COMPLETE: DicteeOrdonnanceDialog câblé dans Step5 + /confirmer-dictee-ordonnance + mouvements stock

## Bugs Fixed

- Kétamine/Butorphanol: estStupefiant=true en DB + detectStupefiants() auto-detection POST/PATCH stock
- Salle d'attente timezone: formatTime + elapsedMinutes avec Z-normalization Europe/Paris
- Dashboard CA "—": valeurs null traitées correctement
- Statistiques KPI: 0 != null (traité comme valeur valide)
- Agenda "Sans nom": affiche motif ou "RDV libre"
- ISO dates: formatDateFR appliqué consultations + factures

## Multi-tenant Architecture (avril 2026)

- **Table racine**: `clinics(id text PK, slug unique, name, createdAt)` — seed `default`
- **Schéma**: 23 tables métier ont `clinicId text not null default 'default'` + index
- **Middleware**: `extractClinic.ts` lit `sessionClaims.public_metadata.clinic_id` (fallback `default`), monté après `clerkMiddleware` ; skip `/health`, `/healthz`, `/portail`
- **Type**: `Express.Request.clinicId` augmenté
- **Routes filtrées (T003)**: `patients`, `owners`, `consultations`, `factures`, `ordonnances`, `stock` (CRUD produits + commandes + alertes + mouvements + lots)
- **Numérotation par clinique**: `FACT-YYYY-NNNN` (factures), `ORD-YYYY-NNNNN` (ordonnances), `CMD-YYYYMM-NNNN` (commandes)

### TODO multi-tenant — routes restantes
À filtrer ultérieurement (16 routes) : `agenda`, `rappels`, `vaccinations`, `rendez-vous`, `statistiques`, `stupefiants`, `anesthesie`, `ai`, `certificats`, `encaissements`, `parametres-clinique`, `portail`, `search`, `dashboard`, `actes`, `storage`. Helpers globaux à scoper aussi : `stock/ia-engine.ts` (analyserConsommationTous, genererAlertes, decrementerConsultationFEFO, detecterAnomalies) et `stock/seeder.ts`.

### Hardening multi-tenant — fait après code review
- POST /api/patients : vérifie `ownerId ∈ clinicId` avant insert (anti-IDOR)
- POST /api/consultations : vérifie `patientId ∈ clinicId` avant insert (anti-IDOR)
- POST /api/ordonnances : vérifie `consultationId ∈ clinicId` avant insert (anti-IDOR)

### TODO sécurité multi-tenant — sprint suivant
- **Contraintes DB** : remplacer `unique()` global par `unique(clinicId, numero)` sur `factures.numero`, `ordonnances.numeroOrdonnance`, `commandes_centravet.numeroCommande` (sinon collision cross-tenant possible)
- **Fallback `default`** : durcir extractClinic — refuser plutôt que fallback `default` quand l'utilisateur est authentifié sans `public_metadata.clinic_id`
- **FK ownership restantes** : valider FK clinique sur autres routes POST (factures.consultationId, encaissements.factureId, mouvements stock.medicamentId, etc.)
- **Stock helpers globaux** : threading `clinicId` dans `ia-engine.ts` et `seeder.ts`
