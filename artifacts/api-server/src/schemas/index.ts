import { z } from "zod";

// --- Patients ---
export const CreatePatientSchema = z.object({
  nom:              z.string().min(1).max(100),
  espece:           z.string().min(1).max(50),
  race:             z.string().max(100).nullish(),
  dateNaissance:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  sexe:             z.string().optional(),
  ownerId:          z.number().int().positive(),
  poids:            z.number().positive().nullish(),
  couleur:          z.string().max(100).nullish(),
  sterilise:        z.boolean().optional().default(false),
  antecedents:      z.string().nullish(),
  allergies:        z.string().nullish(),
  puce:             z.string().max(50).nullish(),
  passeport:        z.string().max(50).nullish(),
  assurance:        z.boolean().optional().default(false),
  assuranceNom:     z.string().nullish(),
  agressif:         z.boolean().optional().default(false),
  consentementRgpd: z.boolean().optional(),
  dateConsentement: z.string().nullish(),
}).strip();

export const UpdatePatientSchema = CreatePatientSchema.partial().strip();

// --- Consultations ---
export const CreateConsultationSchema = z.object({
  patientId: z.string().uuid(),
  motif: z.string().min(1).max(500),
  statut: z.string().optional(),
  date: z.string().optional(),
  notes: z.string().optional(),
}).strip();

export const UpdateConsultationSchema = CreateConsultationSchema.partial().strip();

// --- Factures ---
export const LigneFactureSchema = z.object({
  description: z.string().min(1),
  quantite: z.number().positive(),
  prixUnitaire: z.number().nonnegative(),
  tvaRate: z.number().nonnegative().optional(),
}).strip();

export const CreateFactureSchema = z.object({
  consultationId: z.string().uuid().optional(),
  lignes: z.array(LigneFactureSchema).min(1),
  patientId: z.string().uuid().optional(),
  statut: z.string().optional(),
  notes: z.string().optional(),
}).strip();

// --- Ordonnances ---
export const MedicamentSchema = z.object({
  nom: z.string().min(1),
  dose: z.string().optional(),
  duree: z.string().optional(),
  instructions: z.string().optional(),
}).strip();

export const CreateOrdonnanceSchema = z.object({
  consultationId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  medicaments: z.array(MedicamentSchema).optional(),
  contenu: z.string().optional(),
  notes: z.string().optional(),
}).strip();
