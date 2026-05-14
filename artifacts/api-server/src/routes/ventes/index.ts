import { Router } from "express";
import { db } from "@workspace/db";
import { ventesTable, venteLignesTable, insertVenteSchema, insertVenteLigneSchema, ownersTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { ok, fail } from "../../lib/response";
import { requireClinicId } from "../../middleware/requireClinicId";
import { generateVenteNumero } from "../../lib/numbering";

const router = Router();

// GET /api/ventes?type=comptoir|prescription
router.get("/", requireClinicId, async (req, res) => {
  try {
    const clinicId = req.clinicId!;
    const type = req.query.type as string | undefined;
    const conditions = [eq(ventesTable.clinicId, clinicId)];
    if (type === "comptoir" || type === "prescription") {
      conditions.push(eq(ventesTable.type, type));
    }
    const ventes = await db
      .select({
        id: ventesTable.id,
        clinicId: ventesTable.clinicId,
        numero: ventesTable.numero,
        type: ventesTable.type,
        patientId: ventesTable.patientId,
        proprietaireId: ventesTable.proprietaireId,
        assistantId: ventesTable.assistantId,
        ordonnanceId: ventesTable.ordonnanceId,
        notes: ventesTable.notes,
        modePaiement: ventesTable.modePaiement,
        montantHt: ventesTable.montantHt,
        montantTva: ventesTable.montantTva,
        montantTtc: ventesTable.montantTtc,
        statut: ventesTable.statut,
        date: ventesTable.date,
        createdAt: ventesTable.createdAt,
        updatedAt: ventesTable.updatedAt,
        ownerNom: ownersTable.nom,
        ownerPrenom: ownersTable.prenom,
      })
      .from(ventesTable)
      .leftJoin(ownersTable, eq(ventesTable.proprietaireId, ownersTable.id))
      .where(and(...conditions))
      .orderBy(desc(ventesTable.date));
    return res.json(ok(ventes));
  } catch (err) {
    return res.status(500).json(fail("INTERNAL_ERROR", "Erreur lors de la recuperation des ventes", err));
  }
});

// GET /api/ventes/:id
router.get("/:id", requireClinicId, async (req, res) => {
  try {
    const clinicId = req.clinicId!;
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json(fail("VALIDATION_ERROR", "ID invalide"));
    const [vente] = await db
      .select()
      .from(ventesTable)
      .where(and(eq(ventesTable.id, id), eq(ventesTable.clinicId, clinicId)));
    if (!vente) return res.status(404).json(fail("NOT_FOUND", "Vente non trouvee"));
    const lignes = await db
      .select()
      .from(venteLignesTable)
      .where(eq(venteLignesTable.venteId, id));
    return res.json(ok({ ...vente, lignes }));
  } catch (err) {
    return res.status(500).json(fail("INTERNAL_ERROR", "Erreur lors de la recuperation", err));
  }
});

// POST /api/ventes
router.post("/", requireClinicId, async (req, res) => {
  try {
    const clinicId = req.clinicId!;
    const { lignes: lignesData, ...venteData } = req.body;
    const numero = await generateVenteNumero(clinicId);
    const parsed = insertVenteSchema.safeParse({ ...venteData, clinicId, numero });
    if (!parsed.success) return res.status(400).json(fail("VALIDATION_ERROR", "Donnees invalides", parsed.error.flatten()));
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
    return res.status(201).json(ok({ ...vente, lignes }));
  } catch (err) {
    return res.status(500).json(fail("INTERNAL_ERROR", "Erreur lors de la creation de la vente", err));
  }
});

// PUT /api/ventes/:id
router.put("/:id", requireClinicId, async (req, res) => {
  try {
    const clinicId = req.clinicId!;
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json(fail("VALIDATION_ERROR", "ID invalide"));
    const { id: _id, clinicId: _cid, numero: _num, createdAt: _ca, updatedAt: _ua, lignes: lignesData, ...body } = req.body;
    const [updated] = await db
      .update(ventesTable)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(ventesTable.id, id), eq(ventesTable.clinicId, clinicId)))
      .returning();
    if (!updated) return res.status(404).json(fail("NOT_FOUND", "Vente non trouvee"));
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
    return res.json(ok({ ...updated, lignes }));
  } catch (err) {
    return res.status(500).json(fail("INTERNAL_ERROR", "Erreur lors de la mise a jour", err));
  }
});

// DELETE /api/ventes/:id
router.delete("/:id", requireClinicId, async (req, res) => {
  try {
    const clinicId = req.clinicId!;
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json(fail("VALIDATION_ERROR", "ID invalide"));
    await db.delete(ventesTable).where(and(eq(ventesTable.id, id), eq(ventesTable.clinicId, clinicId)));
    return res.json(ok({ message: "Vente supprimee" }));
  } catch (err) {
    return res.status(500).json(fail("INTERNAL_ERROR", "Erreur lors de la suppression", err));
  }
});

export default router;
