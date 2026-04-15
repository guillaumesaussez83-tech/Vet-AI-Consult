import { Router } from "express";
import { db } from "@workspace/db";
import { stockMedicamentsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const stock = await db.select().from(stockMedicamentsTable).orderBy(asc(stockMedicamentsTable.nom));
    return res.json(stock);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { nom, reference, quantiteStock, quantiteMinimum, prixAchatHT, prixVenteTTC, fournisseur, datePeremption, emplacement, unite } = req.body;
    if (!nom) return res.status(400).json({ error: "Le nom est requis" });
    const [med] = await db.insert(stockMedicamentsTable).values({
      nom, reference, quantiteStock: quantiteStock ?? 0, quantiteMinimum: quantiteMinimum ?? 5,
      prixAchatHT, prixVenteTTC, fournisseur, datePeremption, emplacement, unite,
    }).returning();
    return res.status(201).json(med);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });
    const [med] = await db.update(stockMedicamentsTable).set(req.body).where(eq(stockMedicamentsTable.id, id)).returning();
    if (!med) return res.status(404).json({ error: "Médicament non trouvé" });
    return res.json(med);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });
    await db.delete(stockMedicamentsTable).where(eq(stockMedicamentsTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.patch("/:id/mouvement", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });
    const { delta } = req.body;
    if (typeof delta !== "number") return res.status(400).json({ error: "delta requis" });
    const [current] = await db.select().from(stockMedicamentsTable).where(eq(stockMedicamentsTable.id, id));
    if (!current) return res.status(404).json({ error: "Médicament non trouvé" });
    const newQty = Math.max(0, (current.quantiteStock ?? 0) + delta);
    const [updated] = await db.update(stockMedicamentsTable).set({ quantiteStock: newQty }).where(eq(stockMedicamentsTable.id, id)).returning();
    return res.json(updated);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

export default router;
