 Patients
 // ============================================================

 export interface Patient {
   nom: string;
     espece: string;
       race?: string;
         sexe: string;
           date_naissance?: string;
             poids?: number;
               sterilise?: boolean;
                 owner_idx: number;
                   antecedents?: string;
                     puce?: string;
                       couleur?: string;
                         allergies?: string;
                         }

                         export const PATIENTS: Patient[] = [];