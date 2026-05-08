// lib/db/src/schema/analytics-snapshots.ts
// Phase 4 — Snapshots KPIs quotidiens pour analytics rapide

import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Snapshot quotidien par clinique — calculé chaque nuit (ou à la demande)
// Permet des requêtes analytics O(1) sur n'importe quelle période
export const analyticsSnapshotsTable = pgTable(
  "analytics_snapshots",
  {
    id: serial("id").primaryKey(),
    clinicId: text("clinic_id").notNull(),
    snapshotDate: date("snapshot_date").notNull(), // date locale YYYY-MM-DD

    // --- Chiffre d'affaires ---
    caTtcJour: text("ca_ttc_jour").notNull().default("0"), // € TTC du jour
    caTtcMois: text("ca_ttc_mois").notNull().default("0"), // cumul mois courant
    caTtcAn: text("ca_ttc_an").notNull().default("0"), // cumul année courante
    caHtJour: text("ca_ht_jour").notNull().default("0"),

    // --- Consultations ---
    nbConsultations: integer("nb_consultations").notNull().default(0),
    nbConsultationsTerminees: integer("nb_consultations_terminees")
      .notNull()
      .default(0),
    nbConsultationsIA: integer("nb_consultations_ia").notNull().default(0),
    dureeeMoyenneMin: integer("duree_moyenne_min").default(0),

    // --- Patients ---
    nbNouveauxPatients: integer("nb_nouveaux_patients").notNull().default(0),
    nbPatientsActifs: integer("nb_patients_actifs").notNull().default(0), // au moins 1 visite dans les 12 mois
    nbPatientsInactifs: integer("nb_patients_inactifs").notNull().default(0), // aucune visite > 6 mois

    // --- Facturation ---
    nbFactures: integer("nb_factures").notNull().default(0),
    nbFacturesPayees: integer("nb_factures_payees").notNull().default(0),
    nbFacturesImpayees: integer("nb_factures_impayees").notNull().default(0),
    montantImpoayeTtc: text("montant_impaye_ttc").notNull().default("0"),

    // --- RDV / Agenda ---
    nbRdvProgrammes: integer("nb_rdv_programmes").notNull().default(0),
    nbRdvHonores: integer("nb_rdv_honores").notNull().default(0),
    nbNoShow: integer("nb_no_show").notNull().default(0),
    tauxNoShow: text("taux_no_show").notNull().default("0"), // %

    // --- Stock ---
    nbAlerteStock: integer("nb_alerte_stock").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Un seul snapshot par clinique par jour
    clinicDateUnique: uniqueIndex("analytics_clinic_date_idx").on(
      t.clinicId,
      t.snapshotDate
    ),
    // Index pour requêtes par période
    clinicDateRangeIdx: index("analytics_clinic_date_range_idx").on(
      t.clinicId,
      t.snapshotDate
    ),
  })
);

// Prévisions CA mensuelles générées par l'IA
export const analyticsForecastsTable = pgTable("analytics_forecasts", {
  id: serial("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  forecastMonth: text("forecast_month").notNull(), // YYYY-MM
  caForecastTtc: text("ca_forecast_ttc").notNull().default("0"),
  confidenceInterval: text("confidence_interval").default("0"), // ± €
  methodology: text("methodology").notNull().default("linear_regression"),
  dataPointsUsed: integer("data_points_used").default(12),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
