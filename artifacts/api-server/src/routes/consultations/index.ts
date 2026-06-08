// @ts-nocheck
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
  GetDiagnosticIABody,
} from "@workspace/api-zod";
import { eq, and, inArray, desc } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { AI_MODEL, AI_MAX_TOKENS, TVA_DEFAULT_RATE } from "../../lib/constants";
import { nextInvoiceNumber, computeInvoiceTotals } from "../../lib/numbering";
import { fail, ok } from "../../lib/response";
import { validate } from "../../middlewares/validate";
import { CreateConsultationSchema } from "../../schemas";
import { getAuth } from "@clerk/express";
import { logAuditEvent } from "../../middleware/auditLogger";
import { diagnosticDifferentiel } from "../../lib/aiService";
import { niveauMaxUrgences } from "../../lib/ai/diagnosticResult";
import { aiLimiter } from "../../middlewares/rateLimiter";

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
      urgencesVitales: consultationsTable.urgencesVitales,
      urgenceVitaleDetectee: consultationsTable.urgenceVitaleDetectee,
      urgenceAcquitteePar: consultationsTable.urgenceAcquitteePar,
      urgenceAcquitteeParNom: consultationsTable.urgenceAcquitteeParNom,
      urgenceAcquitteeLe: consultationsTable.urgenceAcquitteeLe,
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

    // P1-3 : anti-N+1 — on lit tous les patients et owners en une seule requête.
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
        fail("VALIDATION_ERROR", "Données invalides", body.error.flatten().fieldErrors),
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
    if (!consultation) return res.status(404).json(fail("NOT_FOUND", "Consultation non trouvée"));

    return res.json(consultation);
  } catch (err) {
    req.log.error({ err }, "GET /consultations/:id failed");
    return res.status(500).json(fail("INTERNAL", "Erreur interne du serveur"));
  }
});

// ============================================================================
//  PATCH /:id — P0-9 : delete+insert des actes encapsulés dans une transaction.
// ============================================================================
router.patch("/:id", async (req, res) => {
  try {
    const params = UpdateConsultationParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json(fail("INVALID_ID", "ID invalide"));

    const body = UpdateConsultationBody.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json(
        fail("VALIDATION_ERROR", "Données invalides", body.error.flatten().fieldErrors),
      );
    }

    const { actes, ...consultationData } = body.data;

    const [exists] = await db
      .select({ id: consultationsTable.id })
      .from(consultationsTable)
      .where(and(eq(consultationsTable.clinicId, req.clinicId), eq(consultationsTable.id, params.data.id)));
    if (!exists) return res.status(404).json(fail("NOT_FOUND", "Consultation non trouvée"));

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
    if (!consultation) return res.status(404).json(fail("NOT_FOUND", "Consultation non trouvée"));
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
    if (!exists) return res.status(404).json(fail("NOT_FOUND", "Consultation non trouvée"));

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
    if (!consultation) return res.status(404).json(fail("NOT_FOUND", "Consultation non trouvée"));

    const patient = consultation.patient;
    const actes = consultation.actes;

    const prompt = `Tu es un vétérinaire. Génère une ordonnance médicale structurée pour ce patient animal.

PATIENT : ${patient?.nom ?? "Inconnu"} (${patient?.espece ?? ""}, ${patient?.sexe ?? ""}, ${patient?.sterilise ? "stérilisé(e)" : "non stérilisé(e)"})
PROPRIÉTAIRE : ${patient?.owner?.nom ?? ""} ${patient?.owner?.prenom ?? ""}
DATE : ${consultation.date}
VÉTÉRINAIRE : Dr. ${consultation.veterinaire}

DIAGNOSTIC : ${consultation.diagnostic ?? consultation.diagnosticIA ?? "À préciser"}
ANAMNÈSE : ${consultation.anamnese ?? ""}
EXAMEN CLINIQUE : ${consultation.examenClinique ?? ""}
${actes.length > 0 ? `ACTES RÉALISÉS : ${actes.map((a) => a.acte?.nom).filter(Boolean).join(", ")}` : ""}

Génère une ordonnance médicale vétérinaire complète avec :
- En-tête professionnel
- Identification du patient et propriétaire
- Les médicaments appropriés avec posologie, durée et instructions claires
- Conseils post-consultation
- Signature du vétérinaire

Format: texte structuré lisible, en français, professionnel.`;

    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS.long,
      messages: [{ role: "user", content: prompt.slice(0, 10_000) }],
    });

    const content = message.content[0];
    if (content?.type !== "text") {
      return res.status(500).json(fail("AI_ERROR", "Erreur lors de la génération de l'ordonnance"));
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
    return res.status(500).json(fail("AI_ERROR", "Erreur lors de la génération de l'ordonnance"));
  }
});

