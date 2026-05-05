import { Router } from "express";
import { db, consultationsTable } from "@workspace/db";
import { ordonnancesTable, actesConsultationsTable } from "@workspace/db";
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
    const message = await anthropic.messages.create({ model: AI_MODEL, max_tokens: AI_MAX_TOKENS.long, messages: [{ role: "user", content: prompt }] });
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
    const message = await anthropic.messages.create({ model: AI_MODEL, max_tokens: AI_MAX_TOKENS.long, messages: [{ role: "user", content: prompt }] });
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
    const prompt = "Tu es un assistant veterinaire expert. Genere la synthese finale et le compte rendu medical.\n\nAnamnese: " + JSON.stringify(anamneseData) + "\nExamen: " + JSON.stringify(examenData) + "\nExamens retenus: " + JSON.stringify(examensValides || []) + '\n\nReponds UNIQUEMENT en JSON valide (sans markdown). Structure exacte:\n{"diagnostic_final":"","diagnostics_differentiels":[],"compte_rendu":"Compte rendu medical complet professionnel","ordonnance_suggeree":[{"molecule":"nom molecule","specialite":"nom commercial","dose_mg":0,"forme":"cp|sirop|injectable|pommade","posologie":"description complete","frequence_jour":2,"duree_jours":7,"voie":"oral|injectable|topique","prix_estime":15}],"examens_a_facturer":[{"acte":"","quantite":1,"prix_estime":0}],"suivi":"","pronostic":"favorable|reserve|defavorable"}';
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
      if (Array.isArray(meds) && meds.length > 0 && meds.some((m: any) => m.molecule || m.specialite)) {
        const contenu = meds
          .filter((m: any) => m.molecule || m.specialite)
          .map((m: any) => {
            const nom = m.specialite || m.molecule || "Medicament";
            const lines = ["• " + nom];
            if (m.dose_mg) lines.push("  Dose : " + m.dose_mg + "mg");
            if (m.forme) lines.push("  Forme : " + m.forme);
            if (m.posologie) lines.push("  Posologie : " + m.posologie);
            if (m.frequence_jour) lines.push("  Frequence : " + m.frequence_jour + "x/jour");
            if (m.duree_jours) lines.push("  Duree : " + m.duree_jours + " jours");
            if (m.voie) lines.push("  Voie : " + m.voie);
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
    } catch (ordErr) { req.log.warn({ err: ordErr }, "Auto-ordonnance creation failed (non-blocking)"); }

    // Auto-creation actesConsultations depuis donnees IA (devis pre-rempli)
    try {
      const lignesDevis: Array<{ description: string; prixUnitaire: number; quantite: number }> = [];
      if (Array.isArray(syntheseIA.ordonnance_suggeree)) {
        for (const med of syntheseIA.ordonnance_suggeree as any[]) {
          if (!med.molecule && !med.specialite) continue;
          const nom = med.specialite || med.molecule;
          const details = [
            med.dose_mg ? med.dose_mg + "mg" : null,
            med.forme || null,
            med.frequence_jour ? med.frequence_jour + "x/j" : null,
            med.duree_jours ? med.duree_jours + "j" : null,
          ].filter(Boolean).join(" ");
          const description = nom + (details ? " — " + details : "");
          lignesDevis.push({ description, prixUnitaire: Number(med.prix_estime) || 0, quantite: 1 });
        }
      }
      if (Array.isArray(syntheseIA.examens_a_facturer)) {
        for (const ex of syntheseIA.examens_a_facturer as any[]) {
          if (!ex.acte) continue;
          lignesDevis.push({ description: ex.acte, prixUnitaire: Number(ex.prix_estime) || 0, quantite: Number(ex.quantite) || 1 });
        }
      }
      if (lignesDevis.length > 0) {
        await db.delete(actesConsultationsTable)
          .where(and(eq(actesConsultationsTable.consultationId, consultationId), eq(actesConsultationsTable.clinicId, clinicId)));
        await db.insert(actesConsultationsTable).values(
          lignesDevis.map(l => ({
            consultationId,
            acteId: null,
            description: l.description,
            prixUnitaire: l.prixUnitaire,
            quantite: l.quantite,
            tvaRate: 20,
            clinicId,
          }))
        );
      }
    } catch (devisErr) { req.log.warn({ err: devisErr }, "Auto-devis actes creation failed (non-blocking)"); }

    return res.json({ syntheseIA, phase: "TERMINEE", ordonnanceId, ordonnanceNumero });
  } catch (err) { req.log.error({ err }, "valider-examens failed"); return res.status(500).json({ error: "Erreur synthese" }); }
});

// GET /:id/workflow-state
router.get("/:id/workflow-state", async (req, res) => {
  const consultationId = parseInt(req.params.id);
  const clinicId = req.clinicId;
  try {
    const [consult] = await db.select().from(consultationsTable)
      .where(and(eq(consultationsTable.id, consultationId), eq(consultationsTable.clinicId, clinicId)));
    if (!consult) return res.status(404).json({ error: "Consultation introuvable" });
    const [ordonnance] = await db.select({
      id: ordonnancesTable.id,
      numero: ordonnancesTable.numeroOrdonnance,
      contenu: ordonnancesTable.contenu,
    }).from(ordonnancesTable)
      .where(and(eq(ordonnancesTable.consultationId, consultationId), eq(ordonnancesTable.clinicId, clinicId)))
      .limit(1);
    const devisActes = await db.select({
      id: actesConsultationsTable.id,
      description: actesConsultationsTable.description,
      prixUnitaire: actesConsultationsTable.prixUnitaire,
      quantite: actesConsultationsTable.quantite,
      tvaRate: actesConsultationsTable.tvaRate,
    }).from(actesConsultationsTable)
      .where(and(eq(actesConsultationsTable.consultationId, consultationId), eq(actesConsultationsTable.clinicId, clinicId)));
    const parse = (s: string | null) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
    return res.json({
      phase: consult.phase || "ANAMNESE",
      anamneseIA: parse(consult.anamneseIA),
      examenIA: parse(consult.examenIA),
      syntheseIA: parse(consult.syntheseIA),
      examensComplementairesValides: parse(consult.examensComplementairesValides),
      ordonnance: ordonnance ? { id: ordonnance.id, numero: ordonnance.numero, contenu: ordonnance.contenu } : null,
      devisActes: devisActes.length > 0 ? devisActes : null,
    });
  } catch (err) { req.log.error({ err }, "workflow-state failed"); return res.status(500).json({ error: "Erreur workflow" }); }
});

export default router;
