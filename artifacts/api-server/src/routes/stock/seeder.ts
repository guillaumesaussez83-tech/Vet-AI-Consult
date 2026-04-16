import { db } from "@workspace/db";
import { stockMedicamentsTable, stockLotsTable, alertesStockTable, mouvementsStockTable, lignesCommandeTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { genererAlertes } from "./ia-engine";

function cvRef(n: number): string {
  return `CV${String(n).padStart(5, "0")}`;
}

function addMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0]!;
}

function lotNum(ym: string, n: number): string {
  return `LOT-${ym}-${String(n).padStart(3, "0")}`;
}

type Produit = {
  nom: string;
  categorie: string;
  quantiteStock: number;
  quantiteMinimum: number;
  quantiteMax: number;
  prixAchatHT: number;
  unite: string;
  expiryMonths: number;
  ref: number;
};

const PRODUITS: Produit[] = [
  // ── MÉDICAMENTS ──────────────────────────────────────────────────
  { nom: "Amoxicilline 200mg/ml suspension injectable", categorie: "medicament", quantiteStock: 8,  quantiteMinimum: 3,  quantiteMax: 15,  prixAchatHT: 12.50, unite: "flacon",   expiryMonths: 18, ref: 1  },
  { nom: "Amoxicilline/Acide clavulanique 500mg cp",    categorie: "medicament", quantiteStock: 45, quantiteMinimum: 20, quantiteMax: 80,  prixAchatHT: 0.85,  unite: "comprime", expiryMonths: 24, ref: 2  },
  { nom: "Métronidazole 250mg cp",                      categorie: "medicament", quantiteStock: 60, quantiteMinimum: 30, quantiteMax: 100, prixAchatHT: 0.25,  unite: "comprime", expiryMonths: 24, ref: 3  },
  { nom: "Prednisolone 20mg cp",                        categorie: "medicament", quantiteStock: 80, quantiteMinimum: 40, quantiteMax: 150, prixAchatHT: 0.18,  unite: "comprime", expiryMonths: 24, ref: 4  },
  { nom: "Meloxicam 1.5mg/ml solution orale",           categorie: "medicament", quantiteStock: 4,  quantiteMinimum: 2,  quantiteMax: 8,   prixAchatHT: 18.90, unite: "flacon",   expiryMonths: 18, ref: 5  },
  { nom: "Maropitant (Cerenia) 16mg cp",                categorie: "medicament", quantiteStock: 24, quantiteMinimum: 10, quantiteMax: 40,  prixAchatHT: 4.20,  unite: "comprime", expiryMonths: 18, ref: 6  },
  { nom: "Cefovecin (Convenia) 80mg/ml inj",            categorie: "medicament", quantiteStock: 3,  quantiteMinimum: 2,  quantiteMax: 6,   prixAchatHT: 42.00, unite: "flacon",   expiryMonths: 12, ref: 7  },
  { nom: "Robenacoxib (Onsior) 6mg cp chat",            categorie: "medicament", quantiteStock: 18, quantiteMinimum: 8,  quantiteMax: 30,  prixAchatHT: 3.80,  unite: "comprime", expiryMonths: 18, ref: 8  },
  { nom: "Furosémide 40mg cp",                          categorie: "medicament", quantiteStock: 50, quantiteMinimum: 20, quantiteMax: 80,  prixAchatHT: 0.12,  unite: "comprime", expiryMonths: 24, ref: 9  },
  { nom: "Oméprazole 20mg gélule",                      categorie: "medicament", quantiteStock: 35, quantiteMinimum: 15, quantiteMax: 60,  prixAchatHT: 0.28,  unite: "comprime", expiryMonths: 24, ref: 10 },
  { nom: "Tramadol 50mg cp",                            categorie: "medicament", quantiteStock: 40, quantiteMinimum: 20, quantiteMax: 70,  prixAchatHT: 0.22,  unite: "comprime", expiryMonths: 24, ref: 11 },
  { nom: "Kétamine 500mg/10ml inj",                     categorie: "medicament", quantiteStock: 1,  quantiteMinimum: 2,  quantiteMax: 8,   prixAchatHT: 28.50, unite: "flacon",   expiryMonths: 12, ref: 12 },
  { nom: "Propofol 200mg/20ml inj",                     categorie: "medicament", quantiteStock: 2,  quantiteMinimum: 3,  quantiteMax: 10,  prixAchatHT: 14.80, unite: "flacon",   expiryMonths: 6,  ref: 13 },
  { nom: "Médétomidine 1mg/ml inj",                     categorie: "medicament", quantiteStock: 4,  quantiteMinimum: 2,  quantiteMax: 6,   prixAchatHT: 32.00, unite: "flacon",   expiryMonths: 12, ref: 14 },
  { nom: "Butorphanol 10mg/ml inj",                     categorie: "medicament", quantiteStock: 3,  quantiteMinimum: 2,  quantiteMax: 5,   prixAchatHT: 38.00, unite: "flacon",   expiryMonths: 12, ref: 15 },

  // ── VACCINS ───────────────────────────────────────────────────────
  { nom: "Eurican DHPPI2-L",          categorie: "vaccin", quantiteStock: 12, quantiteMinimum: 5, quantiteMax: 20, prixAchatHT: 8.20,  unite: "flacon", expiryMonths: 12, ref: 16 },
  { nom: "Eurican DHPPI2-LR",         categorie: "vaccin", quantiteStock: 8,  quantiteMinimum: 4, quantiteMax: 15, prixAchatHT: 11.50, unite: "flacon", expiryMonths: 12, ref: 17 },
  { nom: "Feligen CRP",               categorie: "vaccin", quantiteStock: 15, quantiteMinimum: 6, quantiteMax: 25, prixAchatHT: 6.80,  unite: "flacon", expiryMonths: 12, ref: 18 },
  { nom: "Purevax RCPCh",             categorie: "vaccin", quantiteStock: 10, quantiteMinimum: 5, quantiteMax: 18, prixAchatHT: 9.40,  unite: "flacon", expiryMonths: 10, ref: 19 },
  { nom: "Nobivac Rabies",            categorie: "vaccin", quantiteStock: 20, quantiteMinimum: 8, quantiteMax: 30, prixAchatHT: 4.90,  unite: "flacon", expiryMonths: 18, ref: 20 },
  { nom: "Leucorifelin",              categorie: "vaccin", quantiteStock: 8,  quantiteMinimum: 4, quantiteMax: 12, prixAchatHT: 12.30, unite: "flacon", expiryMonths: 12, ref: 21 },
  { nom: "Nobivac Myxo-RHD Plus",    categorie: "vaccin", quantiteStock: 6,  quantiteMinimum: 3, quantiteMax: 10, prixAchatHT: 7.60,  unite: "flacon", expiryMonths: 14, ref: 22 },
  { nom: "Protek 4",                  categorie: "vaccin", quantiteStock: 5,  quantiteMinimum: 2, quantiteMax: 8,  prixAchatHT: 15.40, unite: "flacon", expiryMonths: 10, ref: 23 },

  // ── ANTIPARASITAIRES ──────────────────────────────────────────────
  { nom: "Nexgard Spectra chien M 7-15kg",  categorie: "antiparasitaire", quantiteStock: 18, quantiteMinimum: 8,  quantiteMax: 30, prixAchatHT: 9.80,  unite: "boite", expiryMonths: 24, ref: 24 },
  { nom: "Nexgard Spectra chien L 15-30kg", categorie: "antiparasitaire", quantiteStock: 15, quantiteMinimum: 6,  quantiteMax: 25, prixAchatHT: 11.20, unite: "boite", expiryMonths: 24, ref: 25 },
  { nom: "Bravecto chien M 10-20kg",        categorie: "antiparasitaire", quantiteStock: 10, quantiteMinimum: 4,  quantiteMax: 16, prixAchatHT: 22.50, unite: "boite", expiryMonths: 24, ref: 26 },
  { nom: "Stronghold Plus chat 2.5-7.5kg",  categorie: "antiparasitaire", quantiteStock: 20, quantiteMinimum: 8,  quantiteMax: 35, prixAchatHT: 7.40,  unite: "boite", expiryMonths: 24, ref: 27 },
  { nom: "Broadline chat",                  categorie: "antiparasitaire", quantiteStock: 16, quantiteMinimum: 6,  quantiteMax: 28, prixAchatHT: 8.90,  unite: "boite", expiryMonths: 24, ref: 28 },
  { nom: "Milbemax chien cp",               categorie: "antiparasitaire", quantiteStock: 24, quantiteMinimum: 10, quantiteMax: 40, prixAchatHT: 2.80,  unite: "comprime", expiryMonths: 24, ref: 29 },
  { nom: "Milbemax chat cp",                categorie: "antiparasitaire", quantiteStock: 20, quantiteMinimum: 8,  quantiteMax: 35, prixAchatHT: 2.60,  unite: "comprime", expiryMonths: 24, ref: 30 },

  // ── PERFUSIONS & SOLUTÉS ──────────────────────────────────────────
  { nom: "NaCl 0.9% 500ml",     categorie: "perfusion", quantiteStock: 24, quantiteMinimum: 12, quantiteMax: 40, prixAchatHT: 2.10, unite: "flacon", expiryMonths: 24, ref: 31 },
  { nom: "Ringer Lactate 500ml", categorie: "perfusion", quantiteStock: 18, quantiteMinimum: 10, quantiteMax: 30, prixAchatHT: 2.40, unite: "flacon", expiryMonths: 24, ref: 32 },
  { nom: "Glucose 5% 500ml",     categorie: "perfusion", quantiteStock: 12, quantiteMinimum: 6,  quantiteMax: 20, prixAchatHT: 2.20, unite: "flacon", expiryMonths: 24, ref: 33 },
  { nom: "NaCl 0.9% 1000ml",     categorie: "perfusion", quantiteStock: 10, quantiteMinimum: 4,  quantiteMax: 16, prixAchatHT: 3.50, unite: "flacon", expiryMonths: 24, ref: 34 },
  { nom: "Plasma-Lyte 500ml",    categorie: "perfusion", quantiteStock: 6,  quantiteMinimum: 3,  quantiteMax: 10, prixAchatHT: 8.90, unite: "flacon", expiryMonths: 18, ref: 35 },

  // ── CONSOMMABLES ──────────────────────────────────────────────────
  { nom: "Seringues 5ml (boîte 100)",          categorie: "consommable", quantiteStock: 8,  quantiteMinimum: 3, quantiteMax: 12, prixAchatHT: 6.50,  unite: "boite", expiryMonths: 36, ref: 36 },
  { nom: "Aiguilles 21G (boîte 100)",          categorie: "consommable", quantiteStock: 10, quantiteMinimum: 4, quantiteMax: 15, prixAchatHT: 4.80,  unite: "boite", expiryMonths: 36, ref: 37 },
  { nom: "Cathéters IV 22G (boîte 50)",        categorie: "consommable", quantiteStock: 5,  quantiteMinimum: 2, quantiteMax: 8,  prixAchatHT: 18.50, unite: "boite", expiryMonths: 36, ref: 38 },
  { nom: "Compresses stériles 10x10 (boîte 100)", categorie: "consommable", quantiteStock: 12, quantiteMinimum: 5, quantiteMax: 20, prixAchatHT: 7.20, unite: "boite", expiryMonths: 36, ref: 39 },
  { nom: "Gants latex M (boîte 100)",          categorie: "consommable", quantiteStock: 6,  quantiteMinimum: 2, quantiteMax: 10, prixAchatHT: 8.90,  unite: "boite", expiryMonths: 36, ref: 40 },
];