// ============================================================================
//  POST /:id/facture — P0-8 : numérotation atomique via transaction + advisory lock.
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
    if (!exists) return res.status(404).json(fail("NOT_FOUND", "Consultation non trouvée"));

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
          "Aucun acte saisi — veuillez ajouter et enregistrer vos actes avant de générer la facture.",
        ),
      );
    }

    const totals = computeInvoiceTotals(actes, TVA_DEFAULT_RATE);

    if (totals.montantHT === 0) {
      return res.status(400).json(
        fail(
          "ZERO_TOTAL",
          "Le total des actes est 0 € — saisissez des prix corrects avant de générer la facture.",
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

    // Transaction atomique : numéro + insert.
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
    return res.status(500).json(fail("INTERNAL", "Erreur lors de la génération de la facture"));
  }
});


// ============================================================================
//  POST /:id/diagnostic-ia — diagnostic IA SERVEUR-AUTORITAIRE.
//  Calcule le diagnostic (avec consultationId), persiste les urgences vitales
//  detectees (donnee stockee = ce que le serveur a calcule, jamais relaye par le
//  client), et trace la DETECTION dans l'audit-log immuable. Les colonnes sur la
//  consultation = etat/affichage ; la PREUVE vit dans audit_logs (append-only).
// ============================================================================
router.post("/:id/diagnostic-ia", aiLimiter, async (req, res) => {
  try {
    const params = UpdateConsultationParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json(fail("INVALID_ID", "ID invalide"));

    const body = GetDiagnosticIABody.safeParse(req.body);
    if (!body.success) {
      return res
        .status(400)
        .json(fail("VALIDATION_ERROR", "Données invalides", body.error.flatten().fieldErrors));
    }

    const [exists] = await db
      .select({ id: consultationsTable.id })
      .from(consultationsTable)
      .where(and(eq(consultationsTable.clinicId, req.clinicId), eq(consultationsTable.id, params.data.id)));
    if (!exists) return res.status(404).json(fail("NOT_FOUND", "Consultation non trouvée"));

    const result = await diagnosticDifferentiel(body.data, req.clinicId, params.data.id);

    const urgences = Array.isArray(result.urgencesVitales) ? result.urgencesVitales : [];
    const detectee = result.urgenceVitaleDetectee === true;

    // Persistance serveur-autoritaire (etat/affichage). Reset de l'acquittement a
    // CHAQUE generation : une nouvelle/differente alerte DOIT forcer une nouvelle
    // prise de connaissance (sinon une urgence differente passerait silencieuse).
    // L'audit-log conserve toutes les traces precedentes.
    await db
      .update(consultationsTable)
      .set({
        urgencesVitales: urgences,
        urgenceVitaleDetectee: detectee,
        urgenceAcquitteePar: null,
        urgenceAcquitteeParNom: null,
        urgenceAcquitteeLe: null,
      })
      .where(and(eq(consultationsTable.clinicId, req.clinicId), eq(consultationsTable.id, params.data.id)));

    // Trace immuable de la DETECTION (preuve que le systeme A signale).
    if (detectee && urgences.length > 0) {
      await logAuditEvent(req, {
        action: "DETECTION_URGENCE_VITALE",
        resourceType: "consultation",
        resourceId: String(params.data.id),
        metadata: { urgencesVitales: urgences, niveauMax: niveauMaxUrgences(urgences) },
      });
    }

    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "POST /consultations/:id/diagnostic-ia failed");
    // Meme distinction que /api/ai/diagnostic : delai depasse (504) vs erreur serveur.
    if ((err as { code?: string } | null | undefined)?.code === "AI_TIMEOUT") {
      return res
        .status(504)
        .json(fail("AI_TIMEOUT", "Le diagnostic IA a depasse le delai imparti. Veuillez reessayer."));
    }
    return res.status(500).json(fail("INTERNAL", "Erreur lors de la génération du diagnostic IA"));
  }
});

