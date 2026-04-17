import { Router } from "express";
import { db } from "@workspace/db";
import {
  stockMedicamentsTable, commandesCentravetTable, lignesCommandeTable,
  bonsLivraisonTable, mouvementsStockTable, alertesStockTable, stockLotsTable,
} from "@workspace/db";
import { eq, asc, desc, and, ne } from "drizzle-orm";
import { analyserConsommationTous, genererCommandeSuggereIA, genererAlertes, detecterAnomalies, decrementerConsultationFEFO } from "./ia-engine";
import { runStockSeeder } from "./seeder";

const router = Router();

// ──────────────────────────────────────────
// PRODUITS — CRUD
// ──────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const stock = await db.select().from(stockMedicamentsTable).orderBy(asc(stockMedicamentsTable.nom));
    return res.json(stock);
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur interne" }); }
});

router.post("/", async (req, res) => {
  try {
    const { nom, reference, referenceCentravet, codeEan, categorie, quantiteStock, quantiteMinimum,
      quantiteMax, pointCommande, prixAchatHT, prixVenteTTC, tvaTaux, fournisseur, fournisseurPrincipal,
      delaiLivraisonJours, datePeremption, datePeremptionLot, emplacement, unite, actif } = req.body;
    if (!nom) return res.status(400).json({ error: "Le nom est requis" });
    const [med] = await db.insert(stockMedicamentsTable).values({
      nom, reference, referenceCentravet, codeEan, categorie: categorie ?? "medicament",
      quantiteStock: quantiteStock ?? 0, quantiteMinimum: quantiteMinimum ?? 5,
      quantiteMax, pointCommande, prixAchatHT, prixVenteTTC, tvaTaux: tvaTaux ?? 20,
      fournisseur, fournisseurPrincipal: fournisseurPrincipal ?? "CENTRAVET",
      delaiLivraisonJours: delaiLivraisonJours ?? 1, datePeremption, datePeremptionLot, emplacement,
      unite: unite ?? "unité", actif: actif !== false,
    }).returning();
    return res.status(201).json(med);
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur interne" }); }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });
    const [med] = await db.update(stockMedicamentsTable).set(req.body).where(eq(stockMedicamentsTable.id, id)).returning();
    if (!med) return res.status(404).json({ error: "Médicament non trouvé" });
    return res.json(med);
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur interne" }); }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });
    await db.delete(stockMedicamentsTable).where(eq(stockMedicamentsTable.id, id));
    return res.status(204).send();
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur interne" }); }
});

router.patch("/:id/mouvement", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });
    const { delta, typeMouvement, motif, utilisateur } = req.body;
    if (typeof delta !== "number") return res.status(400).json({ error: "delta requis" });
    const [current] = await db.select().from(stockMedicamentsTable).where(eq(stockMedicamentsTable.id, id));
    if (!current) return res.status(404).json({ error: "Médicament non trouvé" });
    const newQty = Math.max(0, (current.quantiteStock ?? 0) + delta);
    const [updated] = await db.update(stockMedicamentsTable).set({ quantiteStock: newQty }).where(eq(stockMedicamentsTable.id, id)).returning();

    // Enregistrer le mouvement
    const type = delta > 0 ? "entree_reception" : (typeMouvement ?? "ajustement_inventaire");
    await db.insert(mouvementsStockTable).values({
      medicamentId: id,
      typeMouvement: type,
      quantite: delta,
      prixUnitaireHT: current.prixAchatHT ?? undefined,
      motif: motif ?? `Mouvement manuel: ${delta > 0 ? "+" : ""}${delta}`,
      utilisateur,
    });

    return res.json(updated);
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur interne" }); }
});

// ──────────────────────────────────────────
// MOUVEMENTS
// ──────────────────────────────────────────
router.get("/:id/mouvements", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });
    const mvts = await db.select().from(mouvementsStockTable)
      .where(eq(mouvementsStockTable.medicamentId, id))
      .orderBy(desc(mouvementsStockTable.createdAt))
      .limit(100);
    return res.json(mvts);
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur interne" }); }
});

