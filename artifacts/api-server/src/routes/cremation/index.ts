import { Router } from "express";
import { requireAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { cremationPartnersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

// GET /api/cremation-partners
router.get("/", requireAuth(), async (req, res) => {
  try {
    const clinicId = req.auth?.sessionClaims?.clinicId as string | undefined;
    let rows;
    if (clinicId) {
      rows = await db.select().from(cremationPartnersTable)
        .where(and(eq(cremationPartnersTable.clinicId, clinicId), eq(cremationPartnersTable.active, true)));
    } else {
      rows = await db.select().from(cremationPartnersTable).where(eq(cremationPartnersTable.active, true));
    }
    res.json({ data: rows });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cremation-partners
router.post("/", requireAuth(), async (req, res) => {
  try {
    const { nom, adresse, telephone, email, tarifIndividuel, tarifCollectif, notes, clinicId } = req.body;
    if (!nom) return res.status(400).json({ error: "nom required" });
    const [row] = await db.insert(cremationPartnersTable)
      .values({ nom, adresse, telephone, email, tarifIndividuel, tarifCollectif, notes, clinicId: clinicId || "default", active: true })
      .returning();
    return res.status(201).json({ data: row });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/cremation-partners/:id
router.put("/:id", requireAuth(), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { nom, adresse, telephone, email, tarifIndividuel, tarifCollectif, notes, active } = req.body;
    const [row] = await db.update(cremationPartnersTable)
      .set({ nom, adresse, telephone, email, tarifIndividuel, tarifCollectif, notes, active, updatedAt: new Date() })
      .where(eq(cremationPartnersTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "Partner not found" });
    res.json({ data: row });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/cremation-partners/:id (soft delete)
router.delete("/:id", requireAuth(), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(cremationPartnersTable)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(cremationPartnersTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
