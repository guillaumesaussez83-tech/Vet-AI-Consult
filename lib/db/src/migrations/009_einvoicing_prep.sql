-- ============================================================
-- Migration 009 — Préparation Facturation Électronique (Factur-X EN16931 / BASIC)
-- VetoAI — Sprint e-invoicing Phase 1
-- ============================================================
-- Tous les nouveaux champs sont NULLABLE ou ont une valeur DEFAULT.
-- Aucune donnée existante n'est modifiée hormis les backfill ci-dessous.
-- ============================================================

BEGIN;

-- ── 1. Table clinics ──────────────────────────────────────────────────────────
-- BG-4 Seller — informations légales et bancaires du vendeur

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS siren              VARCHAR(9),
  ADD COLUMN IF NOT EXISTS tva_intra          VARCHAR(13),
  ADD COLUMN IF NOT EXISTS rcs_ville          TEXT,
  ADD COLUMN IF NOT EXISTS rcs_numero         TEXT,
  ADD COLUMN IF NOT EXISTS forme_juridique    TEXT,
  ADD COLUMN IF NOT EXISTS code_naf           VARCHAR(5)  DEFAULT '8520Z',
  ADD COLUMN IF NOT EXISTS iban               TEXT,
  ADD COLUMN IF NOT EXISTS bic                VARCHAR(11),
  ADD COLUMN IF NOT EXISTS nom_compte_bancaire TEXT,
  ADD COLUMN IF NOT EXISTS pays_iso2          VARCHAR(2)  DEFAULT 'FR';

COMMENT ON COLUMN clinics.siren IS 'SIREN 9 chiffres — BT-30 Factur-X';
COMMENT ON COLUMN clinics.tva_intra IS 'N° TVA intracommunautaire, ex FR12345678901 — BT-31';
COMMENT ON COLUMN clinics.rcs_ville IS 'Ville du greffe RCS, ex "Paris"';
COMMENT ON COLUMN clinics.rcs_numero IS 'Numéro RCS complet, ex "RCS Paris 123 456 789"';
COMMENT ON COLUMN clinics.forme_juridique IS 'SELARL | SARL | SCP | EURL | SASU | SAS | EARL';
COMMENT ON COLUMN clinics.code_naf IS 'Code APE/NAF INSEE, défaut 8520Z (activités vétérinaires)';
COMMENT ON COLUMN clinics.iban IS 'IBAN compte bancaire pour BT-84 (modalités paiement Factur-X)';
COMMENT ON COLUMN clinics.bic IS 'BIC/SWIFT banque';
COMMENT ON COLUMN clinics.nom_compte_bancaire IS 'Titulaire du compte bancaire';
COMMENT ON COLUMN clinics.pays_iso2 IS 'Code pays ISO 3166-1 alpha-2 — BT-40, défaut FR';

UPDATE clinics SET
  code_naf   = COALESCE(code_naf, '8520Z'),
  pays_iso2  = COALESCE(pays_iso2, 'FR')
WHERE code_naf IS NULL OR pays_iso2 IS NULL;

-- ── 2. Table owners ───────────────────────────────────────────────────────────
-- BG-7 Buyer — support B2C (particuliers) et B2B (élevages, entreprises)

ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS type_client            TEXT DEFAULT 'particulier',
  ADD COLUMN IF NOT EXISTS siren                  VARCHAR(9),
  ADD COLUMN IF NOT EXISTS siret                  VARCHAR(14),
  ADD COLUMN IF NOT EXISTS tva_intra              VARCHAR(13),
  ADD COLUMN IF NOT EXISTS raison_sociale         TEXT,
  ADD COLUMN IF NOT EXISTS code_service_executant TEXT,
  ADD COLUMN IF NOT EXISTS pays_iso2              VARCHAR(2) DEFAULT 'FR';

