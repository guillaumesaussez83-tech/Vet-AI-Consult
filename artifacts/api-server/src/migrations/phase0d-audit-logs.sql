-- Phase 0D — Audit Logs table
-- Traçabilité complète : qui a fait quoi, sur quelle ressource, depuis quelle clinique

CREATE TABLE IF NOT EXISTS audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  clinic_id       TEXT NOT NULL,
  user_id         TEXT NOT NULL,          -- Clerk user ID
  user_email      TEXT,                   -- dénormalisé pour lisibilité
  action          TEXT NOT NULL,          -- CREATE | UPDATE | DELETE | VIEW
  resource_type   TEXT NOT NULL,          -- patient | consultation | facture | ...
  resource_id     TEXT,                   -- ID de la ressource concernée
  resource_label  TEXT,                   -- label lisible (ex: "Jean Dupont")
  metadata        JSONB DEFAULT '{}',     -- payload optionnel (diff avant/après)
  ip_address      TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_audit_clinic_id
  ON audit_logs (clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_user_id
  ON audit_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_resource
  ON audit_logs (clinic_id, resource_type, resource_id);

-- TTL policy : purge automatique des logs > 2 ans (RGPD)
-- À exécuter via cron Railway :
--   DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '2 years';

COMMENT ON TABLE audit_logs IS
  'Traçabilité complète des actions utilisateurs — Phase 0D — Ne jamais supprimer manuellement';
