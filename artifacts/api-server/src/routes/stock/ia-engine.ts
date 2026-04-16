import { db } from "@workspace/db";
import {
  mouvementsStockTable, stockMedicamentsTable, commandesCentravetTable, lignesCommandeTable, alertesStockTable,
} from "@workspace/db";
import { eq, and, gte, lte, like, lt, sql, desc, asc } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { AI_MODEL, AI_MAX_TOKENS } from "../../lib/constants";

const ORDER_COST = 15;
const HOLDING_COST_RATE = 0.25;
const Z_95 = 1.65;
const ALPHA_SMOOTHING = 0.3;

interface StockMetrics {
  medicamentId: number;
  adcJournalier: number;
  ecartType: number;
  stockSecurite: number;
  pointCommande: number;
  eoq: number;
  quantiteMax: number;
  quantiteMin: number;
  hasData: boolean;
}

export async function calculateStockMetrics(
  medicamentId: number,
  leadTimeDays: number,
  prixAchatHT: number,
): Promise<StockMetrics> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const mouvements = await db
    .select()
    .from(mouvementsStockTable)
    .where(and(
      eq(mouvementsStockTable.medicamentId, medicamentId),
      gte(mouvementsStockTable.createdAt, ninetyDaysAgo),
      like(mouvementsStockTable.typeMouvement, "sortie_%"),
    ))
    .orderBy(mouvementsStockTable.createdAt);

  if (mouvements.length === 0) {
    return {
      medicamentId, adcJournalier: 0, ecartType: 0, stockSecurite: 0,
      pointCommande: 0, eoq: 0, quantiteMax: 0, quantiteMin: 0, hasData: false,
    };
  }

  // Build daily consumption map
  const consoParJour: Map<string, number> = new Map();
  for (const m of mouvements) {
    const date = m.createdAt.toISOString().split("T")[0];
    const qty = Math.abs(m.quantite ?? 0);
    consoParJour.set(date, (consoParJour.get(date) ?? 0) + qty);
  }

  // Exponential smoothing ADC
  const dailyValues = Array.from(consoParJour.values());
  let adc = dailyValues[0] ?? 0;
  for (let i = 1; i < dailyValues.length; i++) {
    adc = ALPHA_SMOOTHING * dailyValues[i] + (1 - ALPHA_SMOOTHING) * adc;
  }

  // Standard deviation over 90 days (count all days including zeros)
  const totalDays = 90;
  const allDays: number[] = Array(totalDays).fill(0);
  dailyValues.forEach((v, i) => { allDays[i] = v; });
  const mean = allDays.reduce((s, v) => s + v, 0) / totalDays;
  const variance = allDays.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / totalDays;
  const sigma = Math.sqrt(variance);

  // Safety stock (95% service level)
  const stockSecurite = Z_95 * sigma * Math.sqrt(leadTimeDays);

  // Reorder point
  const pointCommande = adc * leadTimeDays + stockSecurite;

  // EOQ — √(2 × annual_demand × order_cost / holding_cost_rate × unit_price)
  const annualDemand = adc * 365;
  const unitPrice = prixAchatHT || 5;
  const eoq = unitPrice > 0
    ? Math.sqrt((2 * annualDemand * ORDER_COST) / (HOLDING_COST_RATE * unitPrice))
    : annualDemand / 12;

  const quantiteMax = pointCommande + eoq;
  const quantiteMin = Math.ceil(stockSecurite);

  return {
    medicamentId,
    adcJournalier: Math.round(adc * 100) / 100,
    ecartType: Math.round(sigma * 100) / 100,
    stockSecurite: Math.round(stockSecurite * 10) / 10,
    pointCommande: Math.round(pointCommande * 10) / 10,
    eoq: Math.round(eoq * 10) / 10,
    quantiteMax: Math.round(quantiteMax * 10) / 10,
    quantiteMin,
    hasData: true,
  };
}

export async function analyserConsommationTous(): Promise<{
  updated: number;
  metrics: StockMetrics[];
}> {
  const medicaments = await db
    .select()
    .from(stockMedicamentsTable)
    .where(eq(stockMedicamentsTable.actif, true));

  const metrics: StockMetrics[] = [];
  let updated = 0;

  for (const med of medicaments) {
    const m = await calculateStockMetrics(
      med.id,
      med.delaiLivraisonJours ?? 1,
      med.prixAchatHT ?? 5,
    );
    metrics.push(m);

    if (m.hasData) {
      await db.update(stockMedicamentsTable)
        .set({
          pointCommande: m.pointCommande,
          quantiteMin: m.quantiteMin,
          quantiteMax: m.quantiteMax,
          quantiteCommandeOptimale: m.eoq,
        })
        .where(eq(stockMedicamentsTable.id, med.id));
      updated++;
    }
  }

  return { updated, metrics };
}