// ============================================================================
//  POST /:id/acquitter-urgence — accuse de reception d'une urgence vitale.
//  Stampe l'acquitteur (userId Clerk SERVEUR, non falsifiable) + nom + now(), et
//  ecrit une entree audit-log immuable. Re-acquittement autorise : chaque appel =
//  une nouvelle entree audit (la colonne montre le DERNIER acquittement).
// ============================================================================
router.post("/:id/acquitter-urgence", async (req, res) => {
  try {
    const params = UpdateConsultationParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json(fail("INVALID_ID", "ID invalide"));

    const [c] = await db
      .select({
        id: consultationsTable.id,
        urgenceVitaleDetectee: consultationsTable.urgenceVitaleDetectee,
        urgencesVitales: consultationsTable.urgencesVitales,
      })
      .from(consultationsTable)
      .where(and(eq(consultationsTable.clinicId, req.clinicId), eq(consultationsTable.id, params.data.id)));
    if (!c) return res.status(404).json(fail("NOT_FOUND", "Consultation non trouvée"));
    if (!c.urgenceVitaleDetectee) {
      return res.status(400).json(fail("NO_URGENCE", "Aucune urgence vitale à acquitter"));
    }

    const auth = getAuth(req);
    const userId = auth?.userId ?? null;
    if (!userId) return res.status(401).json(fail("UNAUTHENTICATED", "Non authentifié"));

    // Nom lisible : claims Clerk si dispo, sinon nom fourni par le front (affichage).
    // La PREUVE reste le userId serveur (+ l'entree audit).
    const claims = (auth?.sessionClaims ?? {}) as Record<string, any>;
    const nom =
      (typeof claims.name === "string" && claims.name) ||
      [claims.firstName, claims.lastName].filter(Boolean).join(" ").trim() ||
      (typeof req.body?.nom === "string" ? req.body.nom.trim() : "") ||
      null;
    const now = new Date();

    await db
      .update(consultationsTable)
      .set({ urgenceAcquitteePar: userId, urgenceAcquitteeParNom: nom, urgenceAcquitteeLe: now })
      .where(and(eq(consultationsTable.clinicId, req.clinicId), eq(consultationsTable.id, params.data.id)));

    // Trace immuable : append-only, chaque acquittement = une entree (re-acquittement OK).
    await logAuditEvent(req, {
      action: "ACQUITTEMENT_URGENCE_VITALE",
      resourceType: "consultation",
      resourceId: String(params.data.id),
      metadata: {
        urgencesVitales: c.urgencesVitales ?? [],
        niveauMax: niveauMaxUrgences(c.urgencesVitales as any),
        acquitteParNom: nom,
      },
    });

    const consultation = await getConsultationWithDetails(params.data.id, req.clinicId);
    return res.json(consultation);
  } catch (err) {
    req.log.error({ err }, "POST /consultations/:id/acquitter-urgence failed");
    return res.status(500).json(fail("INTERNAL", "Erreur interne du serveur"));
  }
});


// Workflow dual-phase IA
router.use("/:consultationId/patients", consultationPatientsRouter);
router.use("/:consultationId/attachments", consultationAttachmentsRouter);
router.use(workflowRouter);
export default router;
