-- Migration 016: Sprint 6 tables (stock, fournisseurs, vaccinations, communications)
-- Extracted from runMigrations.ts (sprint6-stock-fournisseurs-vaccinations-communications)

CREATE TABLE IF NOT EXISTS stock_items (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  name TEXT NOT NULL,
  reference TEXT,
  category TEXT NOT NULL DEFAULT 'MEDICAMENT',
  unit TEXT NOT NULL DEFAULT 'unite',
  current_stock NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_stock NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit_price_buy NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit_price_sell NUMERIC(10,2) NOT NULL DEFAULT 0,
  tva_rate NUMERIC(5,2) NOT NULL DEFAULT 20,
  supplier_id INTEGER,
  location TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  stock_item_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(10,2),
  expiration_date DATE,
  batch_number TEXT,
  reference TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_alerts (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  stock_item_id INTEGER NOT NULL,
  alert_type TEXT NOT NULL,
  alert_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiration_date DATE,
  batch_number TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fournisseurs (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  name TEXT NOT NULL,
  contact TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  siret TEXT,
  payment_conditions TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commandes_fournisseurs (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  fournisseur_id INTEGER NOT NULL,
  order_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'BROUILLON',
  order_date DATE NOT NULL,
  expected_date DATE,
  total_ht NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_tva NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_ttc NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commande_lignes (
  id SERIAL PRIMARY KEY,
  commande_id INTEGER NOT NULL,
  stock_item_id INTEGER,
  designation TEXT NOT NULL,
  reference TEXT,
  quantity NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  tva_rate NUMERIC(5,2) NOT NULL DEFAULT 20,
  total_ht NUMERIC(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS vaccinations (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  patient_id INTEGER NOT NULL,
  owner_id INTEGER,
  vaccine_type TEXT NOT NULL,
  vaccine_name TEXT,
  vaccine_date DATE NOT NULL,
  next_due_date DATE,
  batch_number TEXT,
  notes TEXT,
  consultation_id INTEGER,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vaccination_reminders (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  vaccination_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  owner_id INTEGER,
  reminder_date DATE NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'PENDING',
  sent_at TIMESTAMPTZ,
  recipient_email TEXT,
  recipient_phone TEXT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS communications (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  recipient_id INTEGER,
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_name TEXT,
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  ref_id INTEGER,
  ref_type TEXT,
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_items_clinic ON stock_items (clinic_id);
CREATE INDEX IF NOT EXISTS idx_stock_mvt_item ON stock_movements (stock_item_id);
CREATE INDEX IF NOT EXISTS idx_vaccinations_patient ON vaccinations (patient_id);
CREATE INDEX IF NOT EXISTS idx_vacc_reminders_date ON vaccination_reminders (reminder_date);
CREATE INDEX IF NOT EXISTS idx_communications_clinic ON communications (clinic_id);
