import { Router } from "express";
import { requireAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { ventesTable, venteLignesTable, insertVenteSchema, insertVenteLigneSchema } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { sendSuccess, sendError } from "../../lib/response";
import { extractClinicId } from "../../middlewares/extractClinic";
import { generateVenteNumero } from "../../lib/numbering";

const router = Router();
router.use(requireAuth());

// GET /api/ventes?type=comptoir|prescription
router.get("/", extractClinicId, async (req, res) => {
  try {
    const clinicId = req.clinicId!;
    const type = req.query.type as string | undefined;
    const conditions = [eq(ventesTable.clinicId, clinicId)];
    if (type === "comptoir" || type === "prescription") {
      conditions.push(eq(ventesTable.type, type));
    }
    const ventes = await db
      .select()
      .from(ventesTable)
      .where(and(...conditions))
      .orderBy(desc(ventesTable.date));
    return sendSuccess(res, ventes);
  } catch (err) {
    return sendError(res, 500, "Erreur lors de la récupération des ventes", err);
  }
});

// GET /api/ventes/:id
router.get("/:id", extractClinicId, async (req, res) => {
  try {
    const clinicId = req.clinicId!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return sendError(res, 400, "ID invalide");
    const [vente] = await db
      .select()
      .from(ventesTable)
      .where(and(eq(ventesTable.id, id), eq(ventesTable.clinicId, clinicId)));
    if (!vente) return sendError(res, 404, "Vente non trouvée");
    const lignes = await db
      .select()
      .from(venteLignesTable)
      .where(eq(venteLignesTable.venteId, id));
    return sendSuccess(res, { ...vente, lignes });
  } catch (err) {
    return sendError(res, 500, "Erreur lors de la récupération", err);
  }
});

// POST /api/ventes
router.post("/", extractClinicId, async (req, res) => {
  try {
    const clinicId = req.clinicId!;
    const { lignes: lignesData, ...venteData } = req.body;

    const numero = await generateVenteNumero(clinicId);

    const parsed = insertVenteSchema.safeParse({ ...venteData, clinicId, numero });
    if (!parsed.success) return sendError(res, 400, "Données invalides", parsed.error.flatten());

    const [vente] = await db.insert(ventesTable).values(parsed.data).returning();

    let lignes: typeof venteLignesTable.$inferSelect[] = [];
    if (Array.isArray(lignesData) && lignesData.length > 0) {
      const lignesInsert = lignesData.map((l: unknown) => {
        const p = insertVenteLigneSchema.safeParse({ ...l as Record<string, unknown>, venteId: vente.id });
        if (!p.success) throw new Error("Ligne invalide: " + JSON.stringify(p.error.flatten()));
        return p.data;
      });
      lignes = await db.insert(venteLignesTable).values(lignesInsert).returning();
    }

    return sendSuccess(res, { ...vente, lignes }, 201);
  } catch (err) {
    return sendError(res, 500, "Erreur lors de la création de la vente", err);
  }
});

// PUT /api/ventes/:id
router.put("/:id", extractClinicId, async (req, res) => {
  try {
    const clinicId = req.clinicId!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return sendError(res, 400, "ID invalide");
    const { id: _id, clinicId: _cid, numero: _num, createdAt: _ca, updatedAt: _ua, lignes: lignesData, ...body } = req.body;

    const [updated] = await db
      .update(ventesTable)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(ventesTable.id, id), eq(ventesTable.clinicId, clinicId)))
      .returning();
    if (!updated) return sendError(res, 404, "Vente non trouvée");

    if (Array.isArray(lignesData)) {
      await db.delete(venteLignesTable).where(eq(venteLignesTable.venteId, id));
      if (lignesData.length > 0) {
        const lignesInsert = lignesData.map((l: unknown) => {
          const p = insertVenteLigneSchema.safeParse({ ...l as Record<string, unknown>, venteId: id });
          if (!p.success) throw new Error("Ligne invalide");
          return p.data;
        });
        await db.insert(venteLignesTable).values(lignesInsert);
      }
    }

    const lignes = await db.select().from(venteLignesTable).where(eq(venteLignesTable.venteId, id));
    return sendSuccess(res, { ...updated, lignes });
  } catch (err) {
    return sendError(res, 500, "Erreur lors de la mise à jour", err);
  }
});

// DELETE /api/ventes/:id
router.delete("/:id", extractClinicId, async (req, res) => {
  try {
    const clinicId = req.clinicId!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return sendError(res, 400, "ID invalide");
    await db.delete(ventesTable).where(and(eq(ventesTable.id, id), eq(ventesTable.clinicId, clinicId)));
    return sendSuccess(res, { message: "Vente supprimée" });
  } catch (err) {
    return sendError(res, 500, "Erreur lors de la suppression", err);
  }
});

export default router;
