import { Router } from "express";
import { db } from "@workspace/db";
import {
  facturesTable,
  consultationsTable,
  patientsTable,
  ownersTable,
  actesConsultationsTable,
  actesTable,
} from "@workspace/db";
import {
  GetFactureParams,
  UpdateFactureStatutParams,
  UpdateFactureStatutBody,
  ListFacturesQueryParams,
} from "@workspace/api-zod";
import { eq, and, inArray, desc } from "drizzle-orm";
import { decrementerConsultationFEFO } from "../stock/ia-engine";
import { TVA_DEFAULT_RATE } from "../../lib/constants";
import { computeInvoiceTotals } from "../../lib/numbering";
import { fail } from "../../lib/response";

import { FactureService } from "../../services/factureService";
import { validate } from "../../middlewares/validate";
import { CreateFactureSchema } from "../../schemas";

const router = Router();

type ActeRow = {
  consultationId: number;
  prixUnitaire: number;
  quantite: number;
  tvaRate: number | null;
};

/**
 * AgrÃÂÃÂ¨ge les actes par consultationId ÃÂ¢ÃÂÃÂ totaux HT/TTC/tva breakdown.
 * Accepte un dÃÂÃÂ©faut (20) pour les actes historiques avec tvaRate null.
 */
function buildTotalsByConsultation(actes: ReadonlyArray<ActeRow>) {
  const byCons = new Map<number, ActeRow[]>();
  for (const a of actes) {
    const arr = byCons.get(a.consultationId) ?? [];
    arr.push(a);
    byCons.set(a.consultationId, arr);
  }
  const out = new Map<number, ReturnType<typeof computeInvoiceTotals>>();
  for (const [consId, rows] of byCons) {
    out.set(consId, computeInvoiceTotals(rows, TVA_DEFAULT_RATE));
  }
  return out;
}

// ============================================================================
//  GET / ÃÂ¢ÃÂÃÂ liste des factures avec consultation + patient + owner joints.
//  P1-1 : TVA multi-taux calculÃÂÃÂ©e par breakdown par acte.
//  P1-3 : UN SEUL select pour toutes les consultations + patients + owners.
// ============================================================================
router.get("/", async (req, res) => {
  try {
    const query = ListFacturesQueryParams.safeParse(req.query);
    const { statut } = query.success ? query.data : ({} as { statut?: string });

    const cidEq = eq(facturesTable.clinicId, req.clinicId!);
    const rawPage  = parseInt(String(req.query["page"]  ?? "1"),  10);
    const rawLimit = parseInt(String(req.query["limit"] ?? "50"), 10);
    const pageNum  = Number.isNaN(rawPage)  || rawPage  < 1               ? 1  : rawPage;
    const pageSize = Number.isNaN(rawLimit) || rawLimit < 1 || rawLimit > 200 ? 50 : rawLimit;
    const pageOffset = (pageNum - 1) * pageSize;

    const factures = statut
      ? await db.select().from(facturesTable).where(and(cidEq, eq(facturesTable.statut, statut))).orderBy(desc(facturesTable.createdAt)).limit(pageSize).offset(pageOffset)
      : await db.select().from(facturesTable).where(cidEq).orderBy(desc(facturesTable.createdAt)).limit(pageSize).offset(pageOffset);

    if (factures.length === 0) return res.json([]);

    const consultationIds = [...new Set(factures.map((f) => f.consultationId))];

    // 1) Tous les actes d'un coup, avec tvaRate.
    const allActes: ActeRow[] = await (db as any)
      .select({
        consultationId: actesConsultationsTable.consultationId,
        prixUnitaire: actesConsultationsTable.prixUnitaire,
        quantite: actesConsultationsTable.quantite,
        tvaRate: actesConsultationsTable.tvaRate,
      })
      .from(actesConsultationsTable)
      .where(
        and(
          eq(actesConsultationsTable.clinicId, req.clinicId!),
          inArray(actesConsultationsTable.consultationId, consultationIds),
        ),
      );

    const totalsByCons = buildTotalsByConsultation(allActes);

    // 2) Toutes les consultations + patients + owners d'un coup (batch join).
    const consultations = (await (db as any)
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
      .where(
        and(
          eq(consultationsTable.clinicId, req.clinicId!),
          inArray(consultationsTable.id, consultationIds),
        ),
      )) as any[];

    const consById = new Map(consultations.map((c) => [c.id, c]));

    // 3) Update en arriÃÂÃÂ¨re-plan des factures dont les totaux ont dÃÂÃÂ©rivÃÂÃÂ© (non bloquant).
    const staleUpdates = factures
      .map((f) => {
        const fresh = totalsByCons.get(f.consultationId);
        if (!fresh) return null;
        if (
          Math.abs(f.montantHT - fresh.montantHT) < 0.005 &&
          Math.abs(f.montantTTC - fresh.montantTTC) < 0.005
        ) {
          return null;
        }
        return { id: f.id, fresh };
      })
      .filter((x): x is { id: number; fresh: ReturnType<typeof computeInvoiceTotals> } => !!x);

    if (staleUpdates.length > 0) {
      db.transaction(async (tx) => {
        for (const s of staleUpdates) {
          await tx
            .update(facturesTable)
            .set({
              montantHT: s.fresh.montantHT,
              montantTTC: s.fresh.montantTTC,
              tva: s.fresh.tvaMoyenne,
              tvaBreakdown: s.fresh.tvaBreakdown,
            })
            .where(and(eq(facturesTable.clinicId, req.clinicId!), eq(facturesTable.id, s.id)));
        }
      }).catch((err) => req.log.warn({ err }, "Stale facture background update failed"));
    }

    const result = factures.map((f) => {
      const fresh = totalsByCons.get(f.consultationId);
      const montantHT = fresh?.montantHT ?? f.montantHT;
      const montantTTC = fresh?.montantTTC ?? f.montantTTC;
      const tva = fresh?.tvaMoyenne ?? f.tva;

      const cons = consById.get(f.consultationId);
      return {
        ...f,
        montantHT,
        montantTTC,
        tva,
        tvaBreakdown: fresh?.tvaBreakdown ?? f.tvaBreakdown ?? null,
        dateEmission: f.dateEmission,
        createdAt: f.createdAt.toISOString(),
        consultation: cons
          ? {
              ...cons,
              createdAt: cons.createdAt.toISOString(),
              patient: cons.patient
                ? {
                    ...cons.patient,
                    createdAt: cons.patient.createdAt.toISOString(),
                    owner: cons.patient.owner
                      ? {
                          ...cons.patient.owner,
                          createdAt: cons.patient.owner.createdAt.toISOString(),
                        }
                      : null,
                  }
                : null,
            }
          : null,
      };
    });

    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "GET /factures failed");
    return res.status(500).json(fail("INTERNAL", "Erreur interne du serveur"));
  }
});

