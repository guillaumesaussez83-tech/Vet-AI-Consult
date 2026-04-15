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
  agressif?: boolean | null;
  puce?: string | null;
  passeport?: string | null;
  assurance?: boolean | null;
  assuranceNom?: string | null;
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
    <div className={`w-full bg-white border rounded-xl px-4 py-3 flex items-center gap-4 shadow-sm ${patient.agressif ? "border-red-500 bg-red-50" : "border-border"}`}>
      <div className="relative flex-shrink-0">
        {patient.photoUrl ? (
          <img
            src={`/api/storage${patient.photoUrl}`}
            alt={patient.nom}
            className={`w-12 h-12 rounded-full object-cover border-2 ${patient.agressif ? "border-red-500" : "border-border"}`}
          />
        ) : (
          <div className={`w-12 h-12 rounded-full bg-muted flex items-center justify-center border-2 ${patient.agressif ? "border-red-500 bg-red-100" : "border-border"}`}>
            <span className="text-xl select-none">
              {patient.espece?.toLowerCase() === "chien" ? "🐕" : patient.espece?.toLowerCase() === "chat" ? "🐈" : patient.espece?.toLowerCase() === "lapin" ? "🐰" : patient.espece?.toLowerCase() === "oiseau" ? "🐦" : "🐾"}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base font-bold truncate">{patient.nom}</span>
          <span className="text-sm text-muted-foreground">{patient.espece}</span>
          {patient.race && (
            <span className="text-sm text-muted-foreground">— {patient.race}</span>
          )}
          {patient.agressif && (
            <span className="inline-flex items-center bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded tracking-wide">
              AGRESSIF
            </span>
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
          {patient.assurance && patient.assuranceNom && (
            <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100 font-medium">
              Assuré : {patient.assuranceNom}
            </span>
          )}
          {patient.puce && (
            <span className="text-xs text-muted-foreground">Puce : {patient.puce}</span>
          )}
        </div>
      </div>
    </div>
  );
}
