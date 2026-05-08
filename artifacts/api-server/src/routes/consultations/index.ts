import { Router } from "express";
import workflowRouter from "./workflow";
import consultationPatientsRouter from "./patients";
import consultationAttachmentsRouter from "./attachments";
import { db } from "@workspace/db";
import {
  consultationsTable,
  patientsTable,
  ownersTable,
  actesConsultationsTable,
  actesTable,
  facturesTable,
} from "@workspace/db";
import {
  CreateConsultationBody,
  GetConsultationParams,
  UpdateConsultationBody,
  UpdateConsultationParams,
  ListConsultationsQueryParams,
  GenerateOrdonnanceParams,
  GenerateFactureParams,
} from "@workspace/api-zod";
import { eq, and, inArray, desc } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { AI_MODEL, AI_MAX_TOKENS, TVA_DEFAULT_RATE } from "../../lib/constants";
import { nextInvoiceNumber, computeInvoiceTotals } from "../../lib/numbering";
import { fail, ok } from "../../lib/response";
import { validate } from "../../middlewares/validate";
import { CreateConsultationSchema } from "../../schemas";

const router = Router();

async function getConsultationWithDetails(id: number, clinicId: string) {
  const [c] = await db
    .select({
      id: consultationsTable.id,
      patientId: consultationsTable.patientId,
      veterinaire: consultationsTable.veterinaire,
      date: consultationsTable.date,
      statut: consultationsTable.statut,
      motif: consultationsTable.motif,
      anamnese: consultationsTable.anamnese,
      examenClinique: consultationsTable.examenClinique,
      examensComplementaires: consultationsTable.examensComplementaires,
      diagnostic: consultationsTable.diagnostic,
      diagnosticIA: consultationsTable.diagnosticIA,
      ordonnance: consultationsTable.ordonnance,
      notes: consultationsTable.notes,
      poids: consultationsTable.poids,
      temperature: consultationsTable.temperature,
      createdAt: consultationsTable.createdAt,
      patient: {
        id: patientsTable.id,
        nom: patientsTable.nom,
        espece: patientsTable.espece,
        race: patientsTable.race,
        sexe: patientsTable.sexe,
        dateNaissance: patientsTable.dateNaissance,
        poids: patientsTable.poids,
        couleur: patientsTable.couleur,
        sterilise: patientsTable.sterilise,
        ownerId: patientsTable.ownerId,
        antecedents: patientsTable.antecedents,
        allergies: patientsTable.allergies,
        createdAt: patientsTable.createdAt,
        owner: {
          id: ownersTable.id,
          nom: ownersTable.nom,
          prenom: ownersTable.prenom,
          email: ownersTable.email,
          telephone: ownersTable.telephone,
          adresse: ownersTable.adresse,
          createdAt: ownersTable.createdAt,
        },
      },
    })
    .from(consultationsTable)
    .leftJoin(patientsTable, eq(consultationsTable.patientId, patientsTable.id))
    .leftJoin(ownersTable, eq(patientsTable.ownerId, ownersTable.id))
    .where(and(eq(consultationsTable.clinicId, clinicId), eq(consultationsTable.id, id)));

  if (!c) return null;

  const [actes, factureRows] = await Promise.all([
    db
      .select({
        id: actesConsultationsTable.id,
        acteId: actesConsultationsTable.acteId,
        consultationId: actesConsultationsTable.consultationId,
        quantite: actesConsultationsTable.quantite,
        prixUnitaire: actesConsultationsTable.prixUnitaire,
        tvaRate: actesConsultationsTable.tvaRate,
        description: actesConsultationsTable.description,
        acte: {
          id: actesTable.id,
          code: actesTable.code,
          nom: actesTable.nom,
          categorie: actesTable.categorie,
          prixDefaut: actesTable.prixDefaut,
          description: actesTable.description,
          unite: actesTable.unite,
        },
      })
      .from(actesConsultationsTable)
      .leftJoin(actesTable, eq(actesConsultationsTable.acteId, actesTable.id))
      .where(
        and(
          eq(actesConsultationsTable.clinicId, clinicId),
          eq(actesConsultationsTable.consultationId, id),
        ),
      ),
    db
      .select()
      .from(facturesTable)
      .where(
        and(eq(facturesTable.clinicId, clinicId), eq(facturesTable.consultationId, id)),
      ),
  ]);
  const facture = factureRows[0] ?? null;

  return {
    ...c,
    createdAt: c.createdAt.toISOString(),
    patient: c.patient
      ? {
          ...c.patient,
          createdAt: c.patient.createdAt.toISOString(),
          owner: c.patient.owner
            ? { ...c.patient.owner, createdAt: c.patient.owner.createdAt.toISOString() }
            : null,
        }
      : null,
    actes,
    facture: facture
      ? { ...facture, createdAt: facture.createdAt.toISOString() }
      : null,
  };
}