router.get("/by-consultation/:consultationId", async (req, res) => {
  try {
    const consultationId = Number(req.params.consultationId);
    if (!Number.isInteger(consultationId) || consultationId <= 0) {
      return res.status(400).json(fail("INVALID_ID", "ID invalide"));
    }

    const [facture] = await db
      .select()
      .from(facturesTable)
      .where(
        and(
          eq(facturesTable.clinicId, req.clinicId!),
          eq(facturesTable.consultationId, consultationId),
        ),
      );
    if (!facture) return res.json({ success: true, data: null });

    return res.json({ ...facture, createdAt: facture.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "GET /factures/by-consultation failed");
    return res.status(500).json(fail("INTERNAL", "Erreur interne"));
  }
});

router.get("/:id", async (req, res) => {
  try {
    const params = GetFactureParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json(fail("INVALID_ID", "ID invalide"));

    const [facture] = await db
      .select()
      .from(facturesTable)
      .where(and(eq(facturesTable.clinicId, req.clinicId!), eq(facturesTable.id, params.data.id)));
    if (!facture) return res.status(404).json(fail("NOT_FOUND", "Facture non trouvÃÂÃÂ©e"));

    const [consultation] = (await (db as any)
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
      .where(
        and(
          eq(consultationsTable.clinicId, req.clinicId!),
          eq(consultationsTable.id, facture.consultationId),
        ),
      )) as any[];

    const lignes = (await (db as any)
      .select({
        id: actesConsultationsTable.id,
        acteId: actesConsultationsTable.acteId,
        quantite: actesConsultationsTable.quantite,
        prixUnitaire: actesConsultationsTable.prixUnitaire,
        tvaRate: actesConsultationsTable.tvaRate,
        description: actesConsultationsTable.description,
        acte: {
          nom: actesTable.nom,
          categorie: actesTable.categorie,
          code: actesTable.code,
        },
      })
      .from(actesConsultationsTable)
      .leftJoin(actesTable, eq(actesConsultationsTable.acteId, actesTable.id))
      .where(
        and(
          eq(actesConsultationsTable.clinicId, req.clinicId!),
          eq(actesConsultationsTable.consultationId, facture.consultationId),
        ),
      )) as any[];

    // P1-1 : calcul ligne par ligne avec le tvaRate rÃÂÃÂ©el de chaque acte.
    const lignesMapped = lignes.map((l) => {
      const rate = l.tvaRate ?? TVA_DEFAULT_RATE;
      const ht = Math.round(l.prixUnitaire * l.quantite * 100) / 100;
      const tva = Math.round((ht * rate) / 100 * 100) / 100;
      return {
        ...l,
        description: l.description ?? l.acte?.nom ?? "",
        montantHT: ht,
        montantTVA: tva,
        montantTTC: Math.round((ht + tva) * 100) / 100,
        tvaRate: rate,
      };
    });

    const totals = computeInvoiceTotals(lignes, TVA_DEFAULT_RATE);

    if (
      lignesMapped.length > 0 &&
      (Math.abs(facture.montantHT - totals.montantHT) > 0.005 ||
        Math.abs(facture.montantTTC - totals.montantTTC) > 0.005)
    ) {
      await db
        .update(facturesTable)
        .set({
          montantHT: totals.montantHT,
          montantTTC: totals.montantTTC,
          tva: totals.tvaMoyenne,
          tvaBreakdown: totals.tvaBreakdown,
        })
        .where(and(eq(facturesTable.clinicId, req.clinicId!), eq(facturesTable.id, facture.id)));
    }

    return res.json({
      ...facture,
      montantHT: totals.montantHT,
      montantTVA: Math.round((totals.montantTTC - totals.montantHT) * 100) / 100,
      montantTTC: totals.montantTTC,
      tva: totals.tvaMoyenne,
      tvaBreakdown: totals.tvaBreakdown,
      createdAt: facture.createdAt.toISOString(),
      lignes: lignesMapped,
      consultation: consultation
        ? {
            ...consultation,
            createdAt: consultation.createdAt.toISOString(),
            patient: consultation.patient
              ? {
                  ...consultation.patient,
                  createdAt: consultation.patient.createdAt.toISOString(),
                  owner: consultation.patient.owner
                    ? {
                        ...consultation.patient.owner,
                        createdAt: consultation.patient.owner.createdAt.toISOString(),
                      }
                    : null,
                }
              : null,
          }
        : null,
    });
  } catch (err) {
    req.log.error({ err }, "GET /factures/:id failed");
    return res.status(500).json(fail("INTERNAL", "Erreur interne du serveur"));
  }
});


// POST /api/factures ÃÂ¢ÃÂÃÂ CrÃÂÃÂ©er une facture depuis les actes d'une consultation
router.post("/", validate(CreateFactureSchema), async (req, res) => {
  try {
    const consultationId = Number(req.body?.consultationId);
    if (!Number.isInteger(consultationId) || consultationId <= 0) {
      return res.status(400).json(fail("VALIDATION_ERROR", "consultationId invalide"));
    }
    const [existing] = await db
      .select()
      .from(facturesTable)
      .where(and(eq(facturesTable.clinicId, req.clinicId!), eq(facturesTable.consultationId, consultationId)));
    if (existing) {
      return res.status(409).json({ success: false, error: { code: "ALREADY_EXISTS", message: "Facture dÃÂÃÂ©jÃÂÃÂ  crÃÂÃÂ©ÃÂÃÂ©e pour cette consultation" } });
    }
    const montants = await FactureService.recalculerDepuisActes(consultationId);
    const numero = await FactureService.genererNumero(Number(req.clinicId!));
    const today = new Date().toISOString().split("T")[0];
    const [facture] = await db.insert(facturesTable).values({
      clinicId: req.clinicId!,
      consultationId,
      numero,
      montantHT: montants.montantHT,
      tva: TVA_DEFAULT_RATE,
      montantTTC: montants.montantTTC,
      statut: "en_attente",
      dateEmission: today,
    }).returning();
    return res.json({ success: true, data: facture });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json(fail("INTERNAL_ERROR", "Erreur interne du serveur"));
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const params = GetFactureParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json(fail("INVALID_ID", "ID invalide"));

    const [deleted] = await db
      .delete(facturesTable)
      .where(and(eq(facturesTable.clinicId, req.clinicId!), eq(facturesTable.id, params.data.id)))
      .returning();
    if (!deleted) return res.status(404).json(fail("NOT_FOUND", "Facture non trouvÃÂÃÂ©e"));

    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /factures/:id failed");
    return res.status(500).json(fail("INTERNAL", "Erreur lors de la suppression"));
  }
});

// ============================================================================
//  PATCH /:id ÃÂ¢ÃÂÃÂ changement de statut, recalcul TVA multi-taux, FEFO transactionnel.
// ============================================================================
router.patch("/:id", async (req, res) => {
  try {
    const params = UpdateFactureStatutParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) return res.status(400).json(fail("INVALID_ID", "ID invalide"));

    const body = UpdateFactureStatutBody.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json(
        fail("VALIDATION_ERROR", "DonnÃÂÃÂ©es invalides", body.error.flatten().fieldErrors),
      );
    }

    const updateData: Record<string, unknown> = { statut: body.data.statut };
    if (body.data.datePaiement) updateData.datePaiement = body.data.datePaiement;

    const modePaiement = (req.body as { modePaiement?: unknown }).modePaiement as string | undefined;
    const montantEspecesRaw = (req.body as { montantEspecesRecu?: unknown }).montantEspecesRecu;
    const montantEspecesRecu =
      montantEspecesRaw != null && !Number.isNaN(Number(montantEspecesRaw))
        ? parseFloat(String(montantEspecesRaw))
        : null;

    const validModes = [
      "carte_bancaire",
      "carte_sans_contact",
      "payvet",
      "cheque",
      "virement",
      "especes",
      "autre",
    ];
    if (modePaiement) {
      if (!validModes.includes(modePaiement)) {
        return res.status(400).json(fail("INVALID_MODE", "Mode de paiement invalide"));
      }
      updateData.modePaiement = modePaiement;
    }
    if (modePaiement === "especes" && montantEspecesRecu !== null) {
      updateData.montantEspecesRecu = montantEspecesRecu;
    }

    const [factureBefore] = await db
      .select()
      .from(facturesTable)
      .where(
        and(eq(facturesTable.clinicId, req.clinicId!), eq(facturesTable.id, params.data.id)),
      );
    if (!factureBefore) return res.status(404).json(fail("NOT_FOUND", "Facture non trouvÃÂÃÂ©e"));

    if (body.data.statut === "payee" && Number(factureBefore.montantTTC ?? 0) === 0) {
      return res.status(400).json(
        fail("ZERO_TOTAL", "Impossible de marquer comme payÃÂÃÂ©e une facture ÃÂÃÂ  0 ÃÂ¢ÃÂÃÂ¬. Ajoutez des actes d'abord."),
      );
    }

    const actesPourTotal = await (db as any)
      .select({
        prixUnitaire: actesConsultationsTable.prixUnitaire,
        quantite: actesConsultationsTable.quantite,
        tvaRate: actesConsultationsTable.tvaRate,
      })
      .from(actesConsultationsTable)
      .where(
        and(
          eq(actesConsultationsTable.clinicId, req.clinicId!),
          eq(actesConsultationsTable.consultationId, factureBefore.consultationId),
        ),
      );

    if (actesPourTotal.length > 0) {
      const t = computeInvoiceTotals(actesPourTotal, TVA_DEFAULT_RATE);
      updateData.montantHT = t.montantHT;
      updateData.montantTTC = t.montantTTC;
      updateData.tva = t.tvaMoyenne;
      updateData.tvaBreakdown = t.tvaBreakdown;
    }

    const [facture] = await db
      .update(facturesTable)
      .set(updateData)
      .where(and(eq(facturesTable.clinicId, req.clinicId!), eq(facturesTable.id, params.data.id)))
      .returning();
    if (!facture) return res.status(404).json(fail("NOT_FOUND", "Facture non trouvÃÂÃÂ©e"));

    // FEFO auto-decrement ÃÂÃÂ  l'encaissement.
    if (body.data.statut === "payee" && factureBefore.statut !== "payee") {
      try {
        const lignes = await (db as any)
          .select({
            nom: actesTable.nom,
            categorie: actesTable.categorie,
            code: actesTable.code,
            quantite: actesConsultationsTable.quantite,
          })
          .from(actesConsultationsTable)
          .leftJoin(actesTable, eq(actesConsultationsTable.acteId, actesTable.id))
          .where(
            and(
              eq(actesConsultationsTable.clinicId, req.clinicId!),
              eq(actesConsultationsTable.consultationId, facture.consultationId),
            ),
          );

        const medicamentLignes = lignes
          .filter(
            (l) =>
              l.nom &&
              (l.categorie?.toLowerCase().includes("mÃÂÃÂ©dic") ||
                l.categorie?.toLowerCase().includes("medic") ||
                l.code?.startsWith("MED") ||
                l.code?.startsWith("VACCI")),
          )
          .map((l) => ({ nom: l.nom!, quantite: l.quantite ?? 1 }));

        if (medicamentLignes.length > 0) {
          await decrementerConsultationFEFO(req.clinicId!, facture.consultationId, medicamentLignes);
        }
      } catch (fefoErr) {
        req.log.warn({ err: fefoErr }, "FEFO auto-decrement failed (non-blocking)");
      }
    }

    const renduMonnaie =
      modePaiement === "especes" && montantEspecesRecu !== null
        ? Math.round((montantEspecesRecu - (facture.montantTTC ?? 0)) * 100) / 100
        : null;

    return res.json({ ...facture, createdAt: facture.createdAt.toISOString(), renduMonnaie });
  } catch (err) {
    req.log.error({ err }, "PATCH /factures/:id failed");
    return res.status(500).json(fail("INTERNAL", "Erreur interne du serveur"));
  }
});

export default router;
