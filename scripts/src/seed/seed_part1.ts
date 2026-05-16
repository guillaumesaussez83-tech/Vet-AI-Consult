// SEED PART 1 - Proprietaires, Veterinaires, Assistants
export interface Owner { nom: string; prenom: string; email?: string; telephone: string; adresse?: string; }
export interface Vet { name: string; id: string; }
export interface Assistant { nom: string; prenom: string; email?: string; telephone?: string; role?: string; initiales?: string; }
export const VETS: Vet[] = [
  { name: "Dr. Marie Dubois", id: "vet_clerk_001" },
    { name: "Dr. Pierre Martin", id: "vet_clerk_002" },
      { name: "Dr. Sophie Bernard", id: "vet_clerk_003" },
      ];
      export const OWNERS: Owner[] = [];
      export const ASSISTANTS: Assistant[] = [];