router.get("/", async (req, res) => {
  try {
    const query = ListConsultationsQueryParams.safeParse(req.query);
    const { statut, date } = query.success ? query.data : ({} as { statut?: string; date?: string });
  const rawPage = parseInt(String(req.query["page"] ?? "1"), 10);
  const rawLimit = parseInt(String(req.query["limit"] ?? "50"), 10);
  const pageNum = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  const pageSize = Number.isNaN(rawLimit) || rawLimit < 1 || rawLimit > 200 ? 50 : rawLimit;
  const pageOffset = (pageNum - 1) * pageSize;

    const cidEq = eq(consultationsTable.clinicId, req.clinicId);
    let consultations;
    if (statut && date) {
      consultations = await db.select().from(consultationsTable)
        .where(and(cidEq, eq(consultationsTable.statut, statut), eq(consultationsTable.date, date))).orderBy(desc(consultationsTable.createdAt)).limit(pageSize).offset(pageOffset);
    } else if (statut) {
      consultations = await db.select().from(consultationsTable)
        .where(and(cidEq, eq(consultationsTable.statut, statut))).orderBy(desc(consultationsTable.createdAt)).limit(pageSize).offset(pageOffset);
    } else if (date) {
      consultations = await db.select().from(consultationsTable)
        .where(and(cidEq, eq(consultationsTable.date, date))).orderBy(desc(consultationsTable.createdAt)).limit(pageSize).offset(pageOffset);
    } else {
      consultations = await db.select().from(consultationsTable).where(cidEq).orderBy(desc(consultationsTable.createdAt)).limit(pageSize).offset(pageOffset);
    }

    // P1-3 : anti-N+1 ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ on lit tous les patients et owners en une seule requÃÂÃÂÃÂÃÂªte.
    const patientIds = [...new Set(consultations.map((c) => c.patientId).filter(Boolean))];
    const patients = patientIds.length
      ? await db
          .select({
            id: patientsTable.id,
            nom: patientsTable.nom,
            espece: patientsTable.espece,
            race: patientsTable.race,
            sexe: patientsTable.sexe,
            dateNaissance: patientsTable.dateNaissance,
            poids: patientsTable.poids,
            couleur: patientsTable.couleur,
            sterilise: patientsTable.sterilise,
            ownerId: patientsTable.ownerId,
            antecedents: patientsTable.antecedents,
            allergies: patientsTable.allergies,
            createdAt: patientsTable.createdAt,
            owner: {
              id: ownersTable.id,
              nom: ownersTable.nom,
              prenom: ownersTable.prenom,
              email: ownersTable.email,
              telephone: ownersTable.telephone,
              adresse: ownersTable.adresse,
              createdAt: ownersTable.createdAt,
            },
          })
          .from(patientsTable)
          .leftJoin(ownersTable, eq(patientsTable.ownerId, ownersTable.id))
          .where(
            and(
              eq(patientsTable.clinicId, req.clinicId),
              inArray(patientsTable.id, patientIds as Array<number>),
            ),
          )
      : [];
    const patientsById = new Map(patients.map((p) => [p.id, p]));

    const result = consultations.map((c) => {
      const patient = patientsById.get(c.patientId) ?? null;
      return {
        ...c,
        createdAt: c.createdAt.toISOString(),
        patient: patient
          ? {
              ...patient,
              createdAt: patient.createdAt.toISOString(),
              owner: patient.owner
                ? { ...patient.owner, createdAt: patient.owner.createdAt.toISOString() }
                : null,
            }
          : null,
      };
    });

    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "GET /consultations failed");
    return res.status(500).json(fail("INTERNAL", "Erreur interne du serveur"));
  }
});

