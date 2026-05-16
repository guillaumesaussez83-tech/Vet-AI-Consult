 // ============================================================
 // Rendez-vous & Historique poids
 // ============================================================

 export interface RendezVous {
   patient_idx: number;
     vet_idx: number;
       date: string;
         duree_minutes: number;
           motif: string;
             statut: string;
               notes?: string;
               }

               export interface WeightEntry {
                 patient_idx: number;
                   date: string;
                     poids_kg: number;
                       notes?: string;
                       }

                       export const RENDEZ_VOUS: RendezVous[] = [];

                       export const WEIGHT_HISTORY: WeightEntry[] = [];