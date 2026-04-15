import { differenceInYears, differenceInMonths, parseISO } from "date-fns";

type Patient = {
  id: number;
  nom: string;
  espece: string;
  race?: string | null;
  dateNaissance?: string | null;
  poids?: number | null;
  sexe: string;
  sterilise?: boolean | null;
  photoUrl?: string | null;
};

function calculerAge(dateNaissance: string | null | undefined): string {
  if (!dateNaissance) return "";
  try {
    const dob = parseISO(dateNaissance);
    const years = differenceInYears(new Date(), dob);
    if (years >= 1) return `${years} an${years > 1 ? "s" : ""}`;
    const months = differenceInMonths(new Date(), dob);
    if (months > 0) return `${months} mois`;
    return "< 1 mois";
  } catch {
    return "";
  }
}

function formatSexe(sexe: string): string {
  const map: Record<string, string> = {
    male: "Mâle",
    femelle: "Femelle",
    male_sterilise: "Mâle stérilisé",
    femelle_sterilisee: "Femelle stérilisée",
  };
  return map[sexe] ?? sexe;
}

export function PatientBarre({ patient }: { patient: Patient }) {
  const age = calculerAge(patient.dateNaissance);

  return (
    <div className="w-full bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-4 shadow-sm">
      {patient.photoUrl ? (
        <img
          src={`/api/storage${patient.photoUrl}`}
          alt={patient.nom}
          className="w-12 h-12 rounded-full object-cover border border-border flex-shrink-0"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0 border border-border">
          <span className="text-xl select-none">
            {patient.espece === "Chien" ? "🐕" : patient.espece === "Chat" ? "🐈" : patient.espece === "Lapin" ? "🐰" : patient.espece === "Oiseau" ? "🐦" : "🐾"}
          </span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-bold truncate">{patient.nom}</span>
          <span className="text-sm text-muted-foreground">{patient.espece}</span>
          {patient.race && (
            <span className="text-sm text-muted-foreground">— {patient.race}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
          {age && (
            <span className="text-xs text-muted-foreground">{age}</span>
          )}
          <span className="text-xs text-muted-foreground">{formatSexe(patient.sexe)}</span>
          {patient.sterilise && (
            <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 font-medium">
              Stérilisé
            </span>
          )}
          {patient.poids && (
            <span className="text-xs text-muted-foreground">{patient.poids} kg</span>
          )}
        </div>
      </div>
    </div>
  );
}