export async function genererCommandeSuggereIA(): Promise<{
  commandeId: number;
  numeroCommande: string;
  lignes: any[];
  notesIA: string;
}> {
  const medicaments = await db
    .select()
    .from(stockMedicamentsTable)
    .where(and(eq(stockMedicamentsTable.actif, true)));

  const aCommanderRaw = medicaments.filter(m => {
    const seuil = m.pointCommande ?? m.quantiteMinimum ?? 5;
    return (m.quantiteStock ?? 0) <= seuil;
  });

  if (aCommanderRaw.length === 0) {
    throw new Error("Aucun médicament ne nécessite de commande actuellement.");
  }

  const lignesData = aCommanderRaw.map(m => {
    const stockActuel = m.quantiteStock ?? 0;
    const qMax = m.quantiteMax ?? (m.quantiteMinimum ?? 5) * 3;
    const eoq = m.quantiteCommandeOptimale ?? Math.max(qMax - stockActuel, 1);
    const qACommander = Math.max(Math.ceil(eoq), 1);
    return {
      medicamentId: m.id,
      nom: m.nom,
      referenceCentravet: m.referenceCentravet ?? m.reference ?? "",
      categorie: m.categorie ?? "medicament",
      stockActuel,
      pointCommande: m.pointCommande ?? m.quantiteMinimum ?? 5,
      quantiteCommandee: qACommander,
      prixUnitaireHT: m.prixAchatHT ?? 0,
      unite: m.unite ?? "unité",
      fournisseur: m.fournisseurPrincipal ?? "CENTRAVET",
    };
  });

  const totalHT = lignesData.reduce((s, l) => s + l.quantiteCommandee * l.prixUnitaireHT, 0);

  const prompt = `Tu es un expert en gestion de stock vétérinaire JIT (Just-In-Time). Analyse cette commande générée par l'algorithme EOQ et fournis:

1. Une validation de la pertinence de chaque ligne de commande
2. Des ajustements suggérés si nécessaire (saisonnalité, promotions CENTRAVET, péremptions à venir)
3. Un résumé de la commande avec priorités (CRITIQUE, URGENT, NORMAL)
4. Des conseils pour optimiser les coûts

COMMANDE GÉNÉRÉE (${lignesData.length} produits) :
${JSON.stringify(lignesData.map(l => ({
  produit: l.nom,
  categorie: l.categorie,
  stockActuel: l.stockActuel,
  pointCommande: l.pointCommande,
  qACommander: l.quantiteCommandee,
  unite: l.unite,
  montantHT: (l.quantiteCommandee * l.prixUnitaireHT).toFixed(2) + "€",
})), null, 2)}

MONTANT TOTAL ESTIMÉ : ${totalHT.toFixed(2)} € HT

Réponds en français, de façon concise et directement actionnable pour une ASV. Format: analyse par produit + recommandations globales.`;

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: AI_MAX_TOKENS.short,
    messages: [{ role: "user", content: prompt }],
  });

  const notesIA = message.content[0].type === "text" ? message.content[0].text.trim() : "Analyse IA indisponible";

  // Generate order number
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const existing = await db.select({ id: commandesCentravetTable.id })
    .from(commandesCentravetTable)
    .where(like(commandesCentravetTable.numeroCommande, `CMD-${yearMonth}-%`));
  const seq = String(existing.length + 1).padStart(4, "0");
  const numeroCommande = `CMD-${yearMonth}-${seq}`;

  const dateLivraisonPrevue = new Date();
  dateLivraisonPrevue.setDate(dateLivraisonPrevue.getDate() + 1);

  const [commande] = await db.insert(commandesCentravetTable).values({
    numeroCommande,
    statut: "brouillon",
    typeDeclenchement: "ia_automatique",
    montantTotalHT: Math.round(totalHT * 100) / 100,
    dateLivraisonPrevue: dateLivraisonPrevue.toISOString().split("T")[0],
    notesIA,
  }).returning();

  const lignes = await db.insert(lignesCommandeTable).values(
    lignesData.map(l => ({
      commandeId: commande.id,
      medicamentId: l.medicamentId,
      quantiteCommandee: l.quantiteCommandee,
      prixUnitaireHT: l.prixUnitaireHT,
      referenceCentravet: l.referenceCentravet,
      statutLigne: "en_attente" as const,
    }))
  ).returning();

  return { commandeId: commande.id, numeroCommande, lignes, notesIA };
}

