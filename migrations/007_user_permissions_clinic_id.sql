-- Migration 007: ajouter clinic_id sur user_permissions pour isolation multi-tenant
ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS clinic_id TEXT;

-- Backfill depuis la table assistants (clerk_user_id -> clinic_id)
UPDATE user_permissions up
SET clinic_id = a.clinic_id
FROM assistants a
WHERE a.clerk_user_id = up.user_id
  AND up.clinic_id IS NULL;

-- Fallback: si pas trouvé dans assistants, prendre la premiere clinique
UPDATE user_permissions up
SET clinic_id = (SELECT id FROM clinics LIMIT 1)
WHERE up.clinic_id IS NULL;

-- Rendre la colonne NOT NULL
ALTER TABLE user_permissions ALTER COLUMN clinic_id SET NOT NULL;

-- Indexes pour performance multi-tenant
CREATE INDEX IF NOT EXISTS user_perms_clinic_idx ON user_permissions(clinic_id);
CREATE INDEX IF NOT EXISTS user_perms_user_clinic_idx ON user_permissions(user_id, clinic_id);
