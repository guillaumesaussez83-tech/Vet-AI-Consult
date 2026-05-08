-- migrations/phase4-analytics-groupe.sql
-- Phase 4 — Analytics & Architecture Groupe
-- À exécuter via psql ou Railway DB console

BEGIN;

-- ============================================
-- 1. GROUPES DE CLINIQUES
-- ============================================
CREATE TABLE IF NOT EXISTS clinic_groups (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  owner_id    TEXT NOT NULL,
  description TEXT,
  logo_url    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. CLINIQUES
-- ============================================
CREATE TABLE IF NOT EXISTS clinics (
  id           TEXT PRIMARY KEY,  -- Clerk orgId ou UUID court
  name         TEXT NOT NULL,
  address      TEXT,
  city         TEXT,
  postal_code  TEXT,
  phone        TEXT,
  email        TEXT,
  siret        TEXT,
  ordre_vet    TEXT,
  group_id     INTEGER REFERENCES clinic_groups(id),
  plan         TEXT NOT NULL DEFAULT 'starter',
  max_users    INTEGER NOT NULL DEFAULT 5,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  logo_url     TEXT,
  timezone     TEXT NOT NULL DEFAULT 'Europe/Paris',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_clinics_group_id ON clinics(group_id) WHERE deleted_at IS NULL;

-- ============================================
-- 3. UTILISATEURS <-> CLINIQUES (multi-rôles)
-- ============================================
CREATE TABLE IF NOT EXISTS clinic_users (
  id         SERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL,
  clinic_id  TEXT NOT NULL REFERENCES clinics(id),
  role       TEXT NOT NULL DEFAULT 'VETERINAIRE',
  -- VETERINAIRE | ASSISTANT | DIRECTION_CLINIQUE | DIRECTION_GROUPE | ADMIN
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, clinic_id)
);

CREATE INDEX IF NOT EXISTS idx_clinic_users_user ON clinic_users(user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_clinic_users_clinic ON clinic_users(clinic_id) WHERE is_active = TRUE;

-- ============================================
-- 4. SNAPSHOTS ANALYTICS QUOTIDIENS
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id                          SERIAL PRIMARY KEY,
  clinic_id                   TEXT NOT NULL,
  snapshot_date               DATE NOT NULL,

  -- Chiffre d'affaires
  ca_ttc_jour                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  ca_ttc_mois                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  ca_ttc_an                   NUMERIC(12,2) NOT NULL DEFAULT 0,
  ca_ht_jour                  NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Consultations
  nb_consultations            INTEGER NOT NULL DEFAULT 0,
  nb_consultations_terminees  INTEGER NOT NULL DEFAULT 0,
  nb_consultations_ia         INTEGER NOT NULL DEFAULT 0,
  duree_moyenne_min           INTEGER DEFAULT 0,

  -- Patients
  nb_nouveaux_patients        INTEGER NOT NULL DEFAULT 0,
  nb_patients_actifs          INTEGER NOT NULL DEFAULT 0,
  nb_patients_inactifs        INTEGER NOT NULL DEFAULT 0,

  -- Facturation
  nb_factures                 INTEGER NOT NULL DEFAULT 0,
  nb_factures_payees          INTEGER NOT NULL DEFAULT 0,
  nb_factures_impayees        INTEGER NOT NULL DEFAULT 0,
  montant_impaye_ttc          NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Agenda
  nb_rdv_programmes           INTEGER NOT NULL DEFAULT 0,
  nb_rdv_honores              INTEGER NOT NULL DEFAULT 0,
  nb_no_show                  INTEGER NOT NULL DEFAULT 0,
  taux_no_show                NUMERIC(5,2) NOT NULL DEFAULT 0,

  -- Stock
  nb_alerte_stock             INTEGER NOT NULL DEFAULT 0,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(clinic_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_clinic_date
  ON analytics_snapshots(clinic_id, snapshot_date DESC);

-- ============================================
-- 5. PRÉVISIONS CA (IA)
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_forecasts (
  id                   SERIAL PRIMARY KEY,
  clinic_id            TEXT NOT NULL,
  forecast_month       CHAR(7) NOT NULL,  -- YYYY-MM
  ca_forecast_ttc      NUMERIC(12,2) NOT NULL DEFAULT 0,
  confidence_interval  NUMERIC(12,2) DEFAULT 0,
  methodology          TEXT NOT NULL DEFAULT 'linear_regression',
  data_points_used     INTEGER DEFAULT 12,
  generated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(clinic_id, forecast_month)
);

-- ============================================
-- 6. RAPPORTS MENSUELS PDF
-- ============================================
CREATE TABLE IF NOT EXISTS group_reports (
  id                 SERIAL PRIMARY KEY,
  clinic_id          TEXT NOT NULL,
  report_type        TEXT NOT NULL DEFAULT 'monthly',
  period_label       TEXT NOT NULL,
  period_start       DATE NOT NULL,
  period_end         DATE NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending',
  kpi_summary        JSONB,
  insights_text      TEXT,
  pdf_size_bytes     INTEGER,
  pdf_data           TEXT,      -- base64 pour petits rapports
  pdf_storage_path   TEXT,
  generated_by       TEXT,
  generated_at       TIMESTAMPTZ,
  error_message      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_reports_clinic
  ON group_reports(clinic_id, created_at DESC);

COMMIT;
