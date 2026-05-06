import { Router } from "express";
import { requireAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { actesTable } from "@workspace/db";
import { CreateActeBody, UpdateActeParams, UpdateActeBody, DeleteActeParams } from "@workspace/api-zod";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const actes = await db.select().from(actesTable)
      .where(eq(actesTable.clinicId, req.clinicId))
      .orderBy(actesTable.nom);
    return res.json(actes);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = CreateActeBody.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "DonnÃ©es invalides" });

    const [acte] = await db.insert(actesTable).values({ ...body.data, clinicId: req.clinicId }).returning();
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
    if (!body.success) return res.status(400).json({ error: "DonnÃ©es invalides" });

    const [acte] = await db.update(actesTable).set(body.data).where(and(
      eq(actesTable.id, params.data.id),
      eq(actesTable.clinicId, req.clinicId),
    )).returning();
    if (!acte) return res.status(404).json({ error: "Acte non trouvÃ©" });

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

    await db.delete(actesTable).where(and(
      eq(actesTable.id, params.data.id),
      eq(actesTable.clinicId, req.clinicId),
    ));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

// GET /api/actes/export-csv
router.get("/export-csv", requireAuth(), async (req, res) => {
  try {
    const rows = await db.select().from(actesTable);
    const header = "code,nom,categorie,prix_ht,tva_rate,description,unite";
    const csvRows = rows.map(r => [
      r.code, r.nom, r.categorie, r.prixDefault, r.tvaRate, r.description ?? "", r.unite
    ].map(v => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g,'""')}"` : s;
    }).join(","));
    const csv = [header, ...csvRows].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=catalogue-prix.csv");
    res.send(csv);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/actes/import-csv
router.post("/import-csv", requireAuth(), async (req, res) => {
  try {
    const { csv, clinicId: bodyClinicId } = req.body as { csv: string; clinicId?: string };
    const clinicId = bodyClinicId || (req.auth?.sessionClaims?.clinicId as string) || "default";
    if (!csv) return res.status(400).json({ error: "csv content required" });
    const lines = csv.trim().split("\n");
    if (lines.length < 2) return res.status(400).json({ error: "Header + data required" });
    const hdrs = lines[0].toLowerCase().split(",").map(h => h.trim());
    const codeIdx = hdrs.indexOf("code");
    const nomIdx = hdrs.indexOf("nom");
    const catIdx = hdrs.indexOf("categorie");
    const prixIdx = hdrs.findIndex(h => h.includes("prix"));
    const tvaIdx = hdrs.findIndex(h => h.includes("tva"));
    if (codeIdx < 0 || nomIdx < 0) return res.status(400).json({ error: "CSV must have code,nom" });
    let inserted = 0; let updated = 0;
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const cols = line.split(",").map(c => c.replace(/^"|"$/g, "").trim());
      const code = cols[codeIdx]; const nom = cols[nomIdx];
      if (!code || !nom) continue;
      const vals = {
        clinicId, code, nom,
        categorie: catIdx >= 0 ? cols[catIdx] || "General" : "General",
        prixDefault: prixIdx >= 0 ? parseFloat(cols[prixIdx]) || 0 : 0,
        tvaRate: tvaIdx >= 0 ? parseFloat(cols[tvaIdx]) || 20 : 20,
        unite: "U",
      };
      const ex = await db.select({ id: actesTable.id }).from(actesTable).where(eq(actesTable.code, code)).limit(1);
      if (ex.length > 0) { await db.update(actesTable).set(vals).where(eq(actesTable.code, code)); updated++; }
      else { await db.insert(actesTable).values(vals); inserted++; }
    }
    res.json({ success: true, inserted, updated });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
