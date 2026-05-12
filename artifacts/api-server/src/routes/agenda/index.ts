import { Router } from "express";
import { db } from "@workspace/db";
import {
  veterinairesTable,
  planningSeamineTypeTable,
  exceptionsPlanningTable,
  rotationsWeekendTable,
  rendezVousTable,
  patientsTable,
  ownersTable,
} from "@workspace/db";
import { eq, and, gte, lte, asc, or } from "drizzle-orm";

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Day of week: 0=Lundi, 1=Mardi, ..., 6=Dimanche
function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00Z");
  const dow = d.getDay(); // 0=Sunday, 1=Monday, ...
  return dow === 0 ? 6 : dow - 1; // 0=Lundi, ..., 6=Dimanche
}

function isSaturday(dateStr: string): boolean { return getDayOfWeek(dateStr) === 5; }
function isSunday(dateStr: string): boolean { return getDayOfWeek(dateStr) === 6; }

async function getAvailableSlots(
  vetId: string,
  date: string,
  clinicId: string,
  slotDuration = 20
): Promise<{ heure: string; disponible: boolean }[]> {
  const dayOfWeek = getDayOfWeek(date);
  const isWeekend = isSaturday(date) || isSunday(date);

  // 1. Get typical week planning for this day
  const [planning] = await db
    .select()
    .from(planningSeamineTypeTable)
    .where(and(
      eq(planningSeamineTypeTable.clinicId, clinicId),
      eq(planningSeamineTypeTable.veterinaireId, vetId),
      eq(planningSeamineTypeTable.jourSemaine, dayOfWeek),
      eq(planningSeamineTypeTable.actif, true),
    ));

  if (!planning) return [];

  // 2. Check exceptions covering this date
  const exceptions = await db
    .select()
    .from(exceptionsPlanningTable)
    .where(and(
      eq(exceptionsPlanningTable.clinicId, clinicId),
      eq(exceptionsPlanningTable.veterinaireId, vetId),
      lte(exceptionsPlanningTable.dateDebut, date),
      gte(exceptionsPlanningTable.dateFin, date),
    ));

  for (const exc of exceptions) {
    const blocking = ["conge", "maladie", "formation", "fermeture_clinique"];
    if (blocking.includes(exc.typeException)) return [];
    if (exc.typeException === "garde_exceptionnelle") {
      // Use override hours
    }
  }

  // 3. For weekends: check rotation
  if (isWeekend) {
    const satDate = isSaturday(date) ? date : new Date(new Date(date).getTime() - 86400000).toISOString().split("T")[0];
    const gardeType = isSaturday(date) ? "samedi" : "dimanche";
    const rotations = await db
      .select()
      .from(rotationsWeekendTable)
      .where(and(
        eq(rotationsWeekendTable.clinicId, clinicId),
        eq(rotationsWeekendTable.veterinaireId, vetId),
        eq(rotationsWeekendTable.dateWeekend, satDate),
        or(
          eq(rotationsWeekendTable.typeGarde, gardeType),
          eq(rotationsWeekendTable.typeGarde, "weekend_complet"),
        ),
      ));
    if (rotations.length === 0) return [];
  }

  // Check for garde_exceptionnelle override
  const gardeExc = exceptions.find(e => e.typeException === "garde_exceptionnelle");
  const heureDebut = gardeExc?.heureDebutOverride ?? planning.heureDebut;
  const heureFin = gardeExc?.heureFinOverride ?? planning.heureFin;

  // 4. Generate slots
  const startMins = toMinutes(heureDebut);
  const endMins = toMinutes(heureFin);
  const pauseStart = planning.pauseDebut ? toMinutes(planning.pauseDebut) : null;
  const pauseEnd = planning.pauseFin ? toMinutes(planning.pauseFin) : null;

  const rawSlots: string[] = [];
  for (let m = startMins; m + slotDuration <= endMins; m += slotDuration) {
    if (pauseStart !== null && pauseEnd !== null) {
      if (m >= pauseStart && m < pauseEnd) continue;
      if (m < pauseStart && m + slotDuration > pauseStart) continue;
    }
    rawSlots.push(fromMinutes(m));
  }

  // 5. Get existing appointments for this vet on this date
  const dateFrom = `${date}T00:00:00`;
  const dateTo = `${date}T23:59:59`;
  const existingRdvs = await db
    .select()
    .from(rendezVousTable)
    .where(and(
      eq(rendezVousTable.clinicId, clinicId),
      eq(rendezVousTable.veterinaireId, vetId),
      gte(rendezVousTable.dateHeure, dateFrom),
      lte(rendezVousTable.dateHeure, dateTo),
    ));

  // Build occupied intervals
  const occupied: { start: number; end: number }[] = existingRdvs.map(r => {
    const time = r.dateHeure.split("T")[1]?.slice(0, 5) ?? "00:00";
    const s = toMinutes(time);
    return { start: s, end: s + (r.dureeMinutes ?? slotDuration) };
  });

  return rawSlots.map(heure => {
    const slotStart = toMinutes(heure);
    const slotEnd = slotStart + slotDuration;
    const isOccupied = occupied.some(o => slotStart < o.end && slotEnd > o.start);
    return { heure, disponible: !isOccupied };
  });
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// GET /api/agenda/veterinaires
router.get("/veterinaires", async (req, res) => {
  try {
    const vets = await db
      .select()
      .from(veterinairesTable)
      .where(and(
        eq(veterinairesTable.clinicId, req.clinicId!),
        eq(veterinairesTable.actif, true),
      ))
      .orderBy(asc(veterinairesTable.nom));
    return res.json(vets);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

// GET /api/agenda/veterinaires/tous (y compris inactifs)
router.get("/veterinaires/tous", async (req, res) => {
  try {
    const vets = await db
      .select()
      .from(veterinairesTable)
      .where(eq(veterinairesTable.clinicId, req.clinicId!))
      .orderBy(asc(veterinairesTable.nom));
    return res.json(vets);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

// POST /api/agenda/veterinaires
router.post("/veterinaires", async (req, res) => {
  try {
    const { nom, prenom, couleur, initiales, rpps } = req.body;
    if (!nom || !prenom) return res.status(400).json({ error: "nom et prenom requis" });
    const [vet] = await db.insert(veterinairesTable).values({
      nom, prenom, couleur: couleur ?? "#2563EB",
      initiales: initiales ?? `${prenom[0]}${nom[0]}`.toUpperCase(),
      rpps, clinicId: req.clinicId!,
    }).returning();
    return res.status(201).json(vet);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

// PUT /api/agenda/veterinaires/:id
router.put("/veterinaires/:id", async (req, res) => {
  try {
    const { nom, prenom, couleur, initiales, rpps, actif } = req.body;
    const [vet] = await db
      .update(veterinairesTable)
      .set({ nom, prenom, couleur, initiales, rpps, actif })
      .where(and(eq(veterinairesTable.id, req.params.id), eq(veterinairesTable.clinicId, req.clinicId!)))
      .returning();
    if (!vet) return res.status(404).json({ error: "Vétérinaire non trouvé" });
    return res.json(vet);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

// DELETE /api/agenda/veterinaires/:id
router.delete("/veterinaires/:id", async (req, res) => {
  try {
    await db.update(veterinairesTable).set({ actif: false })
      .where(and(eq(veterinairesTable.id, req.params.id), eq(veterinairesTable.clinicId, req.clinicId!)));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

// GET /api/agenda/slots/:vetId/:date
router.get("/slots/:vetId/:date", async (req, res) => {
  try {
    const { vetId, date } = req.params;
    const duration = parseInt(req.query.duree as string) || 20;
    const slots = await getAvailableSlots(vetId, date, req.clinicId!, duration);
    return res.json(slots);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

// GET /api/agenda/slots/multi/:date
router.get("/slots/multi/:date", async (req, res) => {
  try {
    const { date } = req.params;
    const duration = parseInt(req.query.duree as string) || 20;
    const vets = await db.select().from(veterinairesTable).where(and(
      eq(veterinairesTable.clinicId, req.clinicId!),
      eq(veterinairesTable.actif, true),
    ));

    const result: Record<string, unknown> = {};
    for (const vet of vets) {
      const slots = await getAvailableSlots(vet.id, date, req.clinicId!, duration);
      result[vet.id] = { vet, slots, travaille: slots.length > 0 };
    }
    return res.json(result);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

// GET /api/agenda/rendez-vous/semaine/:dateDebut
router.get("/rendez-vous/semaine/:dateDebut", async (req, res) => {
  try {
    const { dateDebut } = req.params;
    const start = new Date(dateDebut + "T00:00:00Z");
    const end = new Date(start.getTime() + 7 * 86400000);
    const endStr = end.toISOString().split("T")[0];

    const rdvs = await db
      .select({
        id: rendezVousTable.id,
        dateHeure: rendezVousTable.dateHeure,
        dureeMinutes: rendezVousTable.dureeMinutes,
        motif: rendezVousTable.motif,
        typeRdv: rendezVousTable.typeRdv,
        statut: rendezVousTable.statut,
        statutSalle: rendezVousTable.statutSalle,
        veterinaire: rendezVousTable.veterinaire,
        veterinaireId: rendezVousTable.veterinaireId,
        animalNom: rendezVousTable.animalNom,
        animalEspece: rendezVousTable.animalEspece,
        proprietaireNom: rendezVousTable.proprietaireNom,
        proprietaireTelephone: rendezVousTable.proprietaireTelephone,
        notes: rendezVousTable.notes,
        patient: {
          id: patientsTable.id,
          nom: patientsTable.nom,
          espece: patientsTable.espece,
        },
        owner: {
          id: ownersTable.id,
          nom: ownersTable.nom,
          prenom: ownersTable.prenom,
          telephone: ownersTable.telephone,
        },
        vet: {
          id: veterinairesTable.id,
          nom: veterinairesTable.nom,
          prenom: veterinairesTable.prenom,
          couleur: veterinairesTable.couleur,
          initiales: veterinairesTable.initiales,
        },
      })
      .from(rendezVousTable)
      .leftJoin(patientsTable, eq(rendezVousTable.patientId, patientsTable.id))
      .leftJoin(ownersTable, eq(rendezVousTable.ownerId, ownersTable.id))
      .leftJoin(veterinairesTable, eq(rendezVousTable.veterinaireId, veterinairesTable.id))
      .where(and(
        eq(rendezVousTable.clinicId, req.clinicId!),
        gte(rendezVousTable.dateHeure, dateDebut + "T00:00:00"),
        lte(rendezVousTable.dateHeure, endStr + "T23:59:59"),
      ))
      .orderBy(asc(rendezVousTable.dateHeure));

    return res.json(rdvs);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

// GET /api/agenda/planning/mois/:annee/:mois
router.get("/planning/mois/:annee/:mois", async (req, res) => {
  try {
    const annee = parseInt(req.params.annee);
    const mois = parseInt(req.params.mois); // 1-12
    const start = `${annee}-${String(mois).padStart(2, "0")}-01`;
    const lastDay = new Date(annee, mois, 0).getDate();
    const end = `${annee}-${String(mois).padStart(2, "0")}-${lastDay}`;

    const cid = req.clinicId!;
    const vets = await db.select().from(veterinairesTable).where(and(
      eq(veterinairesTable.clinicId, cid),
      eq(veterinairesTable.actif, true),
    ));
    const exceptions = await db
      .select()
      .from(exceptionsPlanningTable)
      .where(and(
        eq(exceptionsPlanningTable.clinicId, cid),
        lte(exceptionsPlanningTable.dateDebut, end),
        gte(exceptionsPlanningTable.dateFin, start),
      ));
    const rotations = await db
      .select()
      .from(rotationsWeekendTable)
      .where(and(
        eq(rotationsWeekendTable.clinicId, cid),
        gte(rotationsWeekendTable.dateWeekend, start),
        lte(rotationsWeekendTable.dateWeekend, end),
      ));

    const rdvCounts = await db
      .select({
        date: rendezVousTable.dateHeure,
        vetId: rendezVousTable.veterinaireId,
      })
      .from(rendezVousTable)
      .where(and(
        eq(rendezVousTable.clinicId, cid),
        gte(rendezVousTable.dateHeure, start + "T00:00:00"),
        lte(rendezVousTable.dateHeure, end + "T23:59:59"),
      ));

    const result: Record<string, Record<string, { travaille: boolean; nbRdv: number; exception?: string; estGardeWeekend: boolean }>> = {};

    const currentDate = new Date(start + "T12:00:00Z");
    const endDate = new Date(end + "T12:00:00Z");

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split("T")[0];
      const dayOfWeek = getDayOfWeek(dateStr);
      const isWE = dayOfWeek >= 5;
      result[dateStr] = {};

      for (const vet of vets) {
        const exc = exceptions.find(e => e.veterinaireId === vet.id && e.dateDebut <= dateStr && e.dateFin >= dateStr);
        const satDate = isSaturday(dateStr) ? dateStr : new Date(currentDate.getTime() - 86400000).toISOString().split("T")[0];
        const gardeType = isSaturday(dateStr) ? "samedi" : "dimanche";
        const estGarde = isWE && rotations.some(r => r.veterinaireId === vet.id && r.dateWeekend === satDate && (r.typeGarde === gardeType || r.typeGarde === "weekend_complet"));
        const nbRdv = rdvCounts.filter(r => r.vetId === vet.id && r.date.startsWith(dateStr)).length;

        const blocking = ["conge", "maladie", "formation", "fermeture_clinique"];
        const travaille = !exc || exc.typeException === "garde_exceptionnelle" || !blocking.includes(exc.typeException);

        result[dateStr][vet.id] = {
          travaille: isWE ? estGarde : (travaille && true),
          nbRdv,
          exception: exc?.typeException,
          estGardeWeekend: estGarde,
        };
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return res.json({ mois: result, vets });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

// POST /api/agenda/rendez-vous
router.post("/rendez-vous", async (req, res) => {
  try {
    const {
      veterinaireId, dateHeure, dureeMinutes = 20, motif, typeRdv,
      animalNom, animalEspece, proprietaireNom, proprietaireTelephone,
      patientId, ownerId, notes, createdBy,
    } = req.body;

    if (!dateHeure) return res.status(400).json({ error: "dateHeure requis" });

    // Validate slot if veterinaireId provided
    if (veterinaireId) {
      const date = dateHeure.split("T")[0];
      const heure = dateHeure.split("T")[1]?.slice(0, 5) ?? "00:00";
      const slots = await getAvailableSlots(veterinaireId, date, req.clinicId!, dureeMinutes);
      const slot = slots.find(s => s.heure === heure);
      if (slot && !slot.disponible) {
        const next = slots.filter(s => s.disponible && s.heure > heure).slice(0, 3);
        return res.status(409).json({ error: "Créneau déjà pris", prochains: next });
      }
    }

    // Resolve vet name from vet record if not provided
    let veterinaire: string | undefined = req.body.veterinaire;
    if (veterinaireId && !veterinaire) {
      const [vet] = await db.select().from(veterinairesTable).where(and(
        eq(veterinairesTable.id, veterinaireId),
        eq(veterinairesTable.clinicId, req.clinicId!),
      ));
      if (vet) veterinaire = `Dr. ${vet.prenom} ${vet.nom}`;
    }

    const [rdv] = await db.insert(rendezVousTable).values({
      clinicId: req.clinicId!,
      veterinaireId, veterinaire, dateHeure, dureeMinutes: dureeMinutes ?? 20,
      motif, typeRdv: typeRdv ?? "consultation",
      animalNom, animalEspece, proprietaireNom, proprietaireTelephone,
      patientId: patientId ? parseInt(patientId) : null,
      ownerId: ownerId ? parseInt(ownerId) : null,
      notes, createdBy,
      statut: "planifié", statutSalle: "en_attente_arrivee",
    }).returning();
    return res.status(201).json(rdv);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

// PUT /api/agenda/rendez-vous/:id
router.put("/rendez-vous/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { clinicId: _ignored, ...payload } = req.body;
    const [rdv] = await db.update(rendezVousTable).set(payload)
      .where(and(eq(rendezVousTable.id, id), eq(rendezVousTable.clinicId, req.clinicId!)))
      .returning();
    if (!rdv) return res.status(404).json({ error: "RDV non trouvé" });
    return res.json(rdv);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

// PUT /api/agenda/rendez-vous/:id/statut-salle
router.put("/rendez-vous/:id/statut-salle", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { statutSalle } = req.body;
    const [rdv] = await db.update(rendezVousTable).set({ statutSalle })
      .where(and(eq(rendezVousTable.id, id), eq(rendezVousTable.clinicId, req.clinicId!)))
      .returning();
    if (!rdv) return res.status(404).json({ error: "RDV non trouvé" });
    return res.json(rdv);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

// GET /api/agenda/planning/semaine-type/:vetId
router.get("/planning/semaine-type/:vetId", async (req, res) => {
  try {
    const planning = await db
      .select()
      .from(planningSeamineTypeTable)
      .where(and(
        eq(planningSeamineTypeTable.clinicId, req.clinicId!),
        eq(planningSeamineTypeTable.veterinaireId, req.params.vetId),
      ))
      .orderBy(asc(planningSeamineTypeTable.jourSemaine));
    return res.json(planning);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

// POST /api/agenda/planning/semaine-type
router.post("/planning/semaine-type", async (req, res) => {
  try {
    const { veterinaireId, jourSemaine, heureDebut, heureFin, pauseDebut, pauseFin, actif } = req.body;
    if (!veterinaireId || jourSemaine === undefined) return res.status(400).json({ error: "veterinaireId et jourSemaine requis" });

    // Upsert by delete + insert
    await db.delete(planningSeamineTypeTable).where(and(
      eq(planningSeamineTypeTable.clinicId, req.clinicId!),
      eq(planningSeamineTypeTable.veterinaireId, veterinaireId),
      eq(planningSeamineTypeTable.jourSemaine, jourSemaine),
    ));
    if (actif !== false) {
      const [row] = await db.insert(planningSeamineTypeTable).values({
        veterinaireId, jourSemaine, heureDebut: heureDebut ?? "08:30",
        heureFin: heureFin ?? "19:00", pauseDebut, pauseFin,
        actif: true, clinicId: req.clinicId!,
      }).returning();
      return res.status(201).json(row);
    }
    return res.json({ deleted: true });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

// POST /api/agenda/planning/exception
router.post("/planning/exception", async (req, res) => {
  try {
    const { veterinaireId, dateDebut, dateFin, typeException, motif, heureDebutOverride, heureFinOverride } = req.body;
    if (!veterinaireId || !dateDebut || !dateFin || !typeException) {
      return res.status(400).json({ error: "Champs requis manquants" });
    }

    // Check for rdv conflicts
    const rdvConflicts = await db
      .select({
        id: rendezVousTable.id,
        dateHeure: rendezVousTable.dateHeure,
        animalNom: rendezVousTable.animalNom,
        proprietaireNom: rendezVousTable.proprietaireNom,
      })
      .from(rendezVousTable)
      .where(and(
        eq(rendezVousTable.clinicId, req.clinicId!),
        eq(rendezVousTable.veterinaireId, veterinaireId),
        gte(rendezVousTable.dateHeure, dateDebut + "T00:00:00"),
        lte(rendezVousTable.dateHeure, dateFin + "T23:59:59"),
      ));

    const [exc] = await db.insert(exceptionsPlanningTable).values({
      veterinaireId, dateDebut, dateFin, typeException, motif,
      heureDebutOverride, heureFinOverride, clinicId: req.clinicId!,
    }).returning();

    return res.status(201).json({ exception: exc, conflits: rdvConflicts });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

// DELETE /api/agenda/planning/exception/:id
router.delete("/planning/exception/:id", async (req, res) => {
  try {
    await db.delete(exceptionsPlanningTable).where(and(
      eq(exceptionsPlanningTable.id, req.params.id),
      eq(exceptionsPlanningTable.clinicId, req.clinicId!),
    ));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

// GET /api/agenda/exceptions/:vetId
router.get("/exceptions/:vetId", async (req, res) => {
  try {
    const excs = await db
      .select()
      .from(exceptionsPlanningTable)
      .where(and(
        eq(exceptionsPlanningTable.clinicId, req.clinicId!),
        eq(exceptionsPlanningTable.veterinaireId, req.params.vetId),
      ))
      .orderBy(asc(exceptionsPlanningTable.dateDebut));
    return res.json(excs);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

// POST /api/agenda/rotations/generer
router.post("/rotations/generer", async (req, res) => {
  try {
    const { vetIds, dateDebut, dateFin, confirmer } = req.body;
    if (!vetIds?.length || !dateDebut || !dateFin) {
      return res.status(400).json({ error: "vetIds, dateDebut, dateFin requis" });
    }

    const preview: { date: string; veterinaireId: string; typeGarde: string }[] = [];
    let vetIdx = 0;
    const current = new Date(dateDebut + "T12:00:00Z");
    const end = new Date(dateFin + "T12:00:00Z");

    while (current <= end) {
      const dow = current.getDay();
      if (dow === 6) { // Saturday
        const dateStr = current.toISOString().split("T")[0];
        const vetId = vetIds[vetIdx % vetIds.length];
        preview.push({ date: dateStr, veterinaireId: vetId, typeGarde: "weekend_complet" });
        vetIdx++;
      }
      current.setDate(current.getDate() + 1);
    }

    if (!confirmer) return res.json({ preview, message: `${preview.length} weekends générés (aperçu)` });

    for (const rot of preview) {
      try {
        await db.insert(rotationsWeekendTable).values({
          clinicId: req.clinicId!,
          dateWeekend: rot.date,
          veterinaireId: rot.veterinaireId,
          typeGarde: rot.typeGarde,
        }).onConflictDoNothing();
      } catch { /* ignore conflicts */ }
    }

    return res.status(201).json({ preview, message: `${preview.length} weekends créés` });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

// GET /api/agenda/prochain-creneau (query: ?vetId=xxx)
router.get("/prochain-creneau", async (req, res) => {
  try {
    const vetId = req.query.vetId as string | undefined;
    const vets = vetId
      ? [{ id: vetId }]
      : await db.select({ id: veterinairesTable.id }).from(veterinairesTable).where(and(
          eq(veterinairesTable.clinicId, req.clinicId!),
          eq(veterinairesTable.actif, true),
        ));

    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      for (const vet of vets) {
        const slots = await getAvailableSlots(vet.id, dateStr, req.clinicId!);
        const next = slots.find(s => s.disponible);
        if (next) return res.json({ date: dateStr, heure: next.heure, veterinaireId: vet.id });
      }
    }
    return res.json(null);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Erreur interne" });
  }
});

export default router;
