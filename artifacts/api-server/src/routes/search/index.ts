import { Router } from "express";
import { db } from "@workspace/db";
import { patientsTable, ownersTable, consultationsTable } from "@workspace/db";
import { ilike, or, and, eq } from "drizzle-orm";


const router = Router();


router.get("/", async (req, res) => {
  const q = ((req.query.q as string) ?? "").trim();
  if (!q || q.length < 2) {
    return res.json({ patients: [], owners: [], consultations: [] });
  }


  const term = `%${q}%`;
  const cid = req.clinicId!;


  try {
    const [patients, owners, consultations] = await Promise.all([
      db
        .select({
          id: patientsTable.id,
          nom: patientsTable.nom,
          espece: patientsTable.espece,
          race: patientsTable.race,
        })
        .from(patientsTable)
        .where(and(eq(patientsTable.clinicId, cid), ilike(patientsTable.nom, term)))
        .limit(5),


      db
        .select({
          id: ownersTable.id,
          nom: ownersTable.nom,
          prenom: ownersTable.prenom,
          telephone: ownersTable.telephone,
          email: ownersTable.email,