router.post("/mouvements", async (req, res) => {
  try {
    const { medicamentId, typeMouvement, quantite, motif, utilisateur, prixUnitaireHT } = req.body;
    if (!medicamentId || !typeMouvement || typeof quantite !== "number") {
      return res.status(400).json({ error: "medicamentId, typeMouvement, quantite requis" });
    }
    const [mvt] = await db.insert(mouvementsStockTable).values({
      medicamentId: parseInt(medicamentId), typeMouvement, quantite, motif, utilisateur, prixUnitaireHT,
    }).returning();

    // Update stock quantity
    const [med] = await db.select().from(stockMedicamentsTable).where(eq(stockMedicamentsTable.id, parseInt(medicamentId)));
    if (med) {
      const newQty = Math.max(0, (med.quantiteStock ?? 0) + quantite);
      await db.update(stockMedicamentsTable).set({ quantiteStock: newQty }).where(eq(stockMedicamentsTable.id, parseInt(medicamentId)));
    }

    return res.status(201).json(mvt);
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur interne" }); }
});

// ──────────────────────────────────────────
// LOTS
// ──────────────────────────────────────────
router.get("/:id/lots", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });
    const lots = await db.select().from(stockLotsTable)
      .where(eq(stockLotsTable.medicamentId, id))
      .orderBy(asc(stockLotsTable.datePeremption));
    return res.json(lots);
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur interne" }); }
});

// ──────────────────────────────────────────
// IA ENGINE
// ──────────────────────────────────────────
router.post("/ia/analyser-consommation", async (req, res) => {
  try {
    const result = await analyserConsommationTous();
    return res.json(result);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de l'analyse IA" });
  }
});

router.post("/ia/generer-commande-suggeree", async (req, res) => {
  try {
    const result = await genererCommandeSuggereIA();
    return res.json(result);
  } catch (err: any) {
    req.log.error(err);
    if (err?.message?.includes("Aucun")) return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: "Erreur lors de la génération de commande IA" });
  }
});

router.post("/ia/detecter-anomalies", async (req, res) => {
  try {
    const anomalies = await detecterAnomalies();
    return res.json({ count: anomalies.length, anomalies });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors de la détection d'anomalies" });
  }
});

// ──────────────────────────────────────────
// COMMANDES
// ──────────────────────────────────────────
router.get("/commandes", async (req, res) => {
  try {
    const commandes = await db.select().from(commandesCentravetTable)
      .orderBy(desc(commandesCentravetTable.createdAt));
    return res.json(commandes);
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur interne" }); }
});

router.get("/commandes/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });
    const [commande] = await db.select().from(commandesCentravetTable).where(eq(commandesCentravetTable.id, id));
    if (!commande) return res.status(404).json({ error: "Commande non trouvée" });

    const lignes = await db
      .select({
        id: lignesCommandeTable.id,
        commandeId: lignesCommandeTable.commandeId,
        medicamentId: lignesCommandeTable.medicamentId,
        nomMedicament: stockMedicamentsTable.nom,
        referenceCentravet: lignesCommandeTable.referenceCentravet,
        quantiteCommandee: lignesCommandeTable.quantiteCommandee,
        quantiteRecue: lignesCommandeTable.quantiteRecue,
        prixUnitaireHT: lignesCommandeTable.prixUnitaireHT,
        statutLigne: lignesCommandeTable.statutLigne,
        lotNumero: lignesCommandeTable.lotNumero,
        datePeremptionRecu: lignesCommandeTable.datePeremptionRecu,
        ecartNotes: lignesCommandeTable.ecartNotes,
        unite: stockMedicamentsTable.unite,
      })
      .from(lignesCommandeTable)
      .leftJoin(stockMedicamentsTable, eq(lignesCommandeTable.medicamentId, stockMedicamentsTable.id))
      .where(eq(lignesCommandeTable.commandeId, id));

    return res.json({ ...commande, lignes });
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur interne" }); }
});

router.post("/commandes", async (req, res) => {
  try {
    const { typeDeclenchement, dateLivraisonPrevue, notesASV, lignes } = req.body;
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const existing = await db.select({ id: commandesCentravetTable.id })
      .from(commandesCentravetTable);
    const seq = String(existing.length + 1).padStart(4, "0");
    const numeroCommande = `CMD-${yearMonth}-${seq}`;

    const [commande] = await db.insert(commandesCentravetTable).values({
      numeroCommande,
      statut: "brouillon",
      typeDeclenchement: typeDeclenchement ?? "asv_manuel",
      dateLivraisonPrevue,
      notesASV,
    }).returning();

    if (Array.isArray(lignes) && lignes.length > 0) {
      await db.insert(lignesCommandeTable).values(
        lignes.map((l: any) => ({
          commandeId: commande.id,
          medicamentId: parseInt(l.medicamentId),
          quantiteCommandee: l.quantiteCommandee,
          prixUnitaireHT: l.prixUnitaireHT,
          referenceCentravet: l.referenceCentravet,
          statutLigne: "en_attente",
        }))
      );
    }

    return res.status(201).json(commande);
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur interne" }); }
});

router.patch("/commandes/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });
    const { statut, notesASV, dateLivraisonPrevue } = req.body;
    const updates: any = {};
    if (statut) updates.statut = statut;
    if (notesASV !== undefined) updates.notesASV = notesASV;
    if (dateLivraisonPrevue) updates.dateLivraisonPrevue = dateLivraisonPrevue;
    if (statut === "validee") updates.dateValidation = new Date();
    if (statut === "envoyee_centravet") updates.dateEnvoiCentravet = new Date();
    const [updated] = await db.update(commandesCentravetTable).set(updates).where(eq(commandesCentravetTable.id, id)).returning();
    return res.json(updated);
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur interne" }); }
});