export async function genererAlertes(): Promise<number> {
  const { alertesStockTable } = await import("@workspace/db");

  const medicaments = await db.select().from(stockMedicamentsTable).where(eq(stockMedicamentsTable.actif, true));
  const today = new Date();
  const in30Days = new Date(); in30Days.setDate(today.getDate() + 30);
  const in90Days = new Date(); in90Days.setDate(today.getDate() + 90);

  let count = 0;

  for (const m of medicaments) {
    const stock = m.quantiteStock ?? 0;
    const min = m.quantiteMinimum ?? 5;
    const pointCmd = m.pointCommande ?? min;
    const max = m.quantiteMax ?? min * 3;

    // Rupture
    if (stock === 0) {
      await db.insert(alertesStockTable).values({
        medicamentId: m.id,
        typeAlerte: "rupture",
        niveauUrgence: "critique",
        message: `RUPTURE : ${m.nom} - stock à 0 (minimum requis: ${min})`,
        estTraitee: false,
      });
      count++;
    } else if (stock <= pointCmd) {
      await db.insert(alertesStockTable).values({
        medicamentId: m.id,
        typeAlerte: "stock_bas",
        niveauUrgence: stock <= min ? "critique" : "warning",
        message: `Stock bas : ${m.nom} — ${stock} ${m.unite ?? "unités"} (point commande: ${pointCmd})`,
        estTraitee: false,
      });
      count++;
    }

    // Surstockage
    if (max && stock > max * 1.5) {
      await db.insert(alertesStockTable).values({
        medicamentId: m.id,
        typeAlerte: "surstockage",
        niveauUrgence: "info",
        message: `Surstockage : ${m.nom} — ${stock} ${m.unite ?? "unités"} (max recommandé: ${max})`,
        estTraitee: false,
      });
      count++;
    }

    // Peremption
    const datePerem = m.datePeremptionLot ?? m.datePeremption;
    if (datePerem) {
      const dPerem = new Date(datePerem);
      if (dPerem <= in30Days) {
        await db.insert(alertesStockTable).values({
          medicamentId: m.id,
          typeAlerte: "peremption_30j",
          niveauUrgence: dPerem <= today ? "critique" : "warning",
          message: `Peremption imminente : ${m.nom} — expire le ${dPerem.toLocaleDateString("fr-FR")}`,
          estTraitee: false,
        });
        count++;
      } else if (dPerem <= in90Days) {
        await db.insert(alertesStockTable).values({
          medicamentId: m.id,
          typeAlerte: "peremption_proche",
          niveauUrgence: "warning",
          message: `Peremption proche : ${m.nom} — expire le ${dPerem.toLocaleDateString("fr-FR")}`,
          estTraitee: false,
        });
        count++;
      }
    }
  }

  return count;
}

// ──────────────────────────────────────────────────────────
// DÉTECTION D'ANOMALIES IA
// ──────────────────────────────────────────────────────────
export interface Anomalie {
  medicamentId?: number;
  nomMedicament?: string;
  typeAnomalie: string;
  niveauUrgence: "critique" | "warning" | "info";
  detail: string;
  valeurActuelle?: number;
  valeurReference?: number;
}