router.post("/", validate(CreateConsultationSchema), async (req, res) => {
  try {
    const body = CreateConsultationBody.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json(
        fail("VALIDATION_ERROR", "DonnÃÂÃÂÃÂÃÂ©es invalides", body.error.flatten().fieldErrors),
      );
    }

    const [pat] = await db
      .select({ id: patientsTable.id })
      .from(patientsTable)
      .where(and(eq(patientsTable.clinicId, req.clinicId), eq(patientsTable.id, body.data.patientId)));
    if (!pat) return res.status(400).json(fail("PATIENT_NOT_FOUND", "Patient introuvable"));

    const [consultation] = await db
      .insert(consultationsTable)
      .values({ ...body.data, clinicId: req.clinicId })
      .returning();

    return res
      .status(201)
      .json({ ...consultation, createdAt: consultation.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "POST /consultations failed");
    return res.status(500).json(fail("INTERNAL", "Erreur interne du serveur"));
  }
});

router.get("/:id", async (req, res) => {
  try {
    const params = GetConsultationParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json(fail("INVALID_ID", "ID invalide"));

    const consultation = await getConsultationWithDetails(params.data.id, req.clinicId);
    if (!consultation) return res.status(404).json(fail("NOT_FOUND", "Consultation non trouvÃÂÃÂÃÂÃÂ©e"));

    return res.json(consultation);
  } catch (err) {
    req.log.error({ err }, "GET /consultations/:id failed");
    return res.status(500).json(fail("INTERNAL", "Erreur interne du serveur"));
  }
});

// ============================================================================
//  PATCH /:id ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ P0-9 : delete+insert des actes encapsulÃÂÃÂÃÂÃÂ©s dans une transaction.
// ============================================================================
router.patch("/:id", async (req, res) => {
  try {
    const params = UpdateConsultationParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json(fail("INVALID_ID", "ID invalide"));

    const body = UpdateConsultationBody.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json(
        fail("VALIDATION_ERROR", "DonnÃÂÃÂÃÂÃÂ©es invalides", body.error.flatten().fieldErrors),
      );
    }

    const { actes, ...consultationData } = body.data;

    const [exists] = await db
      .select({ id: consultationsTable.id })
      .from(consultationsTable)
      .where(and(eq(consultationsTable.clinicId, req.clinicId), eq(consultationsTable.id, params.data.id)));
    if (!exists) return res.status(404).json(fail("NOT_FOUND", "Consultation non trouvÃÂÃÂÃÂÃÂ©e"));

    await db.transaction(async (tx) => {
      if (Object.keys(consultationData).length > 0) {
        await tx
          .update(consultationsTable)
          .set(consultationData)
          .where(
            and(
              eq(consultationsTable.clinicId, req.clinicId),
              eq(consultationsTable.id, params.data.id),
            ),
          );
      }

      if (actes !== undefined) {
        await tx
          .delete(actesConsultationsTable)
          .where(
            and(
              eq(actesConsultationsTable.clinicId, req.clinicId),
              eq(actesConsultationsTable.consultationId, params.data.id),
            ),
          );
        if (actes.length > 0) {
          await tx.insert(actesConsultationsTable).values(
            actes.map((a) => ({
              acteId: a.acteId && a.acteId > 0 ? a.acteId : null,
              consultationId: params.data.id,
              quantite: a.quantite,
              prixUnitaire: a.prixUnitaire,
              tvaRate: a.tvaRate ?? TVA_DEFAULT_RATE,
              description: a.description ?? null,
              clinicId: req.clinicId,
            })),
          );
        }
      }
    });

    const consultation = await getConsultationWithDetails(params.data.id, req.clinicId);
    if (!consultation) return res.status(404).json(fail("NOT_FOUND", "Consultation non trouvÃÂÃÂÃÂÃÂ©e"));
    return res.json(consultation);
  } catch (err) {
    req.log.error({ err }, "PATCH /consultations/:id failed");
    return res.status(500).json(fail("INTERNAL", "Erreur interne du serveur"));
  }
});

