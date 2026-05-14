-- Migration 015: Create relances table
-- Extracted from runMigrations.ts (sprint5-relances)

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
