// artifacts/api-server/src/lib/runMigrations.ts
// Migrations DB consolidees -- audit Phase 0, mai 2026
// Extraites de index.ts pour eliminer les migrations inline au demarrage
// Toutes idempotentes : IF NOT EXISTS / ADD COLUMN IF NOT EXISTS

import type { Logger } from "pino";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = { execute: (sql: any, params?: any[]) => Promise<any> };

interface Migration {
  name: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    name: "workflow-consultation",
    sql: `
      ALTER TABLE consultations ADD COLUMN IF NOT EXISTS phase VARCHAR(50) DEFAULT 'anamnese';
      ALTER TABLE consultations ADD COLUMN IF NOT EXISTS anamnese_ia TEXT;
      ALTER TABLE consultations ADD COLUMN IF NOT EXISTS examen_ia TEXT;
      ALTER TABLE consultations ADD COLUMN IF NOT EXISTS examens_complementaires_valides JSONB;
      ALTER TABLE consultations ADD COLUMN IF NOT EXISTS synthese_ia TEXT;
    `,
  },
  {
    name: "sprint1-no-show-amm",
    sql: `
      ALTER TABLE rendez_vous ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMPTZ;
      ALTER TABLE rendez_vous ADD COLUMN IF NOT EXISTS no_show_reason TEXT;
      ALTER TABLE ordonnances ADD COLUMN IF NOT EXISTS numero_amm TEXT;
    `,
  },
  {
    name: "sprint4b-user-permissions",
    sql: `
      CREATE TABLE IF NOT EXISTS user_permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        module VARCHAR(50) NOT NULL,
        can_read BOOLEAN NOT NULL DEFAULT true,
        can_write BOOLEAN NOT NULL DEFAULT false,
        can_delete BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_perms_user_module ON user_permissions(user_id, module);
    `,
  },
  {
    name: "sprint4c-multi-animaux",
    sql: `
      CREATE TABLE IF NOT EXISTS consultation_patients (
        id SERIAL PRIMARY KEY,
        consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(consultation_id, patient_id)
      );
      CREATE TABLE IF NOT EXISTS consultation_attachments (
        id SERIAL PRIMARY KEY,
        consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
        size_bytes INTEGER NOT NULL DEFAULT 0,
        data_base64 TEXT NOT NULL,
        uploaded_by VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
  },
  {
    name: "sprint4d-portees",
    sql: `
      ALTER TABLE patients ADD COLUMN IF NOT EXISTS mother_id INTEGER REFERENCES patients(id);
      ALTER TABLE patients ADD COLUMN IF NOT EXISTS father_id INTEGER REFERENCES patients(id);
    `,
  },
  {
    name: "sprint4e-cremation",
    sql: `
      CREATE TABLE IF NOT EXISTS cremation_partners (
        id SERIAL PRIMARY KEY,
        clinic_id TEXT NOT NULL,
        nom TEXT NOT NULL,
        adresse TEXT,
        telephone TEXT,
        email TEXT,
        tarif_individuel NUMERIC(10,2),
        tarif_collectif NUMERIC(10,2),
        notes TEXT,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_cremation_partners_clinic ON cremation_partners (clinic_id);
    `,
  },
  {
    name: "sprint5-relances",
    sql: `
      CREATE TABLE IF NOT EXISTS relances (
        id SERIAL PRIMARY KEY,
        clinic_id TEXT NOT NULL,
        invoice_id INTEGER NOT NULL,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sent_by TEXT NOT NULL,
        channel TEXT NOT NULL DEFAULT 'email',
        recipient_email TEXT,
        recipient_name TEXT,
        message TEXT,
        status TEXT NOT NULL DEFAULT 'sent',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_relances_clinic ON relances (clinic_id);
      CREATE INDEX IF NOT EXISTS idx_relances_invoice ON relances (invoice_id);
    `,
  },
  {
    name: "sprint6-stock-fournisseurs-vaccinations-communications",
    sql: `
      CREATE TABLE IF NOT EXISTS stock_items (
        id SERIAL PRIMARY KEY, clinic_id TEXT NOT NULL, name TEXT NOT NULL,
        reference TEXT, category TEXT NOT NULL DEFAULT 'MEDICAMENT', unit TEXT NOT NULL DEFAULT 'unite',
        current_stock NUMERIC(10,2) NOT NULL DEFAULT 0, min_stock NUMERIC(10,2) NOT NULL DEFAULT 0,
        unit_price_buy NUMERIC(10,2) NOT NULL DEFAULT 0, unit_price_sell NUMERIC(10,2) NOT NULL DEFAULT 0,
        tva_rate NUMERIC(5,2) NOT NULL DEFAULT 20, supplier_id INTEGER, location TEXT,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS stock_movements (
        id SERIAL PRIMARY KEY, clinic_id TEXT NOT NULL, stock_item_id INTEGER NOT NULL,
        type TEXT NOT NULL, quantity NUMERIC(10,2) NOT NULL, unit_price NUMERIC(10,2),
        expiration_date DATE, batch_number TEXT, reference TEXT, notes TEXT,
        created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS stock_alerts (
        id SERIAL PRIMARY KEY, clinic_id TEXT NOT NULL, stock_item_id INTEGER NOT NULL,
        alert_type TEXT NOT NULL, alert_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expiration_date DATE, batch_number TEXT,
        resolved BOOLEAN NOT NULL DEFAULT false, resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS fournisseurs (
        id SERIAL PRIMARY KEY, clinic_id TEXT NOT NULL, name TEXT NOT NULL,
        contact TEXT, email TEXT, phone TEXT, address TEXT, siret TEXT,
        payment_conditions TEXT, active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS commandes_fournisseurs (
        id SERIAL PRIMARY KEY, clinic_id TEXT NOT NULL, fournisseur_id INTEGER NOT NULL,
        order_number TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'BROUILLON',
        order_date DATE NOT NULL, expected_date DATE,
        total_ht NUMERIC(10,2) NOT NULL DEFAULT 0, total_tva NUMERIC(10,2) NOT NULL DEFAULT 0,
        total_ttc NUMERIC(10,2) NOT NULL DEFAULT 0, notes TEXT, created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS commande_lignes (
        id SERIAL PRIMARY KEY, commande_id INTEGER NOT NULL, stock_item_id INTEGER,
        designation TEXT NOT NULL, reference TEXT, quantity NUMERIC(10,2) NOT NULL,
        unit_price NUMERIC(10,2) NOT NULL, tva_rate NUMERIC(5,2) NOT NULL DEFAULT 20,
        total_ht NUMERIC(10,2) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS vaccinations (
        id SERIAL PRIMARY KEY, clinic_id TEXT NOT NULL, patient_id INTEGER NOT NULL,
        owner_id INTEGER, vaccine_type TEXT NOT NULL, vaccine_name TEXT,
        vaccine_date DATE NOT NULL, next_due_date DATE, batch_number TEXT, notes TEXT,
        consultation_id INTEGER, created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS vaccination_reminders (
        id SERIAL PRIMARY KEY, clinic_id TEXT NOT NULL, vaccination_id INTEGER NOT NULL,
        patient_id INTEGER NOT NULL, owner_id INTEGER, reminder_date DATE NOT NULL,
        channel TEXT NOT NULL DEFAULT 'email', status TEXT NOT NULL DEFAULT 'PENDING',
        sent_at TIMESTAMPTZ, recipient_email TEXT, recipient_phone TEXT, message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS communications (
        id SERIAL PRIMARY KEY, clinic_id TEXT NOT NULL, type TEXT NOT NULL,
        channel TEXT NOT NULL DEFAULT 'email', recipient_id INTEGER,
        recipient_email TEXT, recipient_phone TEXT, recipient_name TEXT,
        subject TEXT, body TEXT, status TEXT NOT NULL DEFAULT 'PENDING',
        ref_id INTEGER, ref_type TEXT, sent_at TIMESTAMPTZ, error TEXT,
        created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_stock_items_clinic ON stock_items (clinic_id);
      CREATE INDEX IF NOT EXISTS idx_stock_mvt_item ON stock_movements (stock_item_id);
      CREATE INDEX IF NOT EXISTS idx_vaccinations_patient ON vaccinations (patient_id);
      CREATE INDEX IF NOT EXISTS idx_vacc_reminders_date ON vaccination_reminders (reminder_date);
      CREATE INDEX IF NOT EXISTS idx_communications_clinic ON communications (clinic_id);
    `,
  },
];

export async function runMigrations(db: AnyDb, logger: Logger): Promise<void> {
  logger.info(`Running ${MIGRATIONS.length} DB migrations...`);
  for (const migration of MIGRATIONS) {
    try {
      await db.execute(migration.sql);
      logger.info(`Migration OK: ${migration.name}`);
    } catch (e) {
      logger.warn({ err: e }, `Migration skipped (already applied?): ${migration.name}`);
    }
  }
  logger.info("All migrations completed");
}
