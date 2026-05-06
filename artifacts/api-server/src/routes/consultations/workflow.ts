import { Router } from "express";
import { db, consultationsTable } from "@workspace/db";
import { ordonnancesTable, actesConsultationsTable, patientsTable, aiOutputsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { runAITask } from "../../lib/ai/aiRouter";
import { findMedications, formatMedicationsContext } from "../../lib/ragMedications";

const router = Router();

// ─── POST /:id/anamnese ─────────────────────────────────────────────────────
// Phase 1 — GPT-4o-mini (volume task)
router.post("/:id/anamnese", async (req, res) => {
  const consultationId = parseInt(req.params.id);
  const { transcription } = req.body;
  const clinicId = req.clinicId;

  if (!transcription?.trim())
    return res.status(400).json({ error: "Transcription manquante" });

  try {
    const [consult] = await db
      .select()
      .from(consultationsTable)
      .where(
        and(
          eq(consultationsTable.id, consultationId),
          eq(consultationsTable.clinicId, clinicId)
        )
      );
    if (!consult)
      return res.status(404).json({ error: "Consultation introuvable" });

    const prompt =
      'Tu es un assistant veterinaire expert. Analyse l\'anamnese dictee par le proprietaire.\n\n' +
      'Motif: ' + (consult.motif || "Non precise") + '\n' +
      'Anamnese: ' + transcription +
      '\n\nReponds UNIQUEMENT en JSON valide (sans markdown):\n' +
      '{"resume":"","signes_rapportes":[],"duree_evolution":"","contexte":"","hypotheses_initiales":[{"diagnostic":"","probabilite":"haute|moyenne|faible","justification":""}],"points_cles_examen":[],"urgence":"normale|moderee|elevee"}';

    const rawText = await runAITask("anamnese", prompt, {
      clinicId,
      consultationId,
      maxTokens: 2048,
    });

    let anamneseIA: Record<string, unknown>;
    try {
      const m = rawText.match(/\{[\s\S]*\}/);
      anamneseIA = m ? JSON.parse(m[0]) : { raw: rawText };
    } catch {
      anamneseIA = { raw: rawText };
    }

    // Log to ai_outputs (fire-and-forget)
    void db
      .insert(aiOutputsTable)
      .values({
        consultationId,
        pipelineType: "anamnese",
        rawOutput: rawText,
        parsedOutput: anamneseIA,
        clinicId,
      })
      .catch((e) =>
        req.log?.warn({ err: e }, "ai_outputs insert failed (anamnese)")
      );

    await db
      .update(consultationsTable)
      .set({
        anamnese: transcription,
        anamneseIA: JSON.stringify(anamneseIA),
        phase: "EXAMEN",
      })
      .where(
        and(
          eq(consultationsTable.id, consultationId),
          eq(consultationsTable.clinicId, clinicId)
        )
      );

    return res.json({ anamneseIA, phase: "EXAMEN" });
  } catch (err) {
    req.log?.error({ err }, "anamnese failed");
    return res.status(500).json({ error: "Erreur analyse anamnese" });
  }
});

// ─── POST /:id/examen ───────────────────────────────────────────────────────
// Phase 2 — GPT-4o-mini (volume task)
router.post("/:id/examen", async (req, res) => {
  const consultationId = parseInt(req.params.id);
  const { transcription } = req.body;
  const clinicId = req.clinicId;

  if (!transcription?.trim())
    return res.status(400).json({ error: "Transcription manquante" });

  try {
    const [consult] = await db
      .select()
      .from(consultationsTable)
      .where(
        and(
          eq(consultationsTable.id, consultationId),
          eq(consultationsTable.clinicId, clinicId)
        )
      );
    if (!consult)
      return res.status(404).json({ error: "Consultation introuvable" });

    let anamneseData: Record<string, unknown> | null = null;
    try {
      if (consult.anamneseIA) anamneseData = JSON.parse(consult.anamneseIA);
    } catch {
      /**/
    }

    const prompt =
      'Tu es un assistant veterinaire expert. Croise l\'anamnese avec l\'examen clinique.\n\n' +
      'Anamnese analysee:\n' + JSON.stringify(anamneseData) +
      '\n\nExamen clinique dicte:\n' + transcription +
      '\n\nReponds UNIQUEMENT en JSON valide (sans markdown):\n' +
      '{"resume_examen":"","parametres":{"temperature":"","fc":"","fr":"","muqueuses":"","autres":""},"concordance_anamnese":"","hypotheses_affinees":[{"diagnostic":"","probabilite":"","pour":[],"contre":[]}],"examens_proposes":[{"examen":"","priorite":"urgent|recommande|optionnel","justification":""}],"diagnostic_probable":"","traitement_initial":""}';

    const rawText = await runAITask("examen_clinique", prompt, {
      clinicId,
      consultationId,
      maxTokens: 2048,
    });

    let examenIA: Record<string, unknown>;
    try {
      const m = rawText.match(/\{[\s\S]*\}/);
      examenIA = m ? JSON.parse(m[0]) : { raw: rawText };
    } catch {
      examenIA = { raw: rawText };
    }

    // Log to ai_outputs (fire-and-forget)
    void db
      .insert(aiOutputsTable)
      .values({
        consultationId,
        pipelineType: "examen",
        rawOutput: rawText,
        parsedOutput: examenIA,
        clinicId,
      })
      .catch((e) =>
        req.log?.warn({ err: e }, "ai_outputs insert failed (examen)")
      );

    await db
      .update(consultationsTable)
      .set({
        examenClinique: transcription,
        examenIA: JSON.stringify(examenIA),
        phase: "SYNTHESE",
      })
      .where(
        and(
          eq(consultationsTable.id, consultationId),
          eq(consultationsTable.clinicId, clinicId)
        )
      );

    return res.json({ examenIA, phase: "SYNTHESE" });
  } catch (err) {
    req.log?.error({ err }, "examen failed");
    return res.status(500).json({ error: "Erreur analyse examen" });
  }
});

// ─── POST /:id/valider-examens ──────────────────────────────────────────────
// Phase 3 — Claude Sonnet + RAG ANMV
// IMPORTANT: stays in SYNTHESE phase — vet must call /terminer to finalize
router.post("/:id/valider-examens", async (req, res) => {
  const consultationId = parseInt(req.params.id);
  const { examensValides } = req.body;
  const clinicId = req.clinicId;

  try {
    const [consult] = await db
      .select()
      .from(consultationsTable)
      .where(
        and(
          eq(consultationsTable.id, consultationId),
          eq(consultationsTable.clinicId, clinicId)
        )
      );
    if (!consult)
      return res.status(404).json({ error: "Consultation introuvable" });

    let anamneseData: Record<string, unknown> | null = null;
    let examenData: Record<string, unknown> | null = null;
    try {
      if (consult.anamneseIA) anamneseData = JSON.parse(consult.anamneseIA);
    } catch {
      /**/
    }
    try {
      if (consult.examenIA) examenData = JSON.parse(consult.examenIA);
    } catch {
      /**/
    }

    // ── RAG ANMV: get patient species and search medications ──────────────
    let ragContext = "";
    try {
      const [patient] = await db
        .select({ espece: patientsTable.espece, poids: patientsTable.poids })
        .from(patientsTable)
        .where(eq(patientsTable.id, consult.patientId))
        .limit(1);

      if (patient?.espece) {
        const speciesCode =
          patient.espece.toUpperCase() === "CHAT" ||
          patient.espece.toUpperCase() === "FE"
            ? "FE"
            : "CA";

        // Build indication from clinical data
        const indication =
          (typeof examenData?.diagnostic_probable === "string"
            ? examenData.diagnostic_probable
            : "") +
          " " +
          (typeof anamneseData?.resume === "string" ? anamneseData.resume : "");

        const meds = await findMedications(indication.trim(), speciesCode, 8);
        ragContext = formatMedicationsContext(meds, speciesCode);

        if (patient.poids) {
          ragContext += "\n\nPoids patient: " + patient.poids + " kg";
        }
      }
    } catch (ragErr) {
      req.log?.warn({ err: ragErr }, "RAG ANMV failed (non-blocking)");
    }

    const prompt =
      'Tu es un assistant veterinaire expert. Genere la synthese finale et le compte rendu medical.\n\n' +
      'Anamnese: ' + JSON.stringify(anamneseData) +
      '\nExamen: ' + JSON.stringify(examenData) +
      '\nExamens retenus: ' + JSON.stringify(examensValides || []) +
      (ragContext
        ? '\n\n=== BASE ANMV (medicaments autorises) ===\n' + ragContext + '\n=== FIN BASE ANMV ==='
        : '') +
      '\n\nReponds UNIQUEMENT en JSON valide (sans markdown). Structure exacte:\n' +
      '{"diagnostic_final":"","diagnostics_differentiels":[],"ordonnance_suggeree":[{"molecule":"nom molecule","specialite":"nom commercial","dose_mg":0,"forme":"cp|sirop|injectable|pommade","posologie":"description complete","frequence_jour":2,"duree_jours":7,"voie":"oral|injectable|topique","prix_estime":15}],"examens_a_facturer":[{"acte":"","quantite":1,"prix_estime":0}],"suivi":"","pronostic":"favorable|reserve|defavorable","alerte_antibiotique":false}';

    const rawText = await runAITask("diagnostic_differentiel", prompt, {
      clinicId,
      consultationId,
      maxTokens: 4096,
    });

    let syntheseIA: Record<string, unknown>;
    try {
      const m = rawText.match(/\{[\s\S]*\}/);
      syntheseIA = m ? JSON.parse(m[0]) : { raw: rawText };
    } catch {
      syntheseIA = { raw: rawText };
    }

    // ── Log to ai_outputs ─────────────────────────────────────────────────
    let aiOutputId: number | null = null;
    try {
      const [inserted] = await db
        .insert(aiOutputsTable)
        .values({
          consultationId,
          pipelineType: "synthese",
          rawOutput: rawText,
          parsedOutput: syntheseIA,
          wasValidated: false,
          clinicId,
        })
        .returning({ id: aiOutputsTable.id });
      aiOutputId = inserted?.id ?? null;
    } catch (e) {
      req.log?.warn({ err: e }, "ai_outputs insert failed (synthese)");
    }

    // ── Update consultation (STAY in SYNTHESE — vet must validate) ────────
    await db
      .update(consultationsTable)
      .set({
        examensComplementairesValides: JSON.stringify(examensValides || []),
        syntheseIA: JSON.stringify(syntheseIA),
        // phase stays SYNTHESE
      })
      .where(
        and(
          eq(consultationsTable.id, consultationId),
          eq(consultationsTable.clinicId, clinicId)
        )
      );

    // ── Auto-create ordonnance ────────────────────────────────────────────
    let ordonnanceId: number | null = null;
    let ordonnanceNumero: string | null = null;
    try {
      const meds = syntheseIA.ordonnance_suggeree;
      if (
        Array.isArray(meds) &&
        meds.length > 0 &&
        meds.some((m: any) => m.molecule || m.specialite)
      ) {
        const contenu = meds
          .filter((m: any) => m.molecule || m.specialite)
          .map((m: any) => {
            const nom = m.specialite || m.molecule || "Medicament";
            const lines = ["• " + nom];
            if (m.dose_mg) lines.push("  Dose : " + m.dose_mg + "mg");
            if (m.forme) lines.push("  Forme : " + m.forme);
            if (m.posologie) lines.push("  Posologie : " + m.posologie);
            if (m.frequence_jour)
              lines.push("  Frequence : " + m.frequence_jour + "x/jour");
            if (m.duree_jours)
              lines.push("  Duree : " + m.duree_jours + " jours");
            if (m.voie) lines.push("  Voie : " + m.voie);
            return lines.join("\n");
          })
             .join("\n\n");

        const year = new Date().getFullYear();
        const [lastOrd] = await db
          .select({ num: ordonnancesTable.numeroOrdonnance })
          .from(ordonnancesTable)
          .where(
            and(
              eq(ordonnancesTable.clinicId, clinicId),
              sql`numero_ordonnance LIKE ${"ORD-" + year + "-%"}`
            )
          )
          .orderBy(desc(ordonnancesTable.id))
          .limit(1);

        const lastSeq = lastOrd?.num
          ? parseInt(lastOrd.num.split("-")[2] ?? "0")
          : 0;
        const numeroOrdonnance =
          "ORD-" + year + "-" + String(lastSeq + 1).padStart(5, "0");

        const [ord] = await db
          .insert(ordonnancesTable)
          .values({
            consultationId,
            patientId: consult.patientId,
            veterinaire: consult.veterinaire ?? null,
            contenu,
            numeroOrdonnance,
            genereIA: true,
            instructionsClient:
              typeof syntheseIA.suivi === "string" ? syntheseIA.suivi : null,
            clinicId,
          })
          .returning();

        ordonnanceId = ord.id;
        ordonnanceNumero = ord.numeroOrdonnance;
      }
    } catch (ordErr) {
      req.log?.warn(
        { err: ordErr },
        "Auto-ordonnance creation failed (non-blocking)"
      );
    }

    // ── Auto-create actes devis ───────────────────────────────────────────
    try {
      const lignesDevis: Array<{
        description: string;
        prixUnitaire: number;
        quantite: number;
      }> = [];

      if (Array.isArray(syntheseIA.ordonnance_suggeree)) {
        for (const med of syntheseIA.ordonnance_suggeree as any[]) {
          if (!med.molecule && !med.specialite) continue;
          const nom = med.specialite || med.molecule;
          const details = [
            med.dose_mg ? med.dose_mg + "mg" : null,
            med.forme || null,
            med.frequence_jour ? med.frequence_jour + "x/j" : null,
            med.duree_jours ? med.duree_jours + "j" : null,
          ]
            .filter(Boolean)
            .join(" ");
          const description = nom + (details ? " — " + details : "");
          lignesDevis.push({
            description,
            prixUnitaire: Number(med.prix_estime) || 0,
            quantite: 1,
          });
        }
      }

      if (Array.isArray(syntheseIA.examens_a_facturer)) {
        for (const ex of syntheseIA.examens_a_facturer as any[]) {
          if (!ex.acte) continue;
          lignesDevis.push({
            description: ex.acte,
            prixUnitaire: Number(ex.prix_estime) || 0,
            quantite: Number(ex.quantite) || 1,
          });
        }
      }

      if (lignesDevis.length > 0) {
        await db
          .delete(actesConsultationsTable)
          .where(
            and(
              eq(actesConsultationsTable.consultationId, consultationId),
              eq(actesConsultationsTable.clinicId, clinicId)
            )
          );
        await db.insert(actesConsultationsTable).values(
          lignesDevis.map((l) => ({
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
    } catch (devisErr) {
      req.log?.warn(
        { err: devisErr },
        "Auto-devis actes creation failed (non-blocking)"
      );
    }

    return res.json({
      syntheseIA,
      phase: "SYNTHESE",
      ordonnanceId,
      ordonnanceNumero,
      aiOutputId,
      requiresValidation: true,
    });
  } catch (err) {
    req.log?.error({ err }, "valider-examens failed");
    return res.status(500).json({ error: "Erreur synthese" });
  }
});

// ─── POST /:id/terminer ──────────────────────────────────────────────────────
// Validation checkpoint — requires Clerk user ID before TERMINEE
router.post("/:id/terminer", async (req, res) => {
  const consultationId = parseInt(req.params.id);
  const { validated_by, validation_changes } = req.body;
  const clinicId = req.clinicId;

  if (!validated_by?.trim()) {
    return res.status(400).json({
      error: "validated_by requis — identifiant veterinaire manquant",
    });
  }

  try {
    const [consult] = await db
      .select()
      .from(consultationsTable)
      .where(
        and(
          eq(consultationsTable.id, consultationId),
          eq(consultationsTable.clinicId, clinicId)
        )
      );
    if (!consult)
      return res.status(404).json({ error: "Consultation introuvable" });

    if (consult.phase !== "SYNTHESE") {
      return res.status(400).json({
        error: "La consultation doit etre en phase SYNTHESE pour etre terminee",
        currentPhase: consult.phase,
      });
    }

    // Mark ai_output as validated
    try {
      await db
        .update(aiOutputsTable)
        .set({
          wasValidated: true,
          validatedBy: validated_by,
          validationChanges: validation_changes || null,
        })
        .where(
          and(
            eq(aiOutputsTable.consultationId, consultationId),
            eq(aiOutputsTable.pipelineType, "synthese"),
            eq(aiOutputsTable.clinicId, clinicId)
          )
        );
    } catch (e) {
      req.log?.warn({ err: e }, "ai_outputs validation update failed (non-blocking)");
    }

    let syntheseIA: Record<string, unknown> | null = null;
    try {
      if (consult.syntheseIA) syntheseIA = JSON.parse(consult.syntheseIA);
    } catch {
      /**/
    }

    // Transition to TERMINEE
    await db
      .update(consultationsTable)
      .set({
        phase: "TERMINEE",
        statut: "terminee",
        diagnostic:
          typeof syntheseIA?.diagnostic_final === "string"
            ? syntheseIA.diagnostic_final
            : "",
        notes:
          typeof syntheseIA?.suivi === "string" ? syntheseIA.suivi : "",
      })
      .where(
        and(
          eq(consultationsTable.id, consultationId),
          eq(consultationsTable.clinicId, clinicId)
        )
      );

    return res.json({
      phase: "TERMINEE",
      validated_by,
      consultationId,
    });
  } catch (err) {
    req.log?.error({ err }, "terminer failed");
    return res.status(500).json({ error: "Erreur validation consultation" });
  }
});

// ─── GET /:id/workflow-state ─────────────────────────────────────────────────
router.get("/:id/workflow-state", async (req, res) => {
  const consultationId = parseInt(req.params.id);
  const clinicId = req.clinicId;

  try {
    const [consult] = await db
      .select()
      .from(consultationsTable)
      .where(
        and(
          eq(consultationsTable.id, consultationId),
          eq(consultationsTable.clinicId, clinicId)
        )
      );
    if (!consult)
      return res.status(404).json({ error: "Consultation introuvable" });

    const [ordonnance] = await db
      .select({
        id: ordonnancesTable.id,
        numero: ordonnancesTable.numeroOrdonnance,
        contenu: ordonnancesTable.contenu,
      })
      .from(ordonnancesTable)
      .where(
        and(
          eq(ordonnancesTable.consultationId, consultationId),
          eq(ordonnancesTable.clinicId, clinicId)
        )
      )
      .limit(1);

    const devisActes = await db
      .select({
        id: actesConsultationsTable.id,
        description: actesConsultationsTable.description,
        prixUnitaire: actesConsultationsTable.prixUnitaire,
        quantite: actesConsultationsTable.quantite,
        tvaRate: actesConsultationsTable.tvaRate,
      })
      .from(actesConsultationsTable)
      .where(
        and(
          eq(actesConsultationsTable.consultationId, consultationId),
          eq(actesConsultationsTable.clinicId, clinicId)
        )
      );

    // Check synthese validation state
    const [syntheseOutput] = await db
      .select({
        wasValidated: aiOutputsTable.wasValidated,
        validatedBy: aiOutputsTable.validatedBy,
      })
      .from(aiOutputsTable)
      .where(
        and(
          eq(aiOutputsTable.consultationId, consultationId),
          eq(aiOutputsTable.pipelineType, "synthese"),
          eq(aiOutputsTable.clinicId, clinicId)
        )
      )
      .orderBy(desc(aiOutputsTable.id))
      .limit(1);

    const parse = (s: string | null) => {
      try {
        return s ? JSON.parse(s) : null;
      } catch {
        return null;
      }
    };

    return res.json({
      phase: consult.phase || "ANAMNESE",
      anamneseIA: parse(consult.anamneseIA),
      examenIA: parse(consult.examenIA),
      syntheseIA: parse(consult.syntheseIA),
      examensComplementairesValides: parse(consult.examensComplementairesValides),
      ordonnance: ordonnance
        ? { id: ordonnance.id, numero: ordonnance.numero, contenu: ordonnance.contenu }
        : null,
      devisActes: devisActes.length > 0 ? devisActes : null,
      validation: syntheseOutput
        ? {
            wasValidated: syntheseOutput.wasValidated,
            validatedBy: syntheseOutput.validatedBy,
          }
        : null,
    });
  } catch (err) {
    req.log?.error({ err }, "workflow-state failed");
    return res.status(500).json({ error: "Erreur workflow" });
  }
});

export default router;
