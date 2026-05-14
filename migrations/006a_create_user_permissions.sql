-- Migration 006a: Create user_permissions base table
-- Extracted from runMigrations.ts (sprint4b-user-permissions)
-- PREREQUISITE for migration 007 (ALTER TABLE user_permissions ADD COLUMN clinic_id)

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_perms_user_module
  ON user_permissions(user_id, module);
