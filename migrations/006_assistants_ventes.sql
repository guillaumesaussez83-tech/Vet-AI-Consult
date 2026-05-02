-- Migration 006: assistants, ventes, vente_lignes
-- Créé le 2026-05-02

-- Table assistants
CREATE TABLE IF NOT EXISTS assistants (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL DEFAULT 'default',
  clerk_user_id TEXT,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT,
  telephone TEXT,
  role TEXT NOT NULL DEFAULT 'assistante',
  initiales TEXT,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinic_id__assistants ON assistants (clinic_id);
CREATE INDEX IF NOT EXISTS idx_assistants_clerk_user_id ON assistants (clerk_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_assistants_clinic_clerk
  ON assistants (clinic_id, clerk_user_id)
  WHERE clerk_user_id IS NOT NULL;

-- Table ventes
CREATE TABLE IF NOT EXISTS ventes (
  id SERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL DEFAULT 'default',
  numero TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'comptoir',
  assistant_id INTEGER REFERENCES assistants(id),
  patient_id INTEGER REFERENCES patients(id),
  proprietaire_id INTEGER REFERENCES owners(id),
  ordonnance_id INTEGER REFERENCES ordonnances(id),
  notes TEXT,
  montant_ht NUMERIC(10, 2) DEFAULT 0,
  montant_tva NUMERIC(10, 2) DEFAULT 0,
  montant_ttc NUMERIC(10, 2) DEFAULT 0,
  statut TEXT DEFAULT 'completee',
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinic_id__ventes ON ventes (clinic_id);
CREATE INDEX IF NOT EXISTS idx_ventes_assistant_id ON ventes (assistant_id);
CREATE INDEX IF NOT EXISTS idx_ventes_type ON ventes (type);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ventes_clinic_numero ON ventes (clinic_id, numero);

-- Table vente_lignes
CREATE TABLE IF NOT EXISTS vente_lignes (
  id SERIAL PRIMARY KEY,
  vente_id INTEGER NOT NULL REFERENCES ventes(id) ON DELETE CASCADE,
  produit_id INTEGER,
  description TEXT NOT NULL,
  quantite NUMERIC(10, 3) DEFAULT 1,
  prix_unitaire NUMERIC(10, 2) NOT NULL,
  tva_taux NUMERIC(5, 2) DEFAULT 20,
  montant_ht NUMERIC(10, 2) NOT NULL,
  montant_ttc NUMERIC(10, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vente_lignes_vente_id ON vente_lignes (vente_id);
