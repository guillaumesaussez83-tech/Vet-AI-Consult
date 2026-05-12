import { Router } from "express";
import { db } from "@workspace/db";
import { patientsTable, consultationsTable, facturesTable, ownersTable, vaccinationsTable } from "@workspace/db";
import { eq, gte, lte, and, isNotNull, sql } from "drizzle-orm";

const router = Router();

router.get("/stats", async (req, res) => {
  try {
    const cid = req.clinicId!;
    const today = new Date().toISOString().split("T")[0];
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

    const [{ count: totalPatients }] = await db.select({ count: sql<number>`count(*)` })
      .from(patientsTable).where(eq(patientsTable.clinicId, cid));
    const [{ count: totalConsultations }] = await db.select({ count: sql<number>`count(*)` })
      .from(consultationsTable).where(eq(consultationsTable.clinicId, cid));
    const [{ count: totalProprietaires }] = await db.select({ count: sql<number>`count(*)` })
      .from(ownersTable).where(eq(ownersTable.clinicId, cid));

    const consultationsAujourdhui = await db.select().from(consultationsTable)
      .where(and(eq(consultationsTable.clinicId, cid), eq(consultationsTable.date, today)));
    const consultationsEnCours = await db.select().from(consultationsTable)
      .where(and(eq(consultationsTable.clinicId, cid), eq(consultationsTable.statut, "en_cours")));

    const facturesImpayees = await db.select().from(facturesTable)
      .where(and(eq(facturesTable.clinicId, cid), eq(facturesTable.statut, "en_attente")));

    const facturesMois = await db.select().from(facturesTable).where(and(
      eq(facturesTable.clinicId, cid),
      gte(facturesTable.dateEmission, firstOfMonth),
    ));
    const chiffreAffaireMois = facturesMois.reduce((acc, f) => acc + f.montantTTC, 0);

    return res.json({
      totalPatients: Number(totalPatients),
      totalConsultations: Number(totalConsultations),
      totalProprietaires: Number(totalProprietaires),
      consultationsAujourdhui: consultationsAujourdhui.length,
      consultationsEnCours: consultationsEnCours.length,
      facturesImpayees: facturesImpayees.length,
      chiffreAffaireMois,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.get("/consultations-recentes", async (req, res) => {
  try {
    const recentConsultations = await db
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
      .where(eq(consultationsTable.clinicId, req.clinicId!))
      .orderBy(sql`${consultationsTable.createdAt} DESC`)
      .limit(10);

    return res.json(recentConsultations.map(c => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      patient: c.patient ? {
        ...c.patient,
        createdAt: c.patient.createdAt.toISOString(),
        owner: c.patient.owner ? {
          ...c.patient.owner,
          createdAt: c.patient.owner.createdAt.toISOString(),
        } : null,
      } : null,
    })));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

router.get("/rappels-vaccins", async (req, res) => {
  try {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const sevenDaysAhead = new Date(today);
    sevenDaysAhead.setDate(today.getDate() + 7);

    const ago = sevenDaysAgo.toISOString().split("T")[0];
    const ahead = sevenDaysAhead.toISOString().split("T")[0];

    const rappels = await db
      .select({
        id: vaccinationsTable.id,
        nomVaccin: vaccinationsTable.nomVaccin,
        dateRappel: vaccinationsTable.dateRappel,
        patientId: vaccinationsTable.patientId,
        nomPatient: patientsTable.nom,
        espece: patientsTable.espece,
        ownerId: patientsTable.ownerId,
        nomProprietaire: ownersTable.nom,
        prenomProprietaire: ownersTable.prenom,
        telephoneProprietaire: ownersTable.telephone,
      })
      .from(vaccinationsTable)
      .leftJoin(patientsTable, eq(vaccinationsTable.patientId, patientsTable.id))
      .leftJoin(ownersTable, eq(patientsTable.ownerId, ownersTable.id))
      .where(
        and(
          eq(vaccinationsTable.clinicId, req.clinicId!),
          isNotNull(vaccinationsTable.dateRappel),
          gte(vaccinationsTable.dateRappel, ago),
          lte(vaccinationsTable.dateRappel, ahead)
        )
      )
      .orderBy(vaccinationsTable.dateRappel)
      .limit(15);

    const todayStr = today.toISOString().split("T")[0];
    return res.json(rappels.map(r => ({
      ...r,
      enRetard: r.dateRappel != null && r.dateRappel < todayStr,
    })));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

export default router;
