/**
 * Helpers de categorisation des lignes de facture/acte.
 *
 * Volontairement SANS dependance (pas de `db`, pas d'import lourd) pour rester
 * testable en unitaire -- cf. `__tests__/categorisation.test.ts`.
 */

/**
 * Minuscule + suppression des diacritiques (accents).
 *
 *   normaliserTexte("Medicament") === "medicament"  // "Medicament" -> "medicament"
 *   normaliserTexte("VACCIN")     === "vaccin"
 *
 * On decompose en NFD puis on retire les marques combinantes (U+0300-U+036F),
 * ce qui transforme un "e accent" en "e". Le resultat est insensible a la casse
 * ET aux accents -- indispensable car la colonne `categorie` est du texte libre,
 * alimente tantot "medicament" (seeder), tantot "Medicament" (saisie manuelle /
 * IA / import CSV).
 */
export function normaliserTexte(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Une ligne doit-elle declencher le decrement de stock FEFO ?
 *
 * Vrai si la categorie correspond a un medicament (match insensible aux
 * accents/casse sur "medic") OU si le code produit identifie un medicament
 * (`MED...`) ou un vaccin (`VACCI...`).
 *
 * NB : le decrement reel reste conditionne, en aval, a la correspondance du
 * `nom` de la ligne avec un medicament du stock (cf. `decrementerConsultationFEFO`).
 * Ce predicat n'est qu'un pre-filtre : un faux positif categorie sans nom de
 * produit en stock est inoffensif (la ligne ressort `notFound`).
 */
export function doitDecrementerStock(
  categorie?: string | null,
  code?: string | null,
): boolean {
  const cat = categorie ? normaliserTexte(categorie) : "";
  return (
    cat.includes("medic") ||
    (code?.startsWith("MED") ?? false) ||
    (code?.startsWith("VACCI") ?? false)
  );
}