router.post("/:id/actes", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json(fail("INVALID_ID", "ID invalide"));

    const { description, quantite, prixUnitaire, acteId, tvaRate } = req.body;

    if (!description?.trim()) return res.status(400).json(fail("VALIDATION_ERROR", "Description requise"));
    if (prixUnitaire === undefined || prixUnitaire === null || Number.isNaN(Number(prixUnitaire))) {
      return res.status(400).json(fail("VALIDATION_ERROR", "Prix unitaire requis"));
    }

    const [exists] = await db
      .select({ id: consultationsTable.id })
      .from(consultationsTable)
      .where(and(eq(consultationsTable.clinicId, req.clinicId), eq(consultationsTable.id, id)));
    if (!exists) return res.status(404).json(fail("NOT_FOUND", "Consultation non trouvÃÂÃÂÃÂÃÂ©e"));

    const [acte] = await db
      .insert(actesConsultationsTable)
      .values({
        consultationId: id,
        acteId: acteId && Number(acteId) > 0 ? Number(acteId) : null,
        quantite: Number(quantite) || 1,
        prixUnitaire: Number(prixUnitaire),
        tvaRate: tvaRate !== undefined ? Number(tvaRate) : TVA_DEFAULT_RATE,
        description: String(description).trim(),
        clinicId: req.clinicId,
      })
      .returning();

    return res.status(201).json(acte);
  } catch (err) {
    req.log.error({ err }, "POST /consultations/:id/actes failed");
    return res.status(500).json(fail("INTERNAL", "Erreur interne du serveur"));
  }
});

router.post("/:id/ordonnance", async (req, res) => {
  try {
    const params = GenerateOrdonnanceParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json(fail("INVALID_ID", "ID invalide"));

    const consultation = await getConsultationWithDetails(params.data.id, req.clinicId);
    if (!consultation) return res.status(404).json(fail("NOT_FOUND", "Consultation non trouvÃÂÃÂÃÂÃÂ©e"));

    const patient = consultation.patient;
    const actes = consultation.actes;

    const prompt = `Tu es un vÃÂÃÂÃÂÃÂ©tÃÂÃÂÃÂÃÂ©rinaire. GÃÂÃÂÃÂÃÂ©nÃÂÃÂÃÂÃÂ¨re une ordonnance mÃÂÃÂÃÂÃÂ©dicale structurÃÂÃÂÃÂÃÂ©e pour ce patient animal.

PATIENT : ${patient?.nom ?? "Inconnu"} (${patient?.espece ?? ""}, ${patient?.sexe ?? ""}, ${patient?.sterilise ? "stÃÂÃÂÃÂÃÂ©rilisÃÂÃÂÃÂÃÂ©(e)" : "non stÃÂÃÂÃÂÃÂ©rilisÃÂÃÂÃÂÃÂ©(e)"})
PROPRIÃÂÃÂÃÂÃÂTAIRE : ${patient?.owner?.nom ?? ""} ${patient?.owner?.prenom ?? ""}
DATE : ${consultation.date}
VÃÂÃÂÃÂÃÂTÃÂÃÂÃÂÃÂRINAIRE : Dr. ${consultation.veterinaire}

DIAGNOSTIC : ${consultation.diagnostic ?? consultation.diagnosticIA ?? "ÃÂÃÂÃÂÃÂ prÃÂÃÂÃÂÃÂ©ciser"}
ANAMNÃÂÃÂÃÂÃÂSE : ${consultation.anamnese ?? ""}
EXAMEN CLINIQUE : ${consultation.examenClinique ?? ""}
${actes.length > 0 ? `ACTES RÃÂÃÂÃÂÃÂALISÃÂÃÂÃÂÃÂS : ${actes.map((a) => a.acte?.nom).filter(Boolean).join(", ")}` : ""}

GÃÂÃÂÃÂÃÂ©nÃÂÃÂÃÂÃÂ¨re une ordonnance mÃÂÃÂÃÂÃÂ©dicale vÃÂÃÂÃÂÃÂ©tÃÂÃÂÃÂÃÂ©rinaire complÃÂÃÂÃÂÃÂ¨te avec :
- En-tÃÂÃÂÃÂÃÂªte professionnel
- Identification du patient et propriÃÂÃÂÃÂÃÂ©taire
- Les mÃÂÃÂÃÂÃÂ©dicaments appropriÃÂÃÂÃÂÃÂ©s avec posologie, durÃÂÃÂÃÂÃÂ©e et instructions claires
- Conseils post-consultation
- Signature du vÃÂÃÂÃÂÃÂ©tÃÂÃÂÃÂÃÂ©rinaire

Format: texte structurÃÂÃÂÃÂÃÂ© lisible, en franÃÂÃÂÃÂÃÂ§ais, professionnel.`;

    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS.long,
      messages: [{ role: "user", content: prompt.slice(0, 10_000) }],
    });

    const content = message.content[0];
    if (content?.type !== "text") {
      return res.status(500).json(fail("AI_ERROR", "Erreur lors de la gÃÂÃÂÃÂÃÂ©nÃÂÃÂÃÂÃÂ©ration de l'ordonnance"));
    }

    await db
      .update(consultationsTable)
      .set({ ordonnance: content.text })
      .where(
        and(
          eq(consultationsTable.clinicId, req.clinicId),
          eq(consultationsTable.id, params.data.id),
        ),
      );

    return res.json({ ordonnance: content.text });
  } catch (err) {
    req.log.error({ err }, "POST /consultations/:id/ordonnance failed");
    return res.status(500).json(fail("AI_ERROR", "Erreur lors de la gÃÂÃÂÃÂÃÂ©nÃÂÃÂÃÂÃÂ©ration de l'ordonnance"));
  }
});

