import { Router } from "express";
import { db } from "@workspace/db";
import { parametresCliniqueTable } from "@workspace/db";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(parametresCliniqueTable).limit(1);
    if (rows.length === 0) {
      return res.json({
        id: null,
        nomClinique: null,
        adresse: null,
        codePostal: null,
        ville: null,
        telephone: null,
        email: null,
        siteWeb: null,
        siret: null,
        numeroOrdre: null,
        numTVA: null,
        logoUrl: null,
        horaires: null,
        mentionsLegales: null,
      });
    }
    const row = rows[0];
    return res.json({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

router.put("/", async (req, res) => {
  try {
    const {
      nomClinique, adresse, codePostal, ville, telephone, email,
      siteWeb, siret, numeroOrdre, numTVA, logoUrl, horaires, mentionsLegales,
    } = req.body;

    const data = {
      nomClinique: nomClinique ?? null,
      adresse: adresse ?? null,
      codePostal: codePostal ?? null,
      ville: ville ?? null,
      telephone: telephone ?? null,
      email: email ?? null,
      siteWeb: siteWeb ?? null,
      siret: siret ?? null,
      numeroOrdre: numeroOrdre ?? null,
      numTVA: numTVA ?? null,
      logoUrl: logoUrl ?? null,
      horaires: horaires ?? null,
      mentionsLegales: mentionsLegales ?? null,
    };

    const existing = await db.select().from(parametresCliniqueTable).limit(1);
    let row;
    if (existing.length === 0) {
      [row] = await db.insert(parametresCliniqueTable).values(data).returning();
    } else {
      [row] = await db.update(parametresCliniqueTable).set(data).returning();
    }
    return res.json({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

export default router;
