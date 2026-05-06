import { db } from "@workspace/db";
import { medicationsAnmvTable } from "@workspace/db";
import { sql } from "drizzle-orm";

export type MedicationSpecies = "CA" | "FE";

export interface MedicationRagResult {
  name: string;
  genericName: string | null;
  dosageCa: string | null;
  dosageFe: string | null;
  indications: string[];
  isAntibiotic: boolean;
  antibioticClass: string | null;
  isControlled: boolean;
  maxDurationDays: number | null;
  contraindications: string[];
  interactions: string[];
}

/**
 * Find medications authorized for a given species matching the clinical indication.
 * Uses PostgreSQL array containment + French full-text search.
 */
export async function findMedications(
  indication: string,
  species: MedicationSpecies,
  limit = 10
): Promise<MedicationRagResult[]> {
  if (!indication || indication.trim().length < 3) {
    return [];
  }

  try {
    const results = await db
      .select({
        name: medicationsAnmvTable.name,
        genericName: medicationsAnmvTable.genericName,
        dosageCa: medicationsAnmvTable.dosageCa,
        dosageFe: medicationsAnmvTable.dosageFe,
        indications: medicationsAnmvTable.indications,
        isAntibiotic: medicationsAnmvTable.isAntibiotic,
        antibioticClass: medicationsAnmvTable.antibioticClass,
        isControlled: medicationsAnmvTable.isControlled,
        maxDurationDays: medicationsAnmvTable.maxDurationDays,
        contraindications: medicationsAnmvTable.contraindications,
        interactions: medicationsAnmvTable.interactions,
      })
      .from(medicationsAnmvTable)
      .where(
        sql`
          ${medicationsAnmvTable.speciesAuthorized} @> ARRAY[${species}]::text[]
          AND to_tsvector('french', array_to_string(${medicationsAnmvTable.indications}, ' '))
              @@ plainto_tsquery('french', ${indication})
        `
      )
      .limit(limit);

    return results;
  } catch (error) {
    // RAG failure must never break the main AI flow
    console.error("[ragMedications] Error fetching medications:", error);
    return [];
  }
}

/**
 * Format RAG results into a context string for inclusion in the AI prompt.
 */
export function formatMedicationsContext(
  medications: MedicationRagResult[],
  species: MedicationSpecies
): string {
  if (medications.length === 0) {
    return "Aucun medicament ANMV identifie pour cette indication/espece.";
  }

  const speciesLabel = species === "CA" ? "chien" : "chat";
  const lines: string[] = [
    `Medicaments ANMV autorises pour le ${speciesLabel} (${medications.length} resultats):`,
  ];

  for (const med of medications) {
    const dosage = species === "CA" ? med.dosageCa : med.dosageFe;
    const controlled = med.isControlled ? " [STUPEFIANT]" : "";
    const antibiotic = med.isAntibiotic
      ? ` [ANTIBIOTIQUE: ${med.antibioticClass || "N/A"}]`
      : "";

    lines.push("");
    lines.push(
      `- ${med.name}${med.genericName ? ` (${med.genericName})` : ""}${controlled}${antibiotic}`
    );
    if (dosage) lines.push(`  Posologie: ${dosage}`);
    if (med.maxDurationDays)
      lines.push(`  Duree max: ${med.maxDurationDays} jours`);
    if (med.contraindications.length > 0)
      lines.push(`  Contre-indications: ${med.contraindications.join(", ")}`);
    if (med.interactions.length > 0)
      lines.push(`  Interactions: ${med.interactions.join(", ")}`);
  }

  return lines.join("\n");
}