// ============================================================================
//  POST /:id/facture ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ P0-8 : numÃÂÃÂÃÂÃÂ©rotation atomique via transaction + advisory lock.
//                      P1-1 : TVA multi-taux par acte.
// ============================================================================
router.post("/:id/facture", async (req, res) => {
  try {
    const params = GenerateFactureParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json(fail("INVALID_ID", "ID invalide"));

    const [exists] = await db
      .select({ id: consultationsTable.id })
      .from(consultationsTable)
      .where(
        and(
          eq(consultationsTable.clinicId, req.clinicId),
          eq(consultationsTable.id, params.data.id),
        ),
      );
    if (!exists) return res.status(404).json(fail("NOT_FOUND", "Consultation non trouvÃÂÃÂÃÂÃÂ©e"));

    const actes = await db
      .select()
      .from(actesConsultationsTable)
      .where(
        and(
          eq(actesConsultationsTable.clinicId, req.clinicId),
          eq(actesConsultationsTable.consultationId, params.data.id),
        ),
      );

    if (actes.length === 0) {
      return res.status(400).json(
        fail(
          "NO_ACTES",
          "Aucun acte saisi ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ veuillez ajouter et enregistrer vos actes avant de gÃÂÃÂÃÂÃÂ©nÃÂÃÂÃÂÃÂ©rer la facture.",
        ),
      );
    }

    const totals = computeInvoiceTotals(actes, TVA_DEFAULT_RATE);

    if (totals.montantHT === 0) {
      return res.status(400).json(
        fail(
          "ZERO_TOTAL",
          "Le total des actes est 0 ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ¬ ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ saisissez des prix corrects avant de gÃÂÃÂÃÂÃÂ©nÃÂÃÂÃÂÃÂ©rer la facture.",
        ),
      );
    }

    const [existingFacture] = await db
      .select()
      .from(facturesTable)
      .where(
        and(
          eq(facturesTable.clinicId, req.clinicId),
          eq(facturesTable.consultationId, params.data.id),
        ),
      );

    if (existingFacture) {
      const [updated] = await db
        .update(facturesTable)
        .set({
          montantHT: totals.montantHT,
          tva: totals.tvaMoyenne,
          montantTTC: totals.montantTTC,
          tvaBreakdown: totals.tvaBreakdown,
        })
        .where(
          and(eq(facturesTable.clinicId, req.clinicId), eq(facturesTable.id, existingFacture.id)),
        )
        .returning();
      return res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
    }

    // Transaction atomique : numÃÂÃÂÃÂÃÂ©ro + insert.
    const facture = await db.transaction(async (tx) => {
      const numero = await nextInvoiceNumber(tx, req.clinicId);
      const [inserted] = await tx
        .insert(facturesTable)
        .values({
          consultationId: params.data.id,
          numero,
          montantHT: totals.montantHT,
          tva: totals.tvaMoyenne,
          montantTTC: totals.montantTTC,
          tvaBreakdown: totals.tvaBreakdown,
          statut: "en_attente",
          dateEmission: new Date().toISOString().split("T")[0],
          clinicId: req.clinicId,
        })
        .returning();
      return inserted;
    });

    return res.json({ ...facture, createdAt: facture.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "POST /consultations/:id/facture failed");
    return res.status(500).json(fail("INTERNAL", "Erreur lors de la gÃÂÃÂÃÂÃÂ©nÃÂÃÂÃÂÃÂ©ration de la facture"));
  }
});


// Workflow dual-phase IA
router.use("/:consultationId/patients", consultationPatientsRouter);
router.use("/:consultationId/attachments", consultationAttachmentsRouter);
router.use(workflowRouter);
export default router;