export async function detecterAnomalies(): Promise<Anomalie[]> {
  const anomalies: Anomalie[] = [];
  const medicaments = await db.select().from(stockMedicamentsTable);
  const today = new Date();
  const in30Days = new Date(); in30Days.setDate(today.getDate() + 30);
  const avant60Jours = new Date(); avant60Jours.setDate(today.getDate() - 60);
  const avant7Jours = new Date(); avant7Jours.setDate(today.getDate() - 7);
  const avant90Jours = new Date(); avant90Jours.setDate(today.getDate() - 90);

  for (const m of medicaments) {
    // 1. Stock négatif (erreur de données)
    if ((m.quantiteStock ?? 0) < 0) {
      const a: Anomalie = {
        medicamentId: m.id, nomMedicament: m.nom, typeAnomalie: "stock_negatif",
        niveauUrgence: "critique",
        detail: `Stock négatif détecté : ${m.quantiteStock} ${m.unite ?? "unités"} — erreur de données à corriger`,
        valeurActuelle: m.quantiteStock ?? 0,
      };
      anomalies.push(a);
      await db.insert(alertesStockTable).values({
        medicamentId: m.id, typeAlerte: "rupture", niveauUrgence: "critique",
        message: `ANOMALIE : Stock négatif (${m.quantiteStock}) pour ${m.nom} — correction requise`,
        estTraitee: false,
      });
    }

    // 2. Pic de consommation >300% de la moyenne
    const mvts7j = await db.select({ qte: sql<number>`ABS(SUM(${mouvementsStockTable.quantite}))` })
      .from(mouvementsStockTable)
      .where(and(
        eq(mouvementsStockTable.medicamentId, m.id),
        gte(mouvementsStockTable.createdAt, avant7Jours),
        like(mouvementsStockTable.typeMouvement, "sortie_%"),
      ));
    const mvts90j = await db.select({ qte: sql<number>`ABS(SUM(${mouvementsStockTable.quantite}))` })
      .from(mouvementsStockTable)
      .where(and(
        eq(mouvementsStockTable.medicamentId, m.id),
        gte(mouvementsStockTable.createdAt, avant90Jours),
        like(mouvementsStockTable.typeMouvement, "sortie_%"),
      ));
    const conso7j = Number(mvts7j[0]?.qte ?? 0);
    const moy7jSur90 = Number(mvts90j[0]?.qte ?? 0) / 90 * 7;
    if (moy7jSur90 > 0 && conso7j > moy7jSur90 * 3) {
      const a: Anomalie = {
        medicamentId: m.id, nomMedicament: m.nom, typeAnomalie: "pic_consommation",
        niveauUrgence: "warning",
        detail: `Pic de consommation : ${conso7j.toFixed(1)} unités en 7j (moyenne attendue : ${moy7jSur90.toFixed(1)}) — +${Math.round(conso7j / moy7jSur90 * 100 - 100)}%`,
        valeurActuelle: conso7j, valeurReference: moy7jSur90,
      };
      anomalies.push(a);
      await db.insert(alertesStockTable).values({
        medicamentId: m.id, typeAlerte: "commande_suggeree", niveauUrgence: "warning",
        message: `Pic de consommation : ${m.nom} — ${conso7j.toFixed(0)} unités/7j vs moyenne ${moy7jSur90.toFixed(0)}`,
        estTraitee: false,
      });
    }

    // 3. Péremption <30j avec stock élevé (>15j de stock restant)
    const datePerem = m.datePeremptionLot ?? m.datePeremption;
    if (datePerem) {
      const dPerem = new Date(datePerem);
      const adc = m.quantiteStock && m.quantiteStock > 0 ? (m.quantiteStock ?? 0) : 0;
      const joursRestants = Math.floor((dPerem.getTime() - today.getTime()) / 86400000);
      if (joursRestants > 0 && joursRestants <= 30 && adc > 15) {
        const a: Anomalie = {
          medicamentId: m.id, nomMedicament: m.nom, typeAnomalie: "peremption_stock_eleve",
          niveauUrgence: "warning",
          detail: `Péremption dans ${joursRestants}j mais stock élevé (${m.quantiteStock} ${m.unite ?? "unités"}) — risque de perte`,
          valeurActuelle: m.quantiteStock ?? 0, valeurReference: joursRestants,
        };
        anomalies.push(a);
        await db.insert(alertesStockTable).values({
          medicamentId: m.id, typeAlerte: "peremption_30j", niveauUrgence: "warning",
          message: `Risque de perte : ${m.nom} expire dans ${joursRestants}j avec ${m.quantiteStock} ${m.unite ?? "unités"} en stock`,
          estTraitee: false,
        });
      }
    }

    // 4. Stock mort — aucun mouvement depuis >60 jours
    const dernierMvt = await db.select({ date: mouvementsStockTable.createdAt })
      .from(mouvementsStockTable)
      .where(eq(mouvementsStockTable.medicamentId, m.id))
      .orderBy(desc(mouvementsStockTable.createdAt))
      .limit(1);

    const stockActuel = m.quantiteStock ?? 0;
    const pasDeHistorique = dernierMvt.length === 0;
    const sansMouvement = dernierMvt.length > 0 && dernierMvt[0].date < avant60Jours;

    if (stockActuel > 0 && (pasDeHistorique || sansMouvement)) {
      const joursInactif = pasDeHistorique ? 99 : Math.floor((today.getTime() - dernierMvt[0].date.getTime()) / 86400000);
      const a: Anomalie = {
        medicamentId: m.id, nomMedicament: m.nom, typeAnomalie: "stock_mort",
        niveauUrgence: "info",
        detail: `Stock mort : ${m.nom} — ${stockActuel} ${m.unite ?? "unités"} sans mouvement depuis ${joursInactif}j`,
        valeurActuelle: stockActuel, valeurReference: joursInactif,
      };
      anomalies.push(a);
      await db.insert(alertesStockTable).values({
        medicamentId: m.id, typeAlerte: "surstockage", niveauUrgence: "info",
        message: `Stock mort : ${m.nom} — ${stockActuel} ${m.unite ?? "unités"} immobiles depuis ${joursInactif}j`,
        estTraitee: false,
      });
    }
  }

  return anomalies;
}