export async function runStockSeeder(force = false): Promise<{ inserted: number; lots: number; alertes: number }> {
  const existing = await db.select({ id: stockMedicamentsTable.id }).from(stockMedicamentsTable).limit(1);
  if (existing.length > 0 && !force) {
    return { inserted: 0, lots: 0, alertes: 0 };
  }

  if (force && existing.length > 0) {
    // Get ALL existing IDs for proper cascade deletion
    const allIds = (await db.select({ id: stockMedicamentsTable.id }).from(stockMedicamentsTable)).map(r => r.id);
    if (allIds.length > 0) {
      await db.delete(alertesStockTable).where(inArray(alertesStockTable.medicamentId, allIds));
      await db.delete(mouvementsStockTable).where(inArray(mouvementsStockTable.medicamentId, allIds));
      await db.delete(lignesCommandeTable).where(inArray(lignesCommandeTable.medicamentId, allIds));
      await db.delete(stockLotsTable).where(inArray(stockLotsTable.medicamentId, allIds));
      await db.delete(stockMedicamentsTable);
    }
  }

  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const today = now.toISOString().split("T")[0]!;

  const inserted: { id: number; ref: number }[] = [];

  for (const p of PRODUITS) {
    const prixVente = parseFloat((p.prixAchatHT * 1.5 * 1.2).toFixed(2));
    const pointCommande = Math.ceil(p.quantiteMinimum * 1.5);
    const expiryDate = addMonths(p.expiryMonths);

    const [row] = await db.insert(stockMedicamentsTable).values({
      nom: p.nom,
      categorie: p.categorie,
      quantiteStock: p.quantiteStock,
      quantiteMinimum: p.quantiteMinimum,
      quantiteMax: p.quantiteMax,
      pointCommande,
      prixAchatHT: p.prixAchatHT,
      prixVenteTTC: prixVente,
      tvaTaux: 20,
      referenceCentravet: cvRef(p.ref),
      fournisseurPrincipal: "CENTRAVET",
      fournisseur: "CENTRAVET",
      delaiLivraisonJours: 1,
      datePeremptionLot: expiryDate,
      unite: p.unite,
      actif: true,
    }).returning({ id: stockMedicamentsTable.id });

    inserted.push({ id: row.id, ref: p.ref });
  }

  // 3 stock_lots pour les 3 premiers médicaments
  const first3 = inserted.slice(0, 3);
  for (let i = 0; i < first3.length; i++) {
    const med = first3[i]!;
    const produit = PRODUITS[i]!;
    await db.insert(stockLotsTable).values({
      medicamentId: med.id,
      numeroLot: lotNum(ym, i + 1),
      datePeremption: addMonths(produit.expiryMonths),
      quantiteInitiale: produit.quantiteStock,
      quantiteRestante: produit.quantiteStock,
      dateReception: today,
    });
  }

  // Détecter anomalies et générer alertes
  const nbAlertes = await genererAlertes().catch(() => 0);

  return { inserted: inserted.length, lots: first3.length, alertes: nbAlertes };
}
