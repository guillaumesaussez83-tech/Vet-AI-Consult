 Consultations
 // ============================================================

 export interface Consultation {
   patient_idx: number;
     vet_idx: number;
       date: string;
         motif: string;
           anamnese: string;
             examen_clinique: string;
               notes: string;
                 ordonnance?: string;
                   facture_statut?: string;
                     mode_paiement?: string;
                       facture_lignes?: Array<{
                           libelle: string;
                               quantite: number;
                                   prixUnitaire: number;
                                       tvaRate: number;
                                         }>;
                                           vaccination?: {
                                               vaccine_type: string;
                                                   vaccine_name: string;
                                                       next_due_months: number;
                                                         };
                                                           domaine?: string;
                                                             complexite?: number;
                                                             }

                                                             export const CONSULTATIONS: Consultation[] = [];