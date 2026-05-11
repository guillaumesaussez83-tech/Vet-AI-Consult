-- Migration 008: migrer pièces jointes base64 vers URLs (stockage externe)
-- Ajouter les nouvelles colonnes de stockage par référence
ALTER TABLE consultation_attachments ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE consultation_attachments ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE consultation_attachments ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE consultation_attachments ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- Rendre data_base64 nullable (pour migration progressive)
ALTER TABLE consultation_attachments ALTER COLUMN data_base64 DROP NOT NULL;

-- Index sur consultation_id pour recherche rapide
CREATE INDEX IF NOT EXISTS consultation_attachments_consult_idx
  ON consultation_attachments(consultation_id);

-- Index sur clinic_id pour isolation multi-tenant (si colonne existe)
CREATE INDEX IF NOT EXISTS consultation_attachments_clinic_idx
  ON consultation_attachments(clinic_id);