router.patch("/commandes/:id/lignes/:ligneId", async (req, res) => {
  try {
    const ligneId = parseInt(req.params.ligneId);
    if (isNaN(ligneId)) return res.status(400).json({ error: "ID invalide" });
    const { quantiteRecue, statutLigne, lotNumero, datePeremptionRecu, ecartNotes } = req.body;
    const updates: any = {};
    if (quantiteRecue !== undefined) updates.quantiteRecue = quantiteRecue;
    if (statutLigne) updates.statutLigne = statutLigne;
    if (lotNumero !== undefined) updates.lotNumero = lotNumero;
    if (datePeremptionRecu !== undefined) updates.datePeremptionRecu = datePeremptionRecu;
    if (ecartNotes !== undefined) updates.ecartNotes = ecartNotes;
    const [updated] = await db.update(lignesCommandeTable).set(updates).where(eq(lignesCommandeTable.id, ligneId)).returning();
    return res.json(updated);
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur interne" }); }
});

router.get("/commandes/:id/export-csv", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });
    const [commande] = await db.select().from(commandesCentravetTable).where(eq(commandesCentravetTable.id, id));
    if (!commande) return res.status(404).json({ error: "Commande non trouvée" });

    const lignes = await db
      .select({
        referenceCentravet: lignesCommandeTable.referenceCentravet,
        nom: stockMedicamentsTable.nom,
        quantiteCommandee: lignesCommandeTable.quantiteCommandee,
        prixUnitaireHT: lignesCommandeTable.prixUnitaireHT,
      })
      .from(lignesCommandeTable)
      .leftJoin(stockMedicamentsTable, eq(lignesCommandeTable.medicamentId, stockMedicamentsTable.id))
      .where(eq(lignesCommandeTable.commandeId, id));

    let csv = "Reference CENTRAVET;Designation;Quantite;Prix unitaire HT\n";
    for (const l of lignes) {
      csv += `${l.referenceCentravet ?? ""};${l.nom ?? ""};${l.quantiteCommandee};${l.prixUnitaireHT ?? 0}\n`;
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="commande-${commande.numeroCommande}.csv"`);
    return res.send("\uFEFF" + csv);
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur interne" }); }
});

// ──────────────────────────────────────────
// RÉCEPTION
// ──────────────────────────────────────────
router.post("/reception", async (req, res) => {
  try {
    const { commandeId, numeroBL, dateLivraison, validePar, lignes } = req.body;
    if (!commandeId || !lignes?.length) {
      return res.status(400).json({ error: "commandeId et lignes requis" });
    }

    const [bl] = await db.insert(bonsLivraisonTable).values({
      commandeId: parseInt(commandeId),
      numeroBL,
      dateLivraison: dateLivraison ?? new Date().toISOString().split("T")[0],
      statut: "a_valider",
      validePar,
    }).returning();

    for (const ligne of lignes) {
      const { ligneId, medicamentId, quantiteRecue, lotNumero, datePeremption, statutLigne } = ligne;

      if (ligneId) {
        await db.update(lignesCommandeTable).set({
          quantiteRecue, lotNumero,
          datePeremptionRecu: datePeremption,
          statutLigne: statutLigne ?? (quantiteRecue > 0 ? "recue_complete" : "manquante"),
        }).where(eq(lignesCommandeTable.id, parseInt(ligneId)));
      }

      if (quantiteRecue > 0 && medicamentId) {
        const medId = parseInt(medicamentId);
        // Create lot
        if (datePeremption) {
          await db.insert(stockLotsTable).values({
            medicamentId: medId,
            numeroLot: lotNumero,
            datePeremption,
            quantiteInitiale: quantiteRecue,
            quantiteRestante: quantiteRecue,
            dateReception: dateLivraison ?? new Date().toISOString().split("T")[0],
            bonLivraisonId: bl.id,
          });

          // Update nearest expiry on product
          const lots = await db.select().from(stockLotsTable)
            .where(and(eq(stockLotsTable.medicamentId, medId)))
            .orderBy(asc(stockLotsTable.datePeremption));
          if (lots.length > 0) {
            await db.update(stockMedicamentsTable)
              .set({ datePeremptionLot: lots[0].datePeremption })
              .where(eq(stockMedicamentsTable.id, medId));
          }
        }

        // Record movement + update stock
        const [med] = await db.select().from(stockMedicamentsTable).where(eq(stockMedicamentsTable.id, medId));
        if (med) {
          await db.insert(mouvementsStockTable).values({
            medicamentId: medId,
            typeMouvement: "entree_reception",
            quantite: quantiteRecue,
            bonLivraisonId: bl.id,
            prixUnitaireHT: med.prixAchatHT ?? undefined,
            motif: `Réception BL ${numeroBL ?? bl.id} - lot ${lotNumero ?? ""}`,
            utilisateur: validePar,
          });
          await db.update(stockMedicamentsTable)
            .set({ quantiteStock: (med.quantiteStock ?? 0) + quantiteRecue })
            .where(eq(stockMedicamentsTable.id, medId));
        }
      }
    }

    // Check if all lines received → update order status
    const allLignes = await db.select().from(lignesCommandeTable).where(eq(lignesCommandeTable.commandeId, parseInt(commandeId)));
    const allDone = allLignes.every(l => l.statutLigne !== "en_attente");
    const anyPartial = allLignes.some(l => l.statutLigne === "recue_partielle" || l.statutLigne === "manquante");

    if (allDone) {
      await db.update(commandesCentravetTable)
        .set({ statut: anyPartial ? "livree_partielle" : "livree_complete" })
        .where(eq(commandesCentravetTable.id, parseInt(commandeId)));
    }

    return res.status(201).json({ bonLivraison: bl });
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur interne" }); }
});

// ──────────────────────────────────────────
// ALERTES
// ──────────────────────────────────────────
router.get("/alertes", async (req, res) => {
  try {
    const { traitee } = req.query;
    const alertes = await db
      .select({
        id: alertesStockTable.id,
        typeAlerte: alertesStockTable.typeAlerte,
        niveauUrgence: alertesStockTable.niveauUrgence,
        message: alertesStockTable.message,
        estTraitee: alertesStockTable.estTraitee,
        createdAt: alertesStockTable.createdAt,
        medicamentId: alertesStockTable.medicamentId,
        nomMedicament: stockMedicamentsTable.nom,
      })
      .from(alertesStockTable)
      .leftJoin(stockMedicamentsTable, eq(alertesStockTable.medicamentId, stockMedicamentsTable.id))
      .where(traitee === "true" ? eq(alertesStockTable.estTraitee, true) : traitee === "false" ? eq(alertesStockTable.estTraitee, false) : undefined)
      .orderBy(desc(alertesStockTable.createdAt))
      .limit(200);
    return res.json(alertes);
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur interne" }); }
});

router.post("/alertes/generer", async (req, res) => {
  try {
    const count = await genererAlertes();
    return res.json({ count, message: `${count} alertes générées` });
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur interne" }); }
});

router.patch("/alertes/:id/traiter", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });
    const [updated] = await db.update(alertesStockTable).set({ estTraitee: true }).where(eq(alertesStockTable.id, id)).returning();
    return res.json(updated);
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur interne" }); }
});

// ──────────────────────────────────────────
// DÉCRÉMENT CONSULTATION — FEFO
// ──────────────────────────────────────────
router.post("/decrementer-consultation", async (req, res) => {
  try {
    const { consultationId, factureLignes } = req.body;
    if (!consultationId || !Array.isArray(factureLignes) || factureLignes.length === 0) {
      return res.status(400).json({ error: "consultationId et factureLignes requis" });
    }
    const resultats = await decrementerConsultationFEFO(parseInt(consultationId), factureLignes);
    const nonTrouves = resultats.filter(r => r.notFound).map(r => r.nom);
    return res.json({
      resultats,
      nonTrouvesDansStock: nonTrouves,
      message: `${resultats.filter(r => !r.notFound).length} produits décrémentés (FEFO). ${nonTrouves.length > 0 ? `Non trouvés : ${nonTrouves.join(", ")}` : ""}`,
    });
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur interne" }); }
});

// ──────────────────────────────────────────
// SEEDER DÉMO
// ──────────────────────────────────────────
router.post("/seeder/demo", async (req, res) => {
  try {
    const force = req.query.force === "1" || req.body.force === true;
    const result = await runStockSeeder(force);
    if (result.inserted === 0) {
      return res.json({ message: "Stock déjà initialisé — aucune donnée insérée.", ...result });
    }
    return res.json({
      message: `Stock initialisé : ${result.inserted} produits, ${result.lots} lots, ${result.alertes} alertes générées.`,
      ...result,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur lors du seeding du stock" });
  }
});

// ──────────────────────────────────────────
// EXPORT CENTRAVET TRANSNET (CSV)
// ──────────────────────────────────────────
router.post("/commandes/:id/exporter-centravet", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

    const [commande] = await db.select().from(commandesCentravetTable).where(eq(commandesCentravetTable.id, id));
    if (!commande) return res.status(404).json({ error: "Commande non trouvée" });

    const lignes = await db
      .select({
        referenceCentravet: lignesCommandeTable.referenceCentravet,
        nom: stockMedicamentsTable.nom,
        codeEan: stockMedicamentsTable.codeEan,
        quantiteCommandee: lignesCommandeTable.quantiteCommandee,
        prixUnitaireHT: lignesCommandeTable.prixUnitaireHT,
        unite: stockMedicamentsTable.unite,
      })
      .from(lignesCommandeTable)
      .leftJoin(stockMedicamentsTable, eq(lignesCommandeTable.medicamentId, stockMedicamentsTable.id))
      .where(eq(lignesCommandeTable.commandeId, id));

    // Format TransNet CENTRAVET — semicolon CSV, UTF-8 BOM
    const dateExport = new Date().toLocaleDateString("fr-FR");
    let csv = `Commande TransNet CENTRAVET;${commande.numeroCommande};${dateExport}\n`;
    csv += `Ref. Article;Designation;Code EAN;Quantite;Unite;Prix HT\n`;
    for (const l of lignes) {
      const ref = l.referenceCentravet ?? "";
      const nom = (l.nom ?? "").replace(/;/g, ",");
      const ean = l.codeEan ?? "";
      const qty = l.quantiteCommandee;
      const unite = l.unite ?? "unité";
      const prix = l.prixUnitaireHT != null ? l.prixUnitaireHT.toFixed(2).replace(".", ",") : "";
      csv += `${ref};${nom};${ean};${qty};${unite};${prix}\n`;
    }
    csv += `\nTotal lignes;${lignes.length};Montant total HT;${commande.montantTotalHT?.toFixed(2).replace(".", ",") ?? ""};\n`;

    // Mark as sent to CENTRAVET
    await db.update(commandesCentravetTable)
      .set({ statut: "envoyee_centravet", dateEnvoiCentravet: new Date() })
      .where(eq(commandesCentravetTable.id, id));

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="TransNet-${commande.numeroCommande}.csv"`);
    return res.send("\uFEFF" + csv);
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Erreur interne" }); }
});

