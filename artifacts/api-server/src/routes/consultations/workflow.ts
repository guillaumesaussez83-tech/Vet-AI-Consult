import { Router } from "express";
import { db, consultationsTable } from "@workspace/db";
import { ordonnancesTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { AI_MODEL, AI_MAX_TOKENS } from "../../lib/constants";

const router = Router();

// POST /:id/anamnese
router.post("/:id/anamnese", async (req, res) => {
  const consultationId = parseInt(req.params.id);
  const { transcription } = req.body;
  const clinicId = req.clinicId;
  if (!transcription?.trim()) return res.status(400).json({ error: "Transcription manquante" });
  try {
    const [consult] = await db.select().from(consultationsTable)
      .where(and(eq(consultationsTable.id, consultationId), eq(consultationsTable.clinicId, clinicId)));
    if (!consult) return res.status(404).json({ error: "Consultation introuvable" });
    const prompt = "Tu es un assistant veterinaire expert. Analyse l'anamnese dictee par le proprietaire.\n\nMotif: " + (consult.motif || "Non precise") + "\nAnamnese: " + transcription + '\n\nReponds en JSON: {"resume":"","signes_rapportes":[],"duree_evolution":"","contexte":"","hypotheses_initiales":[{"diagnostic":"","probabilite":"haute|moyenne|faible","justification":""}],"points_cles_examen":[],"urgence":"normale|moderee|elevee"}';
    const message = await anthropic.messages.create({ model: AI_MODEL, max_tokens: AI_MAX_TOKENS, messages: [{ role: "user", content: prompt }] });
    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    let anamneseIA;
    try { const m = rawText.match(/\{[\s\S]*\}/); anamneseIA = m ? JSON.parse(m[0]) : { raw: rawText }; } catch { anamneseIA = { raw: rawText }; }
    await db.update(consultationsTable).set({ anamnese: transcription, anamneseIA: JSON.stringify(anamneseIA), phase: "EXAMEN" })
      .where(and(eq(consultationsTable.id, consultationId), eq(consultationsTable.clinicId, clinicId)));
    return res.json({ anamneseIA, phase: "EXAMEN" });
  } catch (err) { req.log.error({ err }, "anamnese failed"); return res.status(500).json({ error: "Erreur analyse anamnese" }); }
});

// POST /:id/examen
router.post("/:id/examen", async (req, res) => {
  const consultationId = parseInt(req.params.id);
  const { transcription } = req.body;
  const clinicId = req.clinicId;
  if (!transcription?.trim()) return res.status(400).json({ error: "Transcription manquante" });
  try {
    const [consult] = await db.select().from(consultationsTable)
      .where(and(eq(consultationsTable.id, consultationId), eq(consultationsTable.clinicId, clinicId)));
    if (!consult) return res.status(404).json({ error: "Consultation introuvable" });
    let anamneseData = null;
    try { if (consult.anamneseIA) anamneseData = JSON.parse(consult.anamneseIA); } catch { /**/ }
    const prompt = "Tu es un assistant veterinaire expert. Croise l'anamnese avec l'examen clinique.\n\nAnamnese analysee:\n" + JSON.stringify(anamneseData) + "\n\nExamen clinique dicte:\n" + transcription + '\n\nReponds en JSON: {"resume_examen":"","parametres":{"temperature":"","fc":"","fr":"","muqueuses":"","autres":""},"concordance_anamnese":"","hypotheses_affinees":[{"diagnostic":"","probabilite":"","pour":[],"contre":[]}],"examens_proposes":[{"examen":"","priorite":"urgent|recommande|optionnel","justification":""}],"diagnostic_probable":"","traitement_initial":""}';
    const message = await anthropic.messages.create({ model: AI_MODEL, max_tokens: AI_MAX_TOKENS, messages: [{ role: "user", content: prompt }] });
    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    let examenIA;
    try { const m = rawText.match(/\{[\s\S]*\}/); examenIA = m ? JSON.parse(m[0]) : { raw: rawText }; } catch { examenIA = { raw: rawText }; }
    await db.update(consultationsTable).set({ examenClinique: transcription, examenIA: JSON.stringify(examenIA), phase: "SYNTHESE" })
      .where(and(eq(consultationsTable.id, consultationId), eq(consultationsTable.clinicId, clinicId)));
    return res.json({ examenIA, phase: "SYNTHESE" });
  } catch (err) { req.log.error({ err }, "examen failed"); return res.status(500).json({ error: "Erreur analyse examen" }); }
});

// POST /:id/valider-examens
router.post("/:id/valider-examens", async (req, res) => {
  const consultationId = parseInt(req.params.id);
  const { examensValides } = req.body;
  const clinicId = req.clinicId;
  try {
    const [consult] = await db.select().from(consultationsTable)
      .where(and(eq(consultationsTable.id, consultationId), eq(consultationsTable.clinicId, clinicId)));
    if (!consult) return res.status(404).json({ error: "Consultation introuvable" });
    let anamneseData = null, examenData = null;
    try { if (consult.anamneseIA) anamneseData = JSON.parse(consult.anamneseIA); } catch { /**/ }
    try { if (consult.examenIA) examenData = JSON.parse(consult.examenIA); } catch { /**/ }
    const prompt = "Tu es un assistant veterinaire expert. Genere la synthese finale et le compte rendu medical.\n\nAnamnese: " + JSON.stringify(anamneseData) + "\nExamen: " + JSON.stringify(examenData) + "\nExamens retenus: " + JSON.stringify(examensValides || []) + '\n\nReponds en JSON: {"diagnostic_final":"","diagnostics_differentiels":[],"compte_rendu":"Compte rendu medical complet professionnel","ordonnance_suggeree":[{"molecule":"","specialite":"","posologie":"","duree":"","voie":""}],"examens_a_facturer":[{"acte":"","quantite":1}],"suivi":"","pronostic":"favorable|reserve|defavorable"}';
    const message = await anthropic.messages.create({ model: AI_MODEL, max_tokens: 4096, messages: [{ role: "user", content: prompt }] });
    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    let syntheseIA;
    try { const m = rawText.match(/\{[\s\S]*\}/); syntheseIA = m ? JSON.parse(m[0]) : { raw: rawText }; } catch { syntheseIA = { raw: rawText }; }

    await db.update(consultationsTable).set({
      examensComplementairesValides: JSON.stringify(examensValides || []),
      syntheseIA: JSON.stringify(syntheseIA),
      phase: "TERMINEE",
      statut: "terminee",
      diagnostic: typeof syntheseIA.diagnostic_final === "string" ? syntheseIA.diagnostic_final : "",
      notes: typeof syntheseIA.compte_rendu === "string" ? syntheseIA.compte_rendu : "",
    }).where(and(eq(consultationsTable.id, consultationId), eq(consultationsTable.clinicId, clinicId)));

    // Auto-creation ordonnance depuis ordonnance_suggeree
    let ordonnanceId = null;
    let ordonnanceNumero = null;
    try {
      const meds = syntheseIA.ordonnance_suggeree;
      if (Array.isArray(meds) && meds.length > 0 && meds.some(m => m.molecule || m.specialite)) {
        const contenu = meds
          .filter(m => m.molecule || m.specialite)
          .map(m => {
            const nom = m.specialite || m.molecule || "Medicament";
            const lines = ["• " + nom];
            if (m.posologie) lines.push("  Posologie : " + m.posologie);
            if (m.duree) lines.push("  Duree : " + m.duree);
            if (m.voie) lines.push("  Voie d'administration : " + m.voie);
            return lines.join("\n");
          }).join("\n\n");

        const year = new Date().getFullYear();
        const [lastOrd] = await db
          .select({ num: ordonnancesTable.numeroOrdonnance })
          .from(ordonnancesTable)
          .where(and(eq(ordonnancesTable.clinicId, clinicId), sql`numero_ordonnance LIKE ${"ORD-" + year + "-%"}`))
          .orderBy(desc(ordonnancesTable.id))
          .limit(1);
        const lastSeq = lastOrd?.num ? parseInt(lastOrd.num.split("-")[2] ?? "0") : 0;
        const numeroOrdonnance = "ORD-" + year + "-" + String(lastSeq + 1).padStart(5, "0");

        const [ord] = await db.insert(ordonnancesTable).values({
          consultationId,
          patientId: consult.patientId,
          veterinaire: consult.veterinaire ?? null,
          contenu,
          numeroOrdonnance,
          genereIA: true,
          instructionsClient: typeof syntheseIA.suivi === "string" ? syntheseIA.suivi : null,
          clinicId,
        }).returning();

        ordonnanceId = ord.id;
        ordonnanceNumero = ord.numeroOrdonnance;
      }
    } catch (ordErr) {
      req.log.warn({ err: ordErr }, "Auto-ordonnance creation failed (non-blocking)");
    }

    return res.json({ syntheseIA, phase: "TERMINEE", ordonnanceId, ordonnanceNumero });
  } catch (err) {
    req.log.error({ err }, "valider-examens failed");
    return res.status(500).json({ error: "Erreur synthese" });
  }
});

// GET /:id/workflow-state
router.get("/:id/workflow-state", async (req, res) => {
  const consultationId = parseInt(req.params.id);
  const clinicId = req.clinicId;
  try {
    const [consult] = await db.select().from(consultationsTable)
      .where(and(eq(consultationsTable.id, consultationId), eq(consultationsTable.clinicId, clinicId)));
    if (!consult) return res.status(404).json({ error: "Consultation introuvable" });
    const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
    return res.json({
      phase: consult.phase || "ANAMNESE",
      anamneseIA: parse(consult.anamneseIA),
      examenIA: parse(consult.examenIA),
      syntheseIA: parse(consult.syntheseIA),
      examensComplementairesValides: parse(consult.examensComplementairesValides),
    });
  } catch (err) {
    req.log.error({ err }, "workflow-state failed");
    return res.status(500).json({ error: "Erreur workflow" });
  }
});

export default router;
