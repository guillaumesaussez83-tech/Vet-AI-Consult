import { z } from "zod";

// ─── Patients ─────────────────────────────────────────────────────────────────
export const CreatePatientSchema = z.object({
  nom:             z.string().min(1).max(100),
  espece:          z.string().min(1).max(50),
  race:            z.string().max(100).optional(),
  dateNaissance:   z.string().optional(),
  sexe:            z.string().optional(),
  proprietaireId:  z.string().uuid(),
  poids:           z.number().positive().optional(),
  couleur:         z.string().max(100).optional(),
  numeroMicrochip: z.string().max(50).optional(),
  notes:           z.string().optional(),
}).passthrough();

export const UpdatePatientSchema = CreatePatientSchema.partial().passthrough();

// ─── Consultations ───────────────────────────────────────────────────────────
export const CreateConsultationSchema = z.object({
  patientId: z.string().uuid(),
  motif:     z.string().min(1).max(500),
  statut:    z.string().optional(),
  date:      z.string().optional(),
  notes:     z.string().optional(),
}).passthrough();

export const UpdateConsultationSchema = CreateConsultationSchema.partial().passthrough();

// ─── Factures ────────────────────────────────────────────────────────────────
export const LigneFactureSchema = z.object({
  description: z.string().min(1),
  quantite:    z.number().positive(),
  prixUnitaire: z.number().nonnegative(),
  tvaRate:     z.number().nonnegative().optional(),
}).passthrough();

export const CreateFactureSchema = z.object({
  consultationId: z.string().uuid().optional(),
  lignes:         z.array(LigneFactureSchema).min(1),
  patientId:      z.string().uuid().optional(),
  statut:         z.string().optional(),
  notes:          z.string().optional(),
}).passthrough();

// ─── Ordonnances ─────────────────────────────────────────────────────────────
export const MedicamentSchema = z.object({
  nom:          z.string().min(1),
  dose:         z.string().optional(),
  duree:        z.string().optional(),
  instructions: z.string().optional(),
}).passthrough();

export const CreateOrdonnanceSchema = z.object({
  consultationId: z.string().uuid().optional(),
  patientId:      z.string().uuid().optional(),
  medicaments:    z.array(MedicamentSchema).optional(),
  contenu:        z.string().optional(),
  notes:          z.string().optional(),
}).passthrough();