router.get("/stupefiants/registre", async (req, res) => {
  try {
    const stupefiants = await db
      .select({ id: stockMedicamentsTable.id, nom: stockMedicamentsTable.nom, quantiteStock: stockMedicamentsTable.quantiteStock })
      .from(stockMedicamentsTable)
      .where(eq(stockMedicamentsTable.estStupefiant, true));

    if (stupefiants.length === 0) return res.json([]);

    const ids = stupefiants.map(s => s.id);
    const { inArray } = await import("drizzle-orm");

    const mouvements = await db
      .select()
      .from(mouvementsStockTable)
      .where(inArray(mouvementsStockTable.medicamentId, ids))
      .orderBy(asc(mouvementsStockTable.createdAt));

    const nomById: Record<number, string> = {};
    for (const s of stupefiants) nomById[s.id] = s.nom;

    const balances: Record<number, number> = {};
    const result = mouvements.map(m => {
      const medId = m.medicamentId;
      if (medId === null) return null;
      balances[medId] = (balances[medId] ?? 0) + m.quantite;
      return {
        ...m,
        nomProduit: nomById[medId] ?? "Inconnu",
        soldeCumule: balances[medId],
        createdAt: m.createdAt.toISOString(),
      };
    }).filter(Boolean);

    return res.json(result);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

export default router;
