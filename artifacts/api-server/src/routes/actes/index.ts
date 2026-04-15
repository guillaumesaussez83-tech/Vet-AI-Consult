import { Router } from "express";
import { db } from "@workspace/db";
import { actesTable } from "@workspace/db";
import { CreateActeBody, UpdateActeParams, UpdateActeBody, DeleteActeParams } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const actes = await db.select().from(actesTable).orderBy(actesTable.nom);
    return res.json(actes);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = CreateActeBody.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Données invalides" });

    const [acte] = await db.insert(actesTable).values(body.data).returning();
    return res.status(201).json(acte);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const params = UpdateActeParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json({ error: "ID invalide" });

    const body = UpdateActeBody.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "Données invalides" });

    const [acte] = await db.update(actesTable).set(body.data).where(eq(actesTable.id, params.data.id)).returning();
    if (!acte) return res.status(404).json({ error: "Acte non trouvé" });

    return res.json(acte);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const params = DeleteActeParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json({ error: "ID invalide" });

    await db.delete(actesTable).where(eq(actesTable.id, params.data.id));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

export default router;
