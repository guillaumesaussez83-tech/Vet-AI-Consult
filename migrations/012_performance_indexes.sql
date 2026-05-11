-- Migration 012: indexes de performance pour requêtes multi-tenant critiques
-- Utiliser CONCURRENTLY pour ne pas bloquer la prod (hors transaction)

-- Patients
CREATE INDEX IF NOT EXISTS patients_clinic_id_idx ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS patients_proprietaire_idx ON patients(proprietaire_id);

-- Consultations
CREATE INDEX IF NOT EXISTS consultations_clinic_id_idx ON consultations(clinic_id);
CREATE INDEX IF NOT EXISTS consultations_patient_idx ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS consultations_date_idx ON consultations(date DESC);
CREATE INDEX IF NOT EXISTS consultations_statut_idx ON consultations(statut);

-- Factures
CREATE INDEX IF NOT EXISTS factures_clinic_id_idx ON factures(clinic_id);
CREATE INDEX IF NOT EXISTS factures_consultation_idx ON factures(consultation_id);
CREATE INDEX IF NOT EXISTS factures_date_idx ON factures(date_emission DESC);
CREATE INDEX IF NOT EXISTS factures_statut_idx ON factures(statut);

-- Rendez-vous
CREATE INDEX IF NOT EXISTS appointments_clinic_id_idx ON appointments(clinic_id);
CREATE INDEX IF NOT EXISTS appointments_date_idx ON appointments(date_heure);
CREATE INDEX IF NOT EXISTS appointments_patient_idx ON appointments(patient_id);

-- Ordonnances
CREATE INDEX IF NOT EXISTS ordonnances_clinic_id_idx ON ordonnances(clinic_id);
CREATE INDEX IF NOT EXISTS ordonnances_consultation_idx ON ordonnances(consultation_id);

-- Stock
CREATE INDEX IF NOT EXISTS stock_items_clinic_id_idx ON stock_items(clinic_id);

-- Encaissements
CREATE INDEX IF NOT EXISTS encaissements_clinic_id_idx ON encaissements(clinic_id);
CREATE INDEX IF NOT EXISTS encaissements_facture_idx ON encaissements(facture_id);
