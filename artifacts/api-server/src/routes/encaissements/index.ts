import { Router } from "express";
import { db } from "@workspace/db";
import { facturesTable, consultationsTable, patientsTable, ownersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { ok } from "../../lib/response";

const router = Router();

router.get("/", async (req, res) => {
  const rows = await db
    .select({
      id: facturesTable.id,
      numero: facturesTable.numero,
      consultationId: facturesTable.consultationId,
      montantHT: facturesTable.montantHT,
      tva: facturesTable.tva,
      montantTTC: facturesTable.montantTTC,
      statut: facturesTable.statut,
      dateEmission: facturesTable.dateEmission,
      datePaiement: facturesTable.datePaiement,
      modePaiement: facturesTable.modePaiement,
      montantEspecesRecu: facturesTable.montantEspecesRecu,
      patientId: patientsTable.id,
      patientNom: patientsTable.nom,
      ownerId: ownersTable.id,
      ownerNom: ownersTable.nom,
      ownerPrenom: ownersTable.prenom,
    })
    .from(facturesTable)
    .leftJoin(consultationsTable, eq(consultationsTable.id, facturesTable.consultationId))
    .leftJoin(patientsTable, eq(patientsTable.id, consultationsTable.patientId))
    .leftJoin(ownersTable, eq(ownersTable.id, patientsTable.ownerId))
    .where(and(
      eq(facturesTable.statut, "payee"),
      eq(facturesTable.clinicId, req.clinicId),
    ))
    .orderBy(desc(facturesTable.datePaiement));

  const encaissements = rows;
  return res.json(ok(encaissements, { total: encaissements.length, page: 1, pages: 1 }));
});

export default router;