COMMENT ON COLUMN owners.type_client IS 'particulier | entreprise — détermine logique facturation B2C vs B2B';
COMMENT ON COLUMN owners.siren IS 'SIREN acheteur, requis si type_client=entreprise — BT-46';
COMMENT ON COLUMN owners.siret IS 'SIRET acheteur 14 chiffres — BT-46';
COMMENT ON COLUMN owners.tva_intra IS 'TVA intracommunautaire acheteur — BT-48';
COMMENT ON COLUMN owners.raison_sociale IS 'Dénomination sociale pour B2B — BT-44';
COMMENT ON COLUMN owners.code_service_executant IS 'Code service pour B2G (admin publique) — BT-49';
COMMENT ON COLUMN owners.pays_iso2 IS 'Code pays ISO 3166-1 — BT-55, défaut FR';

UPDATE owners SET
  type_client = COALESCE(type_client, 'particulier'),
  pays_iso2   = COALESCE(pays_iso2, 'FR')
WHERE type_client IS NULL OR pays_iso2 IS NULL;

-- ── 3. Table factures ─────────────────────────────────────────────────────────
-- BG-2 Invoice header — champs Factur-X manquants

ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS code_type_document          VARCHAR(3)  DEFAULT '380',
  ADD COLUMN IF NOT EXISTS date_echeance               TEXT,
  ADD COLUMN IF NOT EXISTS reference_facture_precedente TEXT,
  ADD COLUMN IF NOT EXISTS reference_acheteur          TEXT,
  ADD COLUMN IF NOT EXISTS note_facture                TEXT,
  ADD COLUMN IF NOT EXISTS mode_paiement_code          VARCHAR(2),
  ADD COLUMN IF NOT EXISTS mention_loi                 TEXT,
  ADD COLUMN IF NOT EXISTS currency_iso                VARCHAR(3)  DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS statut_einvoice             TEXT        DEFAULT 'draft';

COMMENT ON COLUMN factures.code_type_document IS '380=facture, 381=avoir, 386=acompte, 384=rectificative — BT-3';
COMMENT ON COLUMN factures.date_echeance IS 'Date limite de paiement — BT-9';
COMMENT ON COLUMN factures.reference_facture_precedente IS 'N° facture corrigée pour avoirs/rectificatives — BT-25';
COMMENT ON COLUMN factures.reference_acheteur IS 'N° bon de commande client — BT-10';
COMMENT ON COLUMN factures.note_facture IS 'Note libre visible sur la facture — BT-22';
COMMENT ON COLUMN factures.mode_paiement_code IS 'Code UN/CEFACT: 10=espèces, 30=virement, 48=CB, 49=SEPA, 97=chèque — BT-81';
COMMENT ON COLUMN factures.mention_loi IS 'Mention légale délais de paiement et pénalités (Art. L441-6 C.com)';
COMMENT ON COLUMN factures.currency_iso IS 'Code devise ISO 4217 — BT-5, défaut EUR';
COMMENT ON COLUMN factures.statut_einvoice IS 'Workflow PDP: draft|to_be_sent|sent|received|accepted|refused|paid';

UPDATE factures SET
  code_type_document = COALESCE(code_type_document, '380'),
  currency_iso       = COALESCE(currency_iso, 'EUR'),
  statut_einvoice    = COALESCE(statut_einvoice, 'draft')
WHERE code_type_document IS NULL OR currency_iso IS NULL OR statut_einvoice IS NULL;

UPDATE factures SET
  mention_loi = 'En cas de retard de paiement, des pénalités de retard au taux de 3 fois le taux légal seront appliquées, ainsi qu''une indemnité forfaitaire pour frais de recouvrement de 40 €.'
WHERE mention_loi IS NULL;

UPDATE factures SET mode_paiement_code =
  CASE
    WHEN LOWER(mode_paiement) IN ('especes', 'espèces', 'cash') THEN '10'
    WHEN LOWER(mode_paiement) IN ('virement', 'virement bancaire') THEN '30'
    WHEN LOWER(mode_paiement) IN ('cb', 'carte', 'carte bancaire', 'carte bleue') THEN '48'
    WHEN LOWER(mode_paiement) IN ('sepa', 'prelevement', 'prélèvement') THEN '49'
    WHEN LOWER(mode_paiement) IN ('cheque', 'chèque') THEN '97'
    ELSE NULL
  END
