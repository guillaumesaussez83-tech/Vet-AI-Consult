/**
 * /api/vet-knowledge — Endpoint de recherche dans la base de connaissances vétérinaires
 *
 * POST /api/vet-knowledge/search
 * Body: { query: string; topK?: number; categorie?: "medicament"|"antibiogramme"|"pathologie"|"protocole" }
 * Response: { results: VetKnowledgeResult[] }
 *
 * Utilisé par le frontend pour afficher les références pertinentes à côté d'un diagnostic.
 */

import { Router } from "express";
import { z } from "zod";
import { searchVetKnowledge } from "../lib/vetKnowledgeService";
import { ok, fail } from "../lib/response";

const router = Router();

const searchSchema = z.object({
  query: z.string().min(3).max(1000),
  topK: z.number().int().min(1).max(10).optional(),
  categorie: z
    .enum(["medicament", "antibiogramme", "pathologie", "protocole"])
    .optional(),
});

/**
 * POST /api/vet-knowledge/search
 * Recherche vectorielle dans la base de connaissances vétérinaires ANMV/EMA/RESAPATH.
 */
router.post("/search", async (req, res, next) => {
  try {
    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(fail("VALIDATION_ERROR", parsed.error.message));
    }

    const { query, topK, categorie } = parsed.data;
    const results = await searchVetKnowledge(query, { topK, categorie });

    return res.json(ok({ results }));
  } catch (err) {
    next(err);
  }
});

export default router;
