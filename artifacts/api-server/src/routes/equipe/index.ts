import { Router } from "express";
import { db } from "@workspace/db";
import { assistantsTable, insertAssistantSchema } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { ok, fail } from "../../lib/response";
import { extractClinic } from "../../middlewares/extractClinic";

const router = Router();

// GET /api/equipe — liste des assistantes actives
router.get("/", extractClinic(), async (req, res) => {
  try {
    const clinicId = req.clinicId!;
    const assistants = await db
      .select()
      .from(assistantsTable)
      .where(and(eq(assistantsTable.clinicId, clinicId), eq(assistantsTable.actif, true)))
      .orderBy(assistantsTable.nom);
    return ok(res, assistants);
  } catch (err) {
    return fail(res, 500, "Erreur lors de la récupération de l'équipe", err);
  }
});

// GET /api/equipe/all — y compris inactives
router.get("/all", extractClinic(), async (req, res) => {
  try {
    const clinicId = req.clinicId!;
    const assistants = await db
      .select()
      .from(assistantsTable)
      .where(eq(assistantsTable.clinicId, clinicId))
      .orderBy(assistantsTable.nom);
    return ok(res, assistants);
  } catch (err) {
    return fail(res, 500, "Erreur lors de la récupération de l'équipe", err);
  }
});

// GET /api/equipe/:id
router.get("/:id", extractClinic(), async (req, res) => {
  try {
    const clinicId = req.clinicId!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, 400, "ID invalide");
    const [assistant] = await db
      .select()
      .from(assistantsTable)
      .where(and(eq(assistantsTable.id, id), eq(assistantsTable.clinicId, clinicId)));
    if (!assistant) return fail(res, 404, "Assistante non trouvée");
    return ok(res, assistant);
  } catch (err) {
    return fail(res, 500, "Erreur lors de la récupération", err);
  }
});

// POST /api/equipe
router.post("/", extractClinic(), async (req, res) => {
  try {
    const clinicId = req.clinicId!;
    const parsed = insertAssistantSchema.safeParse({ ...req.body, clinicId });
    if (!parsed.success) return fail(res, 400, "Données invalides", parsed.error.flatten());
    const [created] = await db.insert(assistantsTable).values(parsed.data).returning();
    return ok(res, created, 201);
  } catch (err) {
    return fail(res, 500, "Erreur lors de la création", err);
  }
});

// PUT /api/equipe/:id
router.put("/:id", extractClinic(), async (req, res) => {
  try {
    const clinicId = req.clinicId!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, 400, "ID invalide");
    const { id: _id, clinicId: _cid, createdAt: _ca, updatedAt: _ua, ...body } = req.body;
    const [updated] = await db
      .update(assistantsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(assistantsTable.id, id), eq(assistantsTable.clinicId, clinicId)))
      .returning();
    if (!updated) return fail(res, 404, "Assistante non trouvée");
    return ok(res, updated);
  } catch (err) {
    return fail(res, 500, "Erreur lors de la mise à jour", err);
  }
});

// DELETE /api/equipe/:id — soft delete (désactivation)
router.delete("/:id", extractClinic(), async (req, res) => {
  try {
    const clinicId = req.clinicId!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return fail(res, 400, "ID invalide");
    const [updated] = await db
      .update(assistantsTable)
      .set({ actif: false, updatedAt: new Date() })
      .where(and(eq(assistantsTable.id, id), eq(assistantsTable.clinicId, clinicId)))
      .returning();
    if (!updated) return fail(res, 404, "Assistante non trouvée");
    return ok(res, { message: "Assistante désactivée" });
  } catch (err) {
    return fail(res, 500, "Erreur lors de la suppression", err);
  }
});

export default router;