// ──────────────────────────────────────────────────────────
// FEFO DECREMENT — sortie stock consultation
// ──────────────────────────────────────────────────────────
export async function decrementerConsultationFEFO(
  consultationId: number,
  factureLignes: Array<{ nom: string; quantite: number; ean?: string }>,
): Promise<Array<{ nom: string; medicamentId?: number; qtePrise: number; alerteCreee: boolean; notFound?: boolean }>> {
  const { stockLotsTable } = await import("@workspace/db");
  const resultats = [];

  for (const ligne of factureLignes) {
    const { nom, quantite, ean } = ligne;
    let qtePrise = 0;
    let alerteCreee = false;

    // Find medicament by name (case-insensitive) or EAN
    const meds = await db.select().from(stockMedicamentsTable);
    const med = meds.find(m =>
      m.nom.toLowerCase().includes(nom.toLowerCase()) ||
      (ean && m.codeEan === ean)
    );

    if (!med) {
      resultats.push({ nom, qtePrise: 0, alerteCreee: false, notFound: true });
      continue;
    }

    let qteRestante = quantite;

    // FEFO: consommer par ordre d'expiration croissante
    const lots = await db.select().from(stockLotsTable)
      .where(and(
        eq(stockLotsTable.medicamentId, med.id),
        sql`${stockLotsTable.quantiteRestante} > 0`,
      ))
      .orderBy(asc(stockLotsTable.datePeremption));

    for (const lot of lots) {
      if (qteRestante <= 0) break;
      const dispo = lot.quantiteRestante ?? 0;
      const prise = Math.min(dispo, qteRestante);

      await db.update(stockLotsTable)
        .set({ quantiteRestante: dispo - prise })
        .where(eq(stockLotsTable.id, lot.id));

      qteRestante -= prise;
      qtePrise += prise;
    }

    // Si pas assez de lots, prendre sur stock global
    if (qteRestante > 0) qtePrise += qteRestante;

    // Décrémenter stock global
    const newQty = Math.max(0, (med.quantiteStock ?? 0) - quantite);
    await db.update(stockMedicamentsTable)
      .set({ quantiteStock: newQty })
      .where(eq(stockMedicamentsTable.id, med.id));

    // Enregistrer mouvement
    await db.insert(mouvementsStockTable).values({
      medicamentId: med.id,
      typeMouvement: "sortie_consultation",
      quantite: -quantite,
      consultationId,
      prixUnitaireHT: med.prixAchatHT ?? undefined,
      motif: `Consultation #${consultationId} — FEFO`,
    });

    // Mise à jour datePeremptionLot (prochain lot non vide)
    const lotsRestants = await db.select().from(stockLotsTable)
      .where(and(
        eq(stockLotsTable.medicamentId, med.id),
        sql`${stockLotsTable.quantiteRestante} > 0`,
      ))
      .orderBy(asc(stockLotsTable.datePeremption))
      .limit(1);

    if (lotsRestants.length > 0) {
      await db.update(stockMedicamentsTable)
        .set({ datePeremptionLot: lotsRestants[0].datePeremption })
        .where(eq(stockMedicamentsTable.id, med.id));
    }

    // Alerte si stock sous le point de commande
    if (newQty <= (med.pointCommande ?? med.quantiteMinimum ?? 5)) {
      await db.insert(alertesStockTable).values({
        medicamentId: med.id,
        typeAlerte: newQty === 0 ? "rupture" : "stock_bas",
        niveauUrgence: newQty === 0 ? "critique" : "warning",
        message: newQty === 0
          ? `RUPTURE après consultation #${consultationId} : ${med.nom}`
          : `Stock bas après consultation #${consultationId} : ${med.nom} — ${newQty} ${med.unite ?? "unités"} restants`,
        estTraitee: false,
      });
      alerteCreee = true;
    }

    resultats.push({ nom, medicamentId: med.id, qtePrise, alerteCreee, notFound: false });
  }

  return resultats;
}