WHERE mode_paiement IS NOT NULL AND mode_paiement_code IS NULL;

-- ── 4. Table actes_consultations (= lignes de facture) ────────────────────────
-- BG-25 Invoice Line — champs Factur-X manquants

ALTER TABLE actes_consultations
  ADD COLUMN IF NOT EXISTS code_article       TEXT,
  ADD COLUMN IF NOT EXISTS unite_mesure_code  VARCHAR(3) DEFAULT 'PCE',
  ADD COLUMN IF NOT EXISTS date_realisation   TEXT,
  ADD COLUMN IF NOT EXISTS code_tva           VARCHAR(2) DEFAULT 'S',
  ADD COLUMN IF NOT EXISTS montant_ligne_ht   REAL;

COMMENT ON COLUMN actes_consultations.code_article IS 'Référence article interne ou GTIN — BT-155';
COMMENT ON COLUMN actes_consultations.unite_mesure_code IS 'UN/CEFACT: PCE=pièce, H87=unité, KGM=kg, LTR=litre, MIN=minute — BT-130';
COMMENT ON COLUMN actes_consultations.date_realisation IS 'Date de la prestation si différente de la date facture — BT-134';
COMMENT ON COLUMN actes_consultations.code_tva IS 'Catégorie TVA: S=standard, AA=réduit, E=exonéré, Z=taux 0 — BT-151';
COMMENT ON COLUMN actes_consultations.montant_ligne_ht IS 'Montant HT calculé (quantite × prix_unitaire) — BT-131';

UPDATE actes_consultations SET
  unite_mesure_code = COALESCE(unite_mesure_code, 'PCE'),
  code_tva          = COALESCE(code_tva, 'S'),
  montant_ligne_ht  = COALESCE(montant_ligne_ht, quantite * prix_unitaire)
WHERE unite_mesure_code IS NULL OR code_tva IS NULL OR montant_ligne_ht IS NULL;

UPDATE actes_consultations ac
SET code_article = a.code
FROM actes a
WHERE ac.acte_id = a.id
  AND ac.code_article IS NULL;

-- ── 5. Index supplémentaires ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_owners_type_client ON owners(type_client);
CREATE INDEX IF NOT EXISTS idx_owners_siret ON owners(siret) WHERE siret IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_factures_statut_einvoice ON factures(statut_einvoice);
CREATE INDEX IF NOT EXISTS idx_factures_code_type_document ON factures(code_type_document);

-- ── 6. Contrainte CHECK type_client ──────────────────────────────────────────
ALTER TABLE owners
  DROP CONSTRAINT IF EXISTS chk_owners_type_client;
ALTER TABLE owners
  ADD CONSTRAINT chk_owners_type_client
  CHECK (type_client IN ('particulier', 'entreprise'));

-- ── 7. Contrainte CHECK code_type_document ───────────────────────────────────
ALTER TABLE factures
  DROP CONSTRAINT IF EXISTS chk_factures_code_type_document;
ALTER TABLE factures
  ADD CONSTRAINT chk_factures_code_type_document
  CHECK (code_type_document IN ('380', '381', '384', '386'));

-- ── 8. Contrainte CHECK statut_einvoice ──────────────────────────────────────
ALTER TABLE factures
  DROP CONSTRAINT IF EXISTS chk_factures_statut_einvoice;
ALTER TABLE factures
  ADD CONSTRAINT chk_factures_statut_einvoice
  CHECK (statut_einvoice IN ('draft', 'to_be_sent', 'sent', 'received', 'accepted', 'refused', 'paid'));

COMMIT;

-- ✅ Migration 009 — e-invoicing Factur-X EN16931 préparation terminée
-- Tables modifiées: clinics, owners, factures, actes_consultations
-- Champs ajoutés: 29 colonnes
