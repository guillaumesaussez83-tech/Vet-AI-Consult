-- Migration 008: Performance indexes
-- Created: 2026-05-08
-- Purpose: Add missing indexes on high-frequency query columns to reduce
--          full-table scans on the most-queried tables.

-- ─── patients ────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_clinic_id
  ON patients (clinic_id);

  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_owner_id
    ON patients (owner_id);

    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_clinic_deleted
      ON patients (clinic_id, deleted_at)
        WHERE deleted_at IS NULL;

        -- ─── consultations ───────────────────────────────────────────────────────────
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consultations_clinic_id
          ON consultations (clinic_id);

          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consultations_patient_id
            ON consultations (patient_id);

            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consultations_clinic_date
              ON consultations (clinic_id, date DESC);

              CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consultations_clinic_deleted
                ON consultations (clinic_id, deleted_at)
                  WHERE deleted_at IS NULL;

                  -- ─── factures ────────────────────────────────────────────────────────────────
                  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_factures_clinic_id
                    ON factures (clinic_id);

                    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_factures_consultation_id
                      ON factures (consultation_id);

                      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_factures_owner_id
                        ON factures (owner_id);

                        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_factures_clinic_statut
                          ON factures (clinic_id, statut);

                          -- ─── rendez_vous ─────────────────────────────────────────────────────────────
                          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rdv_clinic_id
                            ON rendez_vous (clinic_id);

                            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rdv_patient_id
                              ON rendez_vous (patient_id);

                              CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rdv_clinic_date
                                ON rendez_vous (clinic_id, date_heure);

                                -- ─── ordonnances ─────────────────────────────────────────────────────────────
                                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ordonnances_clinic_id
                                  ON ordonnances (clinic_id);

                                  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ordonnances_consultation_id
                                    ON ordonnances (consultation_id);

                                    -- ─── proprietaires ───────────────────────────────────────────────────────────
                                    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_proprietaires_clinic_id
                                      ON proprietaires (clinic_id);

                                      -- ─── encaissements ───────────────────────────────────────────────────────────
                                      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_encaissements_clinic_id
                                        ON encaissements (clinic_id);

                                        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_encaissements_facture_id
                                          ON encaissements (facture_id);

                                          -- ─── stock_mouvements ────────────────────────────────────────────────────────
                                          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_mouvements_clinic_id
                                            ON stock_mouvements (clinic_id);

                                            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_mouvements_produit_id
                                              ON stock_mouvements (produit_id);

                                              -- ─── vaccinations ────────────────────────────────────────────────────────────
                                              CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vaccinations_patient_id
                                                ON vaccinations (patient_id);

                                                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vaccinations_clinic_id
                                                  ON vaccinations (clinic_id);